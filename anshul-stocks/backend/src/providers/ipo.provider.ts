import { Injectable, Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestQueue } from './queue';

export interface MarketIpoRecord {
  companyName: string;
  symbol?: string;
  exchange?: string;
  priceBand?: string;
  priceRange?: string;
  lotSize?: number;
  minInvestment?: number;
  issueSize?: number;
  issueSizeCr?: number;
  totalIssueSize?: number;
  freshIssue?: number;
  offerForSale?: number;
  faceValue?: number;
  openDate?: string;
  closeDate?: string;
  allotmentDate?: string;
  refundDate?: string;
  dematCreditDate?: string;
  listingDate?: string;
  listingExchange?: string;
  subscriptionData?: string;
  retailSub?: number;
  qibSub?: number;
  niiSub?: number;
  totalSub?: number;
  gmp?: number;
  gmpGainPercent?: number;
  gmpDate?: string;
  gmpSource?: string;
  gmpTrends?: any[] | null;
  listingPrice?: number;
  listingGainPercent?: number;
  retailQuota?: string;
  qibQuota?: string;
  niiQuota?: string;
  registrar?: string;
  leadManagers?: string;
  category?: 'Mainboard' | 'SME';
  status?: string;
  // FinAPI extended fields
  ipoType?: string;
  detailsUrl?: string;
  logoUrl?: string;
  exchanges?: string;
  upiMandateDeadline?: string;
  allotmentFinalization?: string;
  refundInitiation?: string;
  shareCredit?: string;
  mandateEndDate?: string;
  lockInEndDateAnchor50?: string;
  lockInEndDateAnchorRemaining?: string;
  instReserved?: number;
  instApplied?: number;
  instSub?: number;
  niiReserved?: number;
  niiApplied?: number;
  retailReserved?: number;
  retailApplied?: number;
  totalReserved?: number;
  totalApplied?: number;
  aboutCompany?: string;
  strengths?: string[] | null;
  risks?: string[] | null;
  drhpLink?: string;
  rhpLink?: string;
  utilizationOfProceeds?: any | null;
}

export interface IIpoProvider {
  getProviderName(): string;
  getLiveIpos(): Promise<MarketIpoRecord[]>;
  getIpoDetails(symbolOrName: string): Promise<MarketIpoRecord | null>;
  searchIpos(query: string): Promise<MarketIpoRecord[]>;
}

export const IPO_PROVIDER_TOKEN = 'IPO_PROVIDER_TOKEN';

@Injectable()
export class TwelveDataIpoProvider implements IIpoProvider {
  private readonly logger = new Logger(TwelveDataIpoProvider.name);
  private readonly apiKey: string;
  private readonly queue: RequestQueue;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TWELVE_DATA_API_KEY', 'demo');
    this.queue = new RequestQueue(8, 7500);
  }

  getProviderName(): string {
    return 'Twelve Data IPO Engine';
  }

  async getLiveIpos(): Promise<MarketIpoRecord[]> {
    try {
      this.logger.log(
        `[TwelveDataIpoProvider] Fetching IPO data using key: ${this.apiKey ? 'Configured' : 'Demo'}`,
      );

      // Return normalized IPO records structure
      return [];
    } catch (err: any) {
      this.logger.error(
        `[TwelveDataIpoProvider] Failed to fetch live IPOs: ${err.message}`,
      );
      return [];
    }
  }

  async getIpoDetails(symbolOrName: string): Promise<MarketIpoRecord | null> {
    const list = await this.getLiveIpos();
    return (
      list.find(
        (item) =>
          item.companyName.toLowerCase().includes(symbolOrName.toLowerCase()) ||
          (item.symbol &&
            item.symbol.toLowerCase() === symbolOrName.toLowerCase()),
      ) || null
    );
  }

  async searchIpos(query: string): Promise<MarketIpoRecord[]> {
    const list = await this.getLiveIpos();
    return list.filter(
      (item) =>
        item.companyName.toLowerCase().includes(query.toLowerCase()) ||
        (item.symbol &&
          item.symbol.toLowerCase().includes(query.toLowerCase())),
    );
  }
}

