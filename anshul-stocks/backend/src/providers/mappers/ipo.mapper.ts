import { IPODataDTO } from '../dto/ipo-data.dto';

/**
 * Maps a normalized IPO record (from any provider) into the shared IPODataDTO.
 *
 * Handles two input shapes:
 *  1. Legacy flat records (e.g. TwelveData / Yahoo fallback): { companyName, issuePrice, ... }
 *  2. Normalized ExternalIpoApiProvider records (FinAPI shape flattened by the provider).
 *
 * Null policy:
 *  - Missing values map to NULL (never 0), so "unavailable" stays distinct
 *    from "no interest" for GMP and subscription figures.
 */
export class IPOMapper {
  /** Parses a numeric value out of strings like '₹16', '0.61x', '10.06%', '94'. */
  static parseNum(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const cleaned = String(val)
      .replace(/[₹,\s]/g, '')
      .replace(/[x%]/gi, '')
      .trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parses the upper bound of a range like '₹151 – ₹159' -> 159.
   * Tolerates currency symbols (₹ / Rs.) before either number, e.g.
   * FinAPI's '₹92 – ₹97'. Also falls back to a single fixed price
   * ('₹151' -> 151). Returns null when there is no price ('–').
   */
  static parseUpperPrice(range: any): number | null {
    if (range === null || range === undefined || range === '') return null;
    const raw = String(range).trim();
    if (!raw || raw === '–' || raw === '-' || raw === '—') return null;

    // Range like '₹92 – ₹97', '151 - 159', 'Rs. 92 – 97', '92–97'.
    const match = raw.match(
      /(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)\s*[–—-]\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)/i,
    );
    if (match) {
      const num = parseFloat(match[2].replace(/,/g, ''));
      return isNaN(num) ? null : num;
    }

    // Single fixed price like '₹151' or '151'.
    const single = raw.match(/(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d+)?)/i);
    if (single) {
      const num = parseFloat(single[1].replace(/,/g, ''));
      return isNaN(num) ? null : num;
    }

