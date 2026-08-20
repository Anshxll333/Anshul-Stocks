import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { ipoData, providerCache } from '../../database/schema';
import { eq, and, gt, desc, inArray } from 'drizzle-orm';
import { IPODataDTO } from '../dto/ipo-data.dto';
import { ProviderManager } from '../provider.manager';
import { YahooFinanceProvider } from '../yahoo-finance.provider';
import { IPOMapper } from '../mappers/ipo.mapper';
import { IPO_PROVIDER_TOKEN } from '../ipo.provider';
import type { IIpoProvider } from '../ipo.provider';

export interface IpoSyncResult {
  status: 'success' | 'skipped' | 'no-data' | 'failed';
  fetched: number;
  inserted: number;
  updated: number;
  gmpUpdated: number;
  subscriptionUpdated: number;
  skipped: number;
  error: string | null;
}

@Injectable()
export class IpoSyncService {
  private readonly logger = new Logger(IpoSyncService.name);
  private readonly cacheTtlSeconds: number;
  private isSyncing = false;

  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: DrizzleDB,
    private readonly yahooFinanceProvider: YahooFinanceProvider,
    private readonly providerManager: ProviderManager,
    private readonly configService: ConfigService,
    @Inject(IPO_PROVIDER_TOKEN) private readonly ipoProvider: IIpoProvider,
  ) {
    this.cacheTtlSeconds =
      this.configService.get<number>('provider.cacheTtlSeconds') || 3600;
  }

  /** Display name of the ACTIVE IPO provider (never hardcoded). */
  private get providerLabel(): string {
    const provider = this.ipoProvider as any;
    return typeof provider?.getProviderName === 'function'
      ? provider.getProviderName()
      : 'IPO provider';
  }

  /**
   * Full automatic synchronization (called by the hourly cron and manually
   * for testing). Fetches ALL IPOs from the configured IPO provider, then
   * UPSERTs each into PostgreSQL:
   *   - New symbol      -> INSERT
   *   - Existing symbol -> UPDATE changed fields (GMP + subscription included)
   *
   * Missing GMP / subscription data stays NULL. On provider failure the
   * existing PostgreSQL data is preserved (cached) and the next scheduled run
   * retries — the data is never marked as freshly synced in that case.
   */
  async syncIpos(): Promise<IpoSyncResult> {
    if (this.isSyncing) {
      this.logger.warn(
        '[IPO SYNC] Synchronization already in progress, skipping this run',
      );
      return {
        status: 'skipped',
        fetched: 0,
        inserted: 0,
        updated: 0,
        gmpUpdated: 0,
        subscriptionUpdated: 0,
        skipped: 0,
        error: null,
      };
    }

    this.isSyncing = true;
    const result: IpoSyncResult = {
      status: 'failed',
      fetched: 0,
      inserted: 0,
      updated: 0,
      gmpUpdated: 0,
      subscriptionUpdated: 0,
      skipped: 0,
      error: null,
    };

    try {
      this.logger.log('[IPO SYNC] Starting IPO synchronization');
      this.logger.log(
        `[IPO SYNC] Fetching data from ${this.providerLabel}`,
      );

      const records = await this.ipoProvider.getLiveIpos();
      if (!records || records.length === 0) {
        this.logger.warn(
          `[IPO SYNC] No IPO records received from ${this.providerLabel}. Keeping existing PostgreSQL data (cache) until the next successful sync.`,
        );
        result.status = 'no-data';
        return result;
      }

      this.logger.log(`[IPO SYNC] Received ${records.length} IPOs`);
      result.fetched = records.length;

      // Load existing rows once for in-memory matching (prevents duplicates).
      const existingRows = await this.db
        .select({
          id: ipoData.id,
          symbol: ipoData.symbol,
          companyName: ipoData.companyName,
          gmp: ipoData.gmp,
          totalSub: ipoData.totalSub,
        })
        .from(ipoData);

      const bySymbol = new Map<string, (typeof existingRows)[number]>();
      const byName = new Map<string, (typeof existingRows)[number]>();
      for (const row of existingRows) {
        if (row.symbol) bySymbol.set(row.symbol.toLowerCase(), row);
        if (row.companyName) {
          byName.set(row.companyName.toLowerCase().trim(), row);
        }
      }

      const now = new Date();
      const inserts: any[] = [];
      const updates: Array<{ id: number; values: any }> = [];

      for (const record of records) {
        try {
          const dto = IPOMapper.toIPODTO(record);
          if (!dto.companyName) {
            result.skipped++;
            continue;
          }

          const symbol = this.resolveSymbol(dto);
          const symKey = symbol.toLowerCase();
          const nameKey = dto.companyName.toLowerCase().trim();
          const existingRow = bySymbol.get(symKey) || byName.get(nameKey);
          const values = this.buildIpoValues(dto, symbol, now);

          if (existingRow) {
            const changes = this.detectChanges(existingRow, dto);
            updates.push({ id: existingRow.id, values });
            result.updated++;
            this.logger.log(`[IPO SYNC] Updated IPO: ${dto.companyName}`);
            if (changes.gmp) {
              result.gmpUpdated++;
              this.logger.log(`[IPO SYNC] GMP updated: ${dto.companyName}`);
            }
            if (changes.subscription) {
              result.subscriptionUpdated++;
              this.logger.log(
                `[IPO SYNC] Subscription updated: ${dto.companyName}`,
              );
            }
          } else {
            inserts.push(values);
            result.inserted++;
            this.logger.log(`[IPO SYNC] New IPO found: ${dto.companyName}`);
          }
        } catch (err: any) {
          this.logger.warn(
            `[IPO SYNC] Skipping malformed IPO record: ${err.message}`,
          );
          result.skipped++;
        }
      }

      // Apply INSERTs (with an upsert safety net against concurrent races).
      if (inserts.length > 0) {
        await this.db
          .insert(ipoData)
          .values(inserts)
          .onConflictDoUpdate({
            target: ipoData.symbol,
            set: this.buildConflictSet(now),
          });
      }

      // Apply UPDATEs by primary key.
      for (const update of updates) {
        await this.db
          .update(ipoData)
          .set(update.values)
          .where(eq(ipoData.id, update.id));
      }

      // Purge records that are demonstrably chat-sentence contamination (they
      // are never real IPOs — the AI fallback used to persist raw user prompts).
      // Legitimate records are preserved even when stale (those are filtered at
      // read time by getCurrentIpos).
      const removed = await this.cleanupContaminatedIpos();
      if (removed > 0) {
        result.skipped += removed;
      }

      result.status = 'success';
      this.logger.log('[IPO SYNC] Synchronization completed');
    } catch (err: any) {
      this.logger.error(`[IPO SYNC] Failed: ${err.message}`);
      result.error = err.message;
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /** Reads all IPOs from PostgreSQL for the frontend (never calls FinAPI). */
  async getIposFromDb(): Promise<any[]> {
    const rows = await this.db
      .select()
      .from(ipoData)
      .orderBy(desc(ipoData.updatedAt));

    return rows.map((row) => ({
      ...row,
      gmpTrends: row.gmpTrends ? this.safeParse(row.gmpTrends) : null,
      strengths: row.strengths ? this.safeParse(row.strengths) : null,
      risks: row.risks ? this.safeParse(row.risks) : null,
      utilizationOfProceeds: row.utilizationOfProceeds
        ? this.safeParse(row.utilizationOfProceeds)
        : null,
    }));
  }

  /**
   * AI Mentor source of truth. Reads IPO data from the synchronized PostgreSQL
   * ipo_data table (never from AI memory):
   *  - listQuery: returns all active (open + upcoming) IPOs, most recently
   *    updated first, so queries like "tell me the current IPOs" are grounded
   *    in the live database.
   *  - companyName: returns the single matching IPO by company name or symbol
   *    (case-insensitive), falling back to a live sync only when the company
   *    is not present in PostgreSQL yet.
   *
   * Missing GMP / subscription / price values are preserved as null so the AI
   * can render them as "Not available" instead of inventing numbers.
   */
  async getIpoForMentor(options: {
    companyName?: string;
    listQuery?: boolean;
  }): Promise<{ type: 'list'; items: any[] } | { type: 'single'; ipo: any }> {
    const rows = await this.getIposFromDb();

    // List mode: ONLY current live + upcoming IPOs, date-filtered in the
    // Asia/Kolkata timezone at runtime. Contaminated / placeholder / closed
    // records never reach the AI (previously chat prompts like "tell me the
    // current" could leak into this list via their 'upcoming' status).
    if (options.listQuery) {
      const current = await this.getCurrentIpos();
      const items = [...current.live, ...current.upcoming].map((r) =>
        this.normalizeIpoForMentor(r),
      );
      return { type: 'list', items };
    }

    const query = (options.companyName || '').trim().toLowerCase();
    if (query) {
      const match =
        rows.find((r) => r.companyName?.toLowerCase().trim() === query) ||
        rows.find((r) => r.companyName?.toLowerCase().includes(query)) ||
        rows.find((r) => r.symbol && r.symbol.toLowerCase() === query);
      if (match) {
        return { type: 'single', ipo: this.normalizeIpoForMentor(match) };
      }
    }

    // No PostgreSQL match: use the existing live sync pipeline as fallback.
    try {
      const live = await this.syncIpo(options.companyName || '');
      return { type: 'single', ipo: this.normalizeIpoForMentor(live) };
    } catch (err: any) {
      this.logger.warn(
        `[IpoSyncService] Live IPO fallback failed for "${options.companyName}": ${err.message}`,
      );
      return { type: 'single', ipo: this.normalizeIpoForMentor({}) };
    }
  }

  /**
   * Projects a DB row (or DTO fallback) into the compact AI Mentor IPO shape.
   * Every value that is missing in PostgreSQL stays null (never 0) so the AI
   * can emit "Not available" for GMP / subscription / dates that were not
   * synchronized yet.
   */
  private normalizeIpoForMentor(row: Record<string, any>): Record<string, any> {
    return {
      companyName: row.companyName ?? null,
      symbol: row.symbol ?? null,
      exchange: row.exchange ?? null,
      ipoType: row.ipoType ?? null,
      status: row.status ?? 'upcoming',
      priceBand: row.priceBand ?? null,
      priceRange: row.priceRange ?? row.priceBand ?? null,
      issuePrice: row.issuePrice ?? null,
      issueUpperPrice: row.issueUpperPrice ?? null,
      lotSize: row.lotSize ?? null,
      minInvestment: row.minInvestment ?? null,
      issueSizeCr: row.issueSizeCr ?? null,
      totalIssueSize: row.totalIssueSize ?? null,
      freshIssue: row.freshIssue ?? null,
      offerForSale: row.offerForSale ?? null,
      openDate: row.openDate ?? null,
      closeDate: row.closeDate ?? null,
      listingDate: row.listingDate ?? null,
      registrar: row.registrar ?? null,
      retailQuota: row.retailQuota ?? null,
      qibQuota: row.qibQuota ?? null,
      niiQuota: row.niiQuota ?? null,
      retailSub: row.retailSub ?? null,
      qibSub: row.qibSub ?? null,
      niiSub: row.niiSub ?? null,
      totalSub: row.totalSub ?? null,
      gmp: row.gmp ?? null,
      gmpGainPercent: row.gmpGainPercent ?? null,
      gmpDate: row.gmpDate ?? null,
      gmpSource: row.gmpSource ?? null,
      gmpTrends: row.gmpTrends ?? null,
      listingGainPercent: row.listingGainPercent ?? null,
      aboutCompany: row.aboutCompany ?? null,
      strengths: row.strengths ?? null,
      risks: row.risks ?? null,
      drhpLink: row.drhpLink ?? null,
      rhpLink: row.rhpLink ?? null,
      utilizationOfProceeds: row.utilizationOfProceeds ?? null,
      lastSyncedAt: row.lastSyncedAt ?? null,
    };
  }

  /** Stable unique key: symbol preferred, company-name slug as fallback. */
  private resolveSymbol(dto: IPODataDTO): string {
    if (dto.symbol && dto.symbol.trim()) {
      return dto.symbol.trim().toUpperCase();
    }
    const slug = dto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (slug || 'unknown_ipo').toUpperCase();
  }

  private buildIpoValues(dto: IPODataDTO, symbol: string, now: Date): any {
    return {
      companyName: dto.companyName,
      symbol,
      exchange: dto.exchange || 'NSE / BSE',
      ipoType: dto.ipoType || null,
      detailsUrl: dto.detailsUrl || null,
      logoUrl: dto.logoUrl || null,
      exchanges: dto.exchanges || null,
      issuePrice: dto.issuePrice ?? null,
      priceBand: dto.priceBand || null,
      priceRange: dto.priceRange || null,
      issueUpperPrice: dto.issueUpperPrice ?? null,
      lotSize: dto.lotSize ?? null,
      minInvestment: dto.minInvestment ?? null,
      issueSizeCr: dto.issueSizeCr ?? null,
      totalIssueSize: dto.totalIssueSize ?? null,
      freshIssue: dto.freshIssue ?? null,
      offerForSale: dto.offerForSale ?? null,
      openDate: dto.openDate || null,
      closeDate: dto.closeDate || null,
      listingDate: dto.listingDate || null,
      upiMandateDeadline: dto.upiMandateDeadline || null,
      allotmentFinalization: dto.allotmentFinalization || null,
      refundInitiation: dto.refundInitiation || null,
      shareCredit: dto.shareCredit || null,
      mandateEndDate: dto.mandateEndDate || null,
      lockInEndDateAnchor50: dto.lockInEndDateAnchor50 || null,
      lockInEndDateAnchorRemaining:
        dto.lockInEndDateAnchorRemaining || null,
      registrar: dto.registrar || null,
      retailQuota: dto.retailQuota || null,
      qibQuota: dto.qibQuota || null,
      niiQuota: dto.niiQuota || null,
      retailSub: dto.retailSub ?? null,
      qibSub: dto.qibSub ?? null,
      niiSub: dto.niiSub ?? null,
      totalSub: dto.totalSub ?? null,
      instReserved: dto.instReserved ?? null,
      instApplied: dto.instApplied ?? null,
      instSub: dto.instSub ?? null,
      niiReserved: dto.niiReserved ?? null,
      niiApplied: dto.niiApplied ?? null,
      retailReserved: dto.retailReserved ?? null,
      retailApplied: dto.retailApplied ?? null,
      totalReserved: dto.totalReserved ?? null,
      totalApplied: dto.totalApplied ?? null,
      gmp: dto.gmp ?? null,
      gmpGainPercent: dto.gmpGainPercent ?? null,
      gmpDate: dto.gmpDate || null,
      gmpSource: dto.gmpSource || null,
      gmpTrends: dto.gmpTrends ? JSON.stringify(dto.gmpTrends) : null,
      listingGainPercent: dto.listingGainPercent ?? null,
      status: dto.status,
      aboutCompany: dto.aboutCompany || null,
      strengths: dto.strengths ? JSON.stringify(dto.strengths) : null,
      risks: dto.risks ? JSON.stringify(dto.risks) : null,
      drhpLink: dto.drhpLink || null,
      rhpLink: dto.rhpLink || null,
      utilizationOfProceeds: dto.utilizationOfProceeds
        ? JSON.stringify(dto.utilizationOfProceeds)
        : null,
      updatedAt: now,
      lastSyncedAt: now,
    };
  }

  /** Conflict-set used by the INSERT ... ON CONFLICT safety net. */
  private buildConflictSet(now: Date): Record<string, any> {
    return {
      companyName: undefined as any,
      exchange: undefined as any,
      ipoType: undefined as any,
      detailsUrl: undefined as any,
      logoUrl: undefined as any,
      exchanges: undefined as any,
      issuePrice: undefined as any,
      priceBand: undefined as any,
      priceRange: undefined as any,
      issueUpperPrice: undefined as any,
      lotSize: undefined as any,
      minInvestment: undefined as any,
      issueSizeCr: undefined as any,
      totalIssueSize: undefined as any,
      freshIssue: undefined as any,
      offerForSale: undefined as any,
      openDate: undefined as any,
      closeDate: undefined as any,
      listingDate: undefined as any,
      upiMandateDeadline: undefined as any,
      allotmentFinalization: undefined as any,
      refundInitiation: undefined as any,
      shareCredit: undefined as any,
      mandateEndDate: undefined as any,
      lockInEndDateAnchor50: undefined as any,
      lockInEndDateAnchorRemaining: undefined as any,
      registrar: undefined as any,
      retailQuota: undefined as any,
      qibQuota: undefined as any,
      niiQuota: undefined as any,
      retailSub: undefined as any,
      qibSub: undefined as any,
      niiSub: undefined as any,
      totalSub: undefined as any,
      instReserved: undefined as any,
      instApplied: undefined as any,
      instSub: undefined as any,
      niiReserved: undefined as any,
      niiApplied: undefined as any,
      retailReserved: undefined as any,
      retailApplied: undefined as any,
      totalReserved: undefined as any,
      totalApplied: undefined as any,
      gmp: undefined as any,
      gmpGainPercent: undefined as any,
      gmpDate: undefined as any,
      gmpSource: undefined as any,
      gmpTrends: undefined as any,
      listingGainPercent: undefined as any,
      status: undefined as any,
      aboutCompany: undefined as any,
      strengths: undefined as any,
      risks: undefined as any,
      drhpLink: undefined as any,
      rhpLink: undefined as any,
      utilizationOfProceeds: undefined as any,
      updatedAt: now,
      lastSyncedAt: now,
    };
  }

  /** Detects whether GMP / subscription figures actually changed. */
  private detectChanges(
    existing: { gmp: string | number | null; totalSub: string | number | null },
    dto: IPODataDTO,
  ): { gmp: boolean; subscription: boolean } {
    const oldGmp =
      existing.gmp === null || existing.gmp === undefined
        ? null
        : Number(existing.gmp);
    const newGmp = dto.gmp ?? null;
    const gmpChanged = oldGmp !== newGmp;

    const oldSub =
      existing.totalSub === null || existing.totalSub === undefined
        ? null
        : Number(existing.totalSub);
    const newSub = dto.totalSub ?? null;
    const subscriptionChanged = oldSub !== newSub;

    return { gmp: gmpChanged, subscription: subscriptionChanged };
  }

  private safeParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async syncIpo(companyNameQuery: string): Promise<IPODataDTO> {
    const cleanQuery = companyNameQuery.trim();
    const cacheKey = `ipo_${cleanQuery.toLowerCase().replace(/\s+/g, '_')}`;
    const now = new Date();

    // 1. Check PostgreSQL cache first
    try {
      const [cached] = await this.db
        .select()
        .from(providerCache)
        .where(
          and(
            eq(providerCache.cacheKey, cacheKey),
            gt(providerCache.expiresAt, now),
          ),
        );

      if (cached && cached.payload) {
        this.logger.log(`[IpoSyncService] Cache HIT for IPO ${cleanQuery}`);
        return JSON.parse(cached.payload);
      }
    } catch (err) {
      // Non-blocking catch
    }

    this.logger.log(
      `[IpoSyncService] Cache MISS for IPO ${cleanQuery}. Fetching live IPO data.`,
    );

    // 2. Try the full external IPO API first (GMP, subscription, price band, dates)
    try {
      const liveIpo = await this.ipoProvider.getIpoDetails(cleanQuery);
      if (liveIpo) {
        this.logger.log(
          `[IpoSyncService] Full live IPO data found for ${cleanQuery} via ${this.ipoProvider.getProviderName()}`,
        );
        const dto = IPOMapper.toIPODTO(liveIpo);
        await this.persistCache(dto, cacheKey, now);
        return dto;
      }
    } catch (err: any) {
      this.logger.warn(
        `[IpoSyncService] External IPO lookup failed: ${err.message}`,
      );
    }

    // 3. No real IPO record exists for this query. NEVER fabricate an IPO from
    //    user/chat text and NEVER persist it into ipo_data / provider_cache —
    //    doing so previously let chat prompts such as "tell me the current" or
    //    "Should I apply for Swiggy" become IPO rows in the Hub. The real IPO
    //    provider (getIpoDetails above) is the ONLY source that may persist.
    //    Return an empty DTO so the AI reports the IPO as not found instead of
    //    inventing one.
    this.logger.warn(
      `[IpoSyncService] No real IPO data found for "${cleanQuery}". Returning not-found result (nothing persisted).`,
    );
    return IPOMapper.toIPODTO({});
  }

  /**
   * Current IPO feed for the IPO Hub. Date-based LIVE / UPCOMING classification
   * computed at RUNTIME in the Asia/Kolkata timezone — never a hardcoded date:
   *   - LIVE:     openDate <= today <= closeDate (valid dates + real name)
   *   - UPCOMING: openDate > today and closeDate valid (reliable upcoming only)
   *   - CLOSED:   closeDate < today (excluded from the current feed)
   * Records without a meaningful name or without valid open/close dates are
   * excluded too (this removes placeholder / speculative / contaminated rows).
   * Both lists are capped at 10, LIVE prioritized (sorted by openDate).
   */
  async getCurrentIpos(): Promise<{
    live: any[];
    upcoming: any[];
    todayKey: number;
    generatedAt: string;
    timezone: string;
  }> {
    const rows = await this.getIposFromDb();
    const todayKey = this.getKolkataTodayKey();
    const live: any[] = [];
    const upcoming: any[] = [];

    for (const row of rows) {
      if (!this.isMeaningfulIpoName(row.companyName)) continue;
      const openKey = this.parseDateKey(row.openDate);
      const closeKey = this.parseDateKey(row.closeDate);
      if (openKey === null || closeKey === null) continue; // undated → skip
      if (closeKey < todayKey) continue; // closed / past → skip

      const currentStatus: 'live' | 'upcoming' =
        openKey <= todayKey ? 'live' : 'upcoming';
      const item = {
        ...row,
        currentStatus,
        allotmentDate: row.allotmentFinalization || null,
      };
      (currentStatus === 'live' ? live : upcoming).push(item);
    }

    const byOpenDate = (a: any, b: any) =>
      (this.parseDateKey(a.openDate) ?? 0) -
      (this.parseDateKey(b.openDate) ?? 0);
    live.sort(byOpenDate);
    upcoming.sort(byOpenDate);

    return {
      live: live.slice(0, 10),
      upcoming: upcoming.slice(0, 10),
      todayKey,
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Kolkata',
    };
  }

  /** Today's date in Asia/Kolkata as an integer YYYYMMDD (runtime, no hardcoding). */
  private getKolkataTodayKey(): number {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return (
      Number(map.year) * 10000 + Number(map.month) * 100 + Number(map.day)
    );
  }

  /**
   * Robust date parser -> integer YYYYMMDD (or null).
   * Handles 'YYYY-MM-DD', 'DD-MM-YYYY' / 'DD/MM/YYYY' (Indian convention),
   * and 'Nov 27, 2024' / '27 Nov 2024' styles seen from providers.
   */
  private parseDateKey(value: any): number | null {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (this.isValidYmd(y, mo, d)) return y * 10000 + mo * 100 + d;
    }

    // DD-MM-YYYY / DD/MM/YYYY (common for Indian IPO dates).
    m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T ].*)?$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      if (this.isValidYmd(y, mo, d)) return y * 10000 + mo * 100 + d;
    }

    const MONTHS: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    // 'Nov 27, 2024'
    m = raw.match(/^([a-zA-Z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
    if (m) {
      const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
      const d = Number(m[2]);
      const y = Number(m[3]);
      if (mo && this.isValidYmd(y, mo, d)) return y * 10000 + mo * 100 + d;
    }

    // '27 Nov 2024'
    m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]{3,9})\.?\s+(\d{4})$/);
    if (m) {
      const d = Number(m[1]);
      const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
      const y = Number(m[3]);
      if (mo && this.isValidYmd(y, mo, d)) return y * 10000 + mo * 100 + d;
    }

    return null;
  }

  private isValidYmd(y: number, m: number, d: number): boolean {
    if (y < 1990 || y > 2100) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }

  /** A name must be a real-looking company name, not a chat sentence. */
  private isMeaningfulIpoName(name: any): boolean {
    const n = String(name || '').trim();
    if (!n || n.length < 3) return false;
    return !this.isContaminatedName(n);
  }

  /**
   * Detects chat-message contamination: raw user prompts that were persisted as
   * IPO company names (e.g. "tell me the current", "Should I apply for Swiggy").
   * The display filter (isMeaningfulIpoName) and the DB cleanup both use this.
   */
  private isContaminatedName(name: any): boolean {
    const n = String(name || '').trim();
    if (!n || n.length < 3) return true;
    const lower = ` ${n.toLowerCase()} `;

    // Strong chat-signal phrases — real IPO company names never contain these.
    const chatPhrases = [
      ' tell me ', ' what are ', ' what is ', ' why ', ' how ',
      ' should i ', ' should we ', ' can you ', ' evaluate ', ' give me ',
      ' i think ', ' okay', ' okey', ' please ', ' is it ', ' but when ',
      ' apply for ', ' apply in ', ' warning signs', ' ratios to check',
      ' the current ', ' top 5 ', ' top 3 ', ' you are my ', ' same question',
      ' in this ', ' about the ', ' current ipos', ' i already ',
    ];
    for (const phrase of chatPhrases) {
      if (lower.includes(phrase)) return true;
    }

    // Fallback: 3+ conversational stopwords in a multi-word name.
    const stop = new Set([
      'tell', 'me', 'my', 'you', 'your', 'what', 'why', 'how', 'should',
      'would', 'can', 'could', 'are', 'is', 'the', 'but', 'when', 'about',
      'give', 'ask', 'evaluate', 'think', 'current', 'top', 'warning', 'signs',
      'ratio', 'check', 'okay', 'ok', 'please', 'this', 'that', 'in', 'for',
      'it', 'i', 'we', 'they', 'then', 'so', 'there', 'not', 'any', 'same',
      'question', 'another', 'apply', 'buy', 'know', 'want', 'need', 'get',
      'from', 'with', 'some', 'these', 'those', 'has', 'have', 'was', 'were',
      'will', 'do', 'does', 'did', 'of', 'to', 'a', 'an', 'if', 'or', 'and',
      'its',
    ]);
    const words = lower
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^a-z]/g, ''));
    let hits = 0;
    for (const w of words) {
      if (stop.has(w)) hits++;
    }
    return hits >= 3;
  }

  /** Deletes only rows whose company name is demonstrably chat contamination. */
  private async cleanupContaminatedIpos(): Promise<number> {
    try {
      const rows = await this.db
        .select({ id: ipoData.id, companyName: ipoData.companyName })
        .from(ipoData);
      const ids = rows
        .filter((r) => this.isContaminatedName(r.companyName))
        .map((r) => r.id);
      if (ids.length === 0) return 0;
      await this.db.delete(ipoData).where(inArray(ipoData.id, ids));
      this.logger.warn(
        `[IPO CLEANUP] Removed ${ids.length} contaminated IPO records (chat text persisted as company names)`,
      );
      return ids.length;
    } catch (err: any) {
      this.logger.warn(`[IPO CLEANUP] Failed: ${err.message}`);
      return 0;
    }
  }

  private async persistCache(
    dto: IPODataDTO,
    cacheKey: string,
    now: Date,
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.cacheTtlSeconds * 1000);
      const symbol = this.resolveSymbol(dto);
      const values = this.buildIpoValues(dto, symbol, now);

      await this.db
        .insert(providerCache)
        .values({
          cacheKey,
          providerSource: 'IPO-API',
          payload: JSON.stringify(dto),
          fetchedAt: now,
          expiresAt,
          status: 'valid',
        })
        .onConflictDoUpdate({
          target: providerCache.cacheKey,
          set: {
            payload: JSON.stringify(dto),
            fetchedAt: now,
            expiresAt,
            status: 'valid',
          },
        });

      await this.db
        .insert(ipoData)
        .values(values)
        .onConflictDoUpdate({
          target: ipoData.symbol,
          set: this.buildConflictSet(now),
        });
    } catch (err) {
      // Non-blocking catch
    }
  }
}