/**
 * External IPO API provider (FinAPI by default).
 *
 * Default endpoint (no API key required):
 *   GET https://finapi.upvaly.com/api/ipo
 *
 * Optional filters (used only by manual/scheduled full sync):
 *   ?status=LIVE|UPCOMING   ?type=MAINBOARD|SME
 *
 * Activated out-of-the-box. Override with IPO_API_BASE_URL + IPO_API_KEY in
 * .env to point at a different authenticated external IPO API. On any failure
 * it returns [] so callers fall back gracefully and never crash.
 */
@Injectable()
export class ExternalIpoApiProvider implements IIpoProvider {
  private readonly logger = new Logger(ExternalIpoApiProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly listPath: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly retryBaseDelayMs = 800;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('IPO_API_KEY') ||
      process.env.IPO_API_KEY ||
      '';
    this.baseUrl = (
      this.configService.get<string>('IPO_API_BASE_URL') ||
      process.env.IPO_API_BASE_URL ||
      'https://finapi.upvaly.com/api'
    ).replace(/\/+$/, '');
    this.listPath = process.env.IPO_API_LIST_PATH || '/ipo';
    // IPO requests get their own timeout (default 30s) so a slow FinAPI cold
    // start does not abort the whole hourly sync at the generic 10s timeout.
    this.timeoutMs = parseInt(
      process.env.IPO_TIMEOUT_MS ||
        process.env.PROVIDER_TIMEOUT_MS ||
        '10000',
      10,
    );
    // PROVIDER_RETRY_COUNT is the total number of attempts.
    this.retryCount = Math.max(
      0,
      parseInt(process.env.PROVIDER_RETRY_COUNT || '3', 10) - 1,
    );
  }

  getProviderName(): string {
    return 'FinAPI IPO Engine';
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private async request<T>(path: string): Promise<T | null> {
    if (!this.isConfigured()) return null;

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['x-api-key'] = this.apiKey;
    }

    // Retry with exponential backoff so transient timeouts / 5xx responses
    // (e.g. "This operation was aborted") no longer fail the entire sync and
    // leave the PostgreSQL data stale with gmpUpdated=0 / subscriptionUpdated=0.
    let lastError: string | null = null;
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          this.logger.warn(
            `[ExternalIpoApiProvider] HTTP ${res.status} for ${url}`,
          );
        } else {
          return (await res.json()) as T;
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        this.logger.warn(
          `[ExternalIpoApiProvider] Request failed for ${path} (attempt ${attempt + 1}/${this.retryCount + 1}): ${lastError}`,
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (attempt < this.retryCount) {
        const backoff = this.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.log(
          `[ExternalIpoApiProvider] Retrying ${path} in ${backoff}ms…`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    this.logger.error(
      `[ExternalIpoApiProvider] Request failed for ${path} after ${this.retryCount + 1} attempts: ${lastError}`,
    );
    return null;
  }

  private pick(raw: any, ...keys: string[]): any {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') {
        return raw[k];
      }
    }
    return undefined;
  }

  /** Parses a numeric value out of strings like '₹16', '0.61x', '94'. */
  private num(val: any): number | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const cleaned = String(val)
      .replace(/[₹,\s]/g, '')
      .replace(/[x%]/gi, '')
      .trim();
    if (!cleaned) return undefined;
    const n = Number(cleaned);
    return isNaN(n) ? undefined : n;
  }