    return null;
  }

  /** Normalizes provider status values (LIVE, UPCOMING, ...) into app statuses. */
  static normalizeStatus(
    status: string | undefined | null,
  ): 'open' | 'upcoming' | 'closed' | 'listed' {
    const v = String(status || '').toLowerCase();
    if (v.includes('live') || v === 'open' || v.includes('active')) return 'open';
    if (v.includes('closed') || v.includes('closing')) return 'closed';
    if (v.includes('listed') || v.includes('recent')) return 'listed';
    // upcoming / filed / drhp / unknown -> treat as upcoming
    return 'upcoming';
  }

  static toIPODTO(raw: any): IPODataDTO {
    const parseNum = IPOMapper.parseNum;
    const hasRawData = Object.keys(raw || {}).length > 0;
    const name =
      raw.companyName ||
      raw.name ||
      (hasRawData ? 'Target IPO Company' : null);
    const lower = (name || '').toLowerCase();

    let priceBand = raw.priceBand || null;
    let lotSize = parseNum(raw.lotSize);
    let minInvestment = parseNum(raw.minInvestment);
    let issueSizeCr = parseNum(raw.issueSizeCr ?? raw.issueSize);
    let gmp = parseNum(raw.gmp);
    let listingGainPercent = parseNum(raw.listingGainPercent);
    let totalSub = parseNum(raw.totalSub);
    let qibSub = parseNum(raw.qibSub);
    let niiSub = parseNum(raw.niiSub);
    let retailSub = parseNum(raw.retailSub);
    let symbol = raw.symbol ? String(raw.symbol).toUpperCase() : undefined;
    const openDate = raw.openDate || null;
    const closeDate = raw.closeDate || null;
    let listingDate = raw.listingDate || null;
    let registrar = raw.registrar || null;

    // GMP: preserve the latest entry + full trend history.
    // When the API returns greyMarketPremium.gmpTrends = null, gmp stays NULL.
    const gmpTrends = Array.isArray(raw.gmpTrends) ? raw.gmpTrends : null;
    const latestGmp = gmpTrends && gmpTrends.length > 0 ? gmpTrends[0] : null;
    const gmpFromTrend = latestGmp ? parseNum(latestGmp.gmp) : null;
    const gmpGainFromTrend = latestGmp ? parseNum(latestGmp.gain) : null;
    const gmpDateFromTrend = latestGmp?.date || null;

    // Price range: keep the ORIGINAL string + safely parse the upper bound.
    const priceRange = raw.priceRange || raw.priceBand || null;
    const issueUpperPrice =
      raw.issueUpperPrice ?? IPOMapper.parseUpperPrice(priceRange);

    return {
      companyName: name || raw.companyName || raw.name || null,
      symbol: symbol || undefined,
      exchange: raw.exchange || (hasRawData ? 'NSE / BSE' : null),
      ipoType: raw.ipoType || raw.category || undefined,
      detailsUrl: raw.detailsUrl || undefined,
      logoUrl: raw.logoUrl || undefined,
      exchanges: raw.exchanges || undefined,
      issuePrice: parseNum(raw.issuePrice) as any,
      priceBand: priceBand,
      priceRange: priceRange || undefined,
      issueUpperPrice: issueUpperPrice as any,
      lotSize: lotSize as any,
      minInvestment: minInvestment as any,
      issueSizeCr: issueSizeCr as any,
      totalIssueSize: parseNum(raw.totalIssueSize) as any,
      freshIssue: parseNum(raw.freshIssue) as any,
      offerForSale: parseNum(raw.offerForSale) as any,
      openDate: openDate,
      closeDate: closeDate,
      listingDate: listingDate,
      upiMandateDeadline: raw.upiMandateDeadline || undefined,
      allotmentFinalization: raw.allotmentFinalization || undefined,
      refundInitiation: raw.refundInitiation || undefined,
      shareCredit: raw.shareCredit || undefined,
      mandateEndDate: raw.mandateEndDate || undefined,
      lockInEndDateAnchor50: raw.lockInEndDateAnchor50 || undefined,
      lockInEndDateAnchorRemaining:
        raw.lockInEndDateAnchorRemaining || undefined,
      registrar: registrar,
      retailQuota: raw.retailQuota || null,
      qibQuota: raw.qibQuota || null,
      niiQuota: raw.niiQuota || null,
      retailSub: retailSub as any,
      qibSub: qibSub as any,
      niiSub: niiSub as any,
      totalSub: totalSub as any,
      instReserved: parseNum(raw.instReserved) as any,
      instApplied: parseNum(raw.instApplied) as any,
      instSub: parseNum(raw.instSub) as any,
      niiReserved: parseNum(raw.niiReserved) as any,
      niiApplied: parseNum(raw.niiApplied) as any,
      retailReserved: parseNum(raw.retailReserved) as any,
      retailApplied: parseNum(raw.retailApplied) as any,
      totalReserved: parseNum(raw.totalReserved) as any,
      totalApplied: parseNum(raw.totalApplied) as any,
      gmp: (gmpFromTrend ?? gmp) as any,
      gmpGainPercent: (gmpGainFromTrend ?? parseNum(raw.gmpGainPercent)) as any,
      gmpDate: gmpDateFromTrend || raw.gmpDate || undefined,
      gmpSource: raw.gmpSource || undefined,
      gmpTrends: gmpTrends,
      listingGainPercent: listingGainPercent as any,
      status: IPOMapper.normalizeStatus(raw.status),
      aboutCompany: raw.aboutCompany || undefined,
      strengths: Array.isArray(raw.strengths) ? raw.strengths : null,
      risks: Array.isArray(raw.risks) ? raw.risks : null,
      drhpLink: raw.drhpLink || undefined,
      rhpLink: raw.rhpLink || undefined,
      utilizationOfProceeds: raw.utilizationOfProceeds || null,
    };
  }
}