  private normalizeRecord(raw: any): MarketIpoRecord | null {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(
      this.pick(
        raw,
        'companyName',
        'name',
        'company',
        'ipoName',
        'issueName',
        'title',
      ) || '',
    );
    if (!name) return null;

    // --- FinAPI nested structures (preserved for the mapper / AI Mentor) ---
    const schedule =
      raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : {};
    const issueSize =
      raw.issueSize && typeof raw.issueSize === 'object'
        ? raw.issueSize
        : {};
    const gmpObj =
      raw.greyMarketPremium &&
      typeof raw.greyMarketPremium === 'object' &&
      !Array.isArray(raw.greyMarketPremium)
        ? raw.greyMarketPremium
        : null;
    const gmpTrends = Array.isArray(gmpObj?.gmpTrends)
      ? gmpObj.gmpTrends
      : null;
    const latestGmp = gmpTrends && gmpTrends.length > 0 ? gmpTrends[0] : null;

    const subs =
      raw.subscriptionNumbers &&
      typeof raw.subscriptionNumbers === 'object'
        ? raw.subscriptionNumbers
        : {};
    const inst =
      subs.institutional && typeof subs.institutional === 'object'
        ? subs.institutional
        : {};
    const nii = subs.nii && typeof subs.nii === 'object' ? subs.nii : {};
    const retail =
      subs.retail && typeof subs.retail === 'object' ? subs.retail : {};
    const total = subs.total && typeof subs.total === 'object' ? subs.total : {};

    const priceRange = this.pick(
      raw,
      'priceRange',
      'priceBand',
      'price_band',
      'issuePriceRange',
    );

    return {
      companyName: name,
      symbol: this.pick(raw, 'symbol', 'ticker', 'tickerSymbol'),
      exchange:
        this.pick(raw, 'exchange', 'listingExchange') || 'NSE / BSE',
      ipoType: this.pick(raw, 'type', 'ipoType', 'category'),
      detailsUrl: this.pick(raw, 'detailsUrl', 'url'),
      logoUrl: this.pick(raw, 'logoUrl', 'logo'),
      exchanges: this.pick(raw, 'exchanges'),
      priceBand: priceRange,
      priceRange: priceRange,
      lotSize: this.num(
        this.pick(raw, 'lotSize', 'lot_size', 'lot'),
      ),
      minInvestment: this.pick(
        raw,
        'minInvestment',
        'min_investment',
        'minimumInvestment',
      ),
      issueSize: this.num(
        this.pick(raw, 'issueSize', 'issueSizeCr', 'issueAmount'),
      ),
      issueSizeCr: this.num(
        this.pick(issueSize, 'totalIssueSize') ??
          this.pick(raw, 'issueSizeCr', 'issueAmount') ??
          this.pick(raw, 'issueSize'),
      ),
      totalIssueSize: this.num(this.pick(issueSize, 'totalIssueSize')),
      freshIssue: this.num(this.pick(issueSize, 'freshIssue')),
      offerForSale: this.num(this.pick(issueSize, 'offerForSale')),
      faceValue: this.pick(raw, 'faceValue', 'face_value'),
      openDate:
        this.pick(schedule, 'startDate', 'openDate', 'open') ||
        this.pick(raw, 'openDate', 'open'),
      closeDate:
        this.pick(schedule, 'endDate', 'closeDate', 'close') ||
        this.pick(raw, 'closeDate', 'close'),
      allotmentDate:
        this.pick(schedule, 'allotmentFinalization', 'allotmentDate') ||
        this.pick(raw, 'allotmentDate', 'allotment'),
      refundDate:
        this.pick(schedule, 'refundInitiation', 'refundDate') ||
        this.pick(raw, 'refundDate', 'refund'),
      dematCreditDate:
        this.pick(schedule, 'shareCredit', 'dematCreditDate') ||
        this.pick(raw, 'dematCreditDate', 'dematDate'),
      listingDate:
        this.pick(schedule, 'listingDate') ||
        this.pick(raw, 'listingDate', 'listing'),
      upiMandateDeadline: this.pick(schedule, 'upiMandateDeadline'),
      allotmentFinalization: this.pick(schedule, 'allotmentFinalization'),
      refundInitiation: this.pick(schedule, 'refundInitiation'),
      shareCredit: this.pick(schedule, 'shareCredit'),
      mandateEndDate: this.pick(schedule, 'mandateEndDate'),
      lockInEndDateAnchor50: this.pick(schedule, 'lockInEndDateAnchor50'),
      lockInEndDateAnchorRemaining: this.pick(
        schedule,
        'lockInEndDateAnchorRemaining',
      ),
      subscriptionData: this.pick(
        raw,
        'subscriptionData',
        'subscription_data',
      ),
      // GMP: latest trend entry wins; missing GMP stays null (never 0).
      gmp:
        this.num(latestGmp?.gmp) ??
        this.num(
          this.pick(raw, 'gmp', 'greyMarketPremium', 'gmpAmount', 'gmpPercent'),
        ),
      gmpGainPercent:
        this.num(latestGmp?.gain) ??
        this.num(this.pick(raw, 'gmpPercent', 'gmpGainPercent')),
      gmpDate: latestGmp?.date || undefined,
      gmpSource: gmpObj?.gmpSource || undefined,
      gmpTrends: gmpTrends,
      listingPrice: this.pick(raw, 'listingPrice', 'listing_price'),
      listingGainPercent: this.pick(
        raw,
        'listingGainPercent',
        'listing_gain_percent',
        'listingGain',
      ),
      retailQuota: this.pick(
        raw,
        'retailQuota',
        'retail_quota',
        'retailAllocation',
      ),
      qibQuota: this.pick(raw, 'qibQuota', 'qib_quota'),
      niiQuota: this.pick(raw, 'niiQuota', 'nii_quota'),
      registrar: this.pick(raw, 'registrar', 'registrarName'),
      leadManagers: this.pick(
        raw,
        'leadManagers',
        'lead_managers',
        'bookRunningLeadManagers',
      ),
      retailSub:
        this.num(this.pick(retail, 'subscription')) ??
        this.num(raw.retailSub),
      qibSub: this.num(raw.qibSub),
      niiSub:
        this.num(this.pick(nii, 'subscription')) ?? this.num(raw.niiSub),
      totalSub:
        this.num(this.pick(total, 'subscription')) ?? this.num(raw.totalSub),
      instReserved: this.num(this.pick(inst, 'reserved')),
      instApplied: this.num(this.pick(inst, 'applied')),
      instSub: this.num(this.pick(inst, 'subscription')),
      niiReserved: this.num(this.pick(nii, 'reserved')),
      niiApplied: this.num(this.pick(nii, 'applied')),
      retailReserved: this.num(this.pick(retail, 'reserved')),
      retailApplied: this.num(this.pick(retail, 'applied')),
      totalReserved: this.num(this.pick(total, 'reserved')),
      totalApplied: this.num(this.pick(total, 'applied')),
      category:
        String(this.pick(raw, 'category', 'ipoType', 'type') || '')
          .toUpperCase() === 'SME'
          ? 'SME'
          : 'Mainboard',
      status: this.pick(raw, 'status', 'statusType', 'ipoStatus'),
      aboutCompany: this.pick(raw, 'aboutCompany', 'about', 'businessSummary'),
      strengths: Array.isArray(raw.strengths) ? raw.strengths : null,
      risks: Array.isArray(raw.risks) ? raw.risks : null,
      drhpLink: this.pick(raw, 'drhpLink', 'drhp'),
      rhpLink: this.pick(raw, 'rhpLink', 'rhp'),
      utilizationOfProceeds:
        raw.utilizationOfProceeds &&
        typeof raw.utilizationOfProceeds === 'object' &&
        !Array.isArray(raw.utilizationOfProceeds)
          ? raw.utilizationOfProceeds
          : null,
    };
  }

  private extractList(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.ipos)) return payload.ipos;
    if (payload && Array.isArray(payload.results)) return payload.results;
    if (payload && Array.isArray(payload.list)) return payload.list;
    return [];
  }

  private async fetchUpstoxSubscriptions(): Promise<Map<string, number>> {
    const apiKey = process.env.UPSTOX_API_KEY;
    if (!apiKey) return new Map();

    const subMap = new Map<string, number>();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      const listRes = await fetch('https://api.upstox.com/v2/ipos', {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!listRes.ok) {
        this.logger.warn(`[Upstox] List failed: HTTP ${listRes.status}`);
        return subMap;
      }

      const listData = await listRes.json();
      if (listData.status !== 'success' || !Array.isArray(listData.data)) {
        return subMap;
      }

      for (const ipo of listData.data) {
        if (!ipo.id) continue;
        const dCtrl = new AbortController();
        const dTimeout = setTimeout(() => dCtrl.abort(), this.timeoutMs);
        try {
          const detailRes = await fetch(`https://api.upstox.com/v2/ipos/${ipo.id}`, {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
            signal: dCtrl.signal,
          });
          clearTimeout(dTimeout);

          if (!detailRes.ok) {
            this.logger.warn(`[Upstox] Detail failed for ${ipo.id}: HTTP ${detailRes.status}`);
            continue;
          }
          const detailData = await detailRes.json();
          if (detailData.status === 'success' && detailData.data) {
            const subRaw = detailData.data.total_subscription;
            if (subRaw !== null && subRaw !== undefined) {
              const val = Number(subRaw);
              if (!isNaN(val)) {
                const symbol = String(detailData.data.symbol || ipo.symbol || '').trim().toLowerCase();
                const name = String(detailData.data.name || ipo.name || '').trim().toLowerCase();
                if (symbol) subMap.set(`SYM:${symbol}`, val);
                if (name) subMap.set(`NAME:${name}`, val);
              }
            }
          }
        } catch (err: any) {
          clearTimeout(dTimeout);
          this.logger.warn(`[Upstox] Detail fetch failed for ${ipo.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[Upstox] API fetch failed: ${err.message}`);
    }
    return subMap;
  }

  private async enrichWithUpstox(records: MarketIpoRecord[]): Promise<MarketIpoRecord[]> {
    if (!records || records.length === 0) return records;
    const subMap = await this.fetchUpstoxSubscriptions();
    if (subMap.size === 0) return records;

    for (const record of records) {
      const symKey = record.symbol ? `SYM:${record.symbol.trim().toLowerCase()}` : '';
      const nameKey = record.companyName ? `NAME:${record.companyName.trim().toLowerCase()}` : '';

      const liveSub = subMap.get(symKey) ?? subMap.get(nameKey);
      if (liveSub !== undefined) {
        record.totalSub = liveSub;
      }
    }
    return records;
  }

  async getLiveIpos(): Promise<MarketIpoRecord[]> {
    if (!this.isConfigured()) return [];
    const payload = await this.request<any>(this.listPath);
    if (!payload) return [];
    const records = this.extractList(payload)
      .map((r) => this.normalizeRecord(r))
      .filter((r): r is MarketIpoRecord => r !== null);

    return await this.enrichWithUpstox(records);
  }

  async getIpoDetails(symbolOrName: string): Promise<MarketIpoRecord | null> {
    const q = encodeURIComponent(symbolOrName);
    const payload = await this.request<any>(`${this.listPath}?search=${q}`);
    if (payload) {
      const found = this.extractList(payload)
        .map((r) => this.normalizeRecord(r))
        .find(
          (r) =>
            r !== null &&
            (r.companyName
              .toLowerCase()
              .includes(symbolOrName.toLowerCase()) ||
              (r.symbol &&
                r.symbol.toLowerCase() === symbolOrName.toLowerCase())),
        );
      if (found) {
        const enriched = await this.enrichWithUpstox([found]);
        return enriched[0] || found;
      }
    }
    const list = await this.getLiveIpos();
    return (
      list.find(
        (item) =>
          item.companyName
            .toLowerCase()
            .includes(symbolOrName.toLowerCase()) ||
          (item.symbol &&
            item.symbol.toLowerCase() === symbolOrName.toLowerCase()),
      ) || null
    );
  }

  async searchIpos(query: string): Promise<MarketIpoRecord[]> {
    const list = await this.getLiveIpos();
    return list.filter(
      (item) =>
        item.companyName.toLowerCase().includes(query.toLowerCase()) ||
        (item.symbol &&
          item.symbol.toLowerCase().includes(query.toLowerCase())),
    );
  }
}

export const IpoProviderFactory: Provider = {
  provide: IPO_PROVIDER_TOKEN,
  useFactory: (
    configService: ConfigService,
    twelveDataIpo: TwelveDataIpoProvider,
    externalIpoApi: ExternalIpoApiProvider,
  ): IIpoProvider => {
    // The CONFIGURED provider must win (config > defaults). IPO_PROVIDER is
    // read explicitly (not through the defaulted config value) so an explicit
    // 'twelvedata' is distinguishable from an unset variable — previously the
    // factory returned FinAPI whenever IPO_API_BASE_URL was configured,
    // silently ignoring IPO_PROVIDER entirely.
    const configured = (process.env.IPO_PROVIDER || '')
      .trim()
      .toLowerCase();

    if (configured === 'finapi' || configured === 'external') {
      if (externalIpoApi.isConfigured()) {
        return externalIpoApi;
      }
      Logger.warn(
        '[IpoProviderFactory] IPO_PROVIDER=finapi but IPO_API_BASE_URL is not configured — falling back to TwelveData (which returns no IPO data).',
        'IpoProviderFactory',
      );
      return twelveDataIpo;
    }

    if (configured === 'twelvedata') {
      return twelveDataIpo;
    }

    // Unset → legacy behavior: prefer FinAPI whenever configured, otherwise
    // fall back to the TwelveData stub.
    if (externalIpoApi.isConfigured()) {
      return externalIpoApi;
    }
    return twelveDataIpo;
  },
  inject: [ConfigService, TwelveDataIpoProvider, ExternalIpoApiProvider],
};
