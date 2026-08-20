/**
 * Normalized IPO data transfer object.
 *
 * This is the single contract shared between the IPO provider pipeline
 * (ExternalIpoApiProvider -> IPOMapper) and the persistence layer
 * (IpoSyncService -> ipo_data table).
 *
 * Null policy:
 * - Missing GMP / subscription / price data must remain NULL (never 0)
 *   so the AI Mentor can distinguish "not yet available" from "no demand".
 */
export interface IPODataDTO {
  // --- Basic IPO ---
  companyName: string;
  symbol?: string;
  exchange: string;
  ipoType?: string; // 'Mainboard' | 'SME'
  detailsUrl?: string;
  logoUrl?: string;
  exchanges?: string;

  // --- Pricing ---
  issuePrice?: number; // single price (numeric)
  priceBand: string; // legacy flat band e.g. '₹371 - ₹390'
  priceRange?: string; // ORIGINAL band string e.g. '₹151 – ₹159' (preserved verbatim)
  issueUpperPrice?: number; // safely parsed upper bound e.g. 159
  lotSize: number;
  minInvestment: number;
  issueSizeCr: number;
  totalIssueSize?: number; // Cr
  freshIssue?: number; // Cr
  offerForSale?: number; // Cr

  // --- Schedule ---
  openDate: string;
  closeDate: string;
  listingDate?: string;
  upiMandateDeadline?: string;
  allotmentFinalization?: string;
  refundInitiation?: string;
  shareCredit?: string;
  mandateEndDate?: string;
  lockInEndDateAnchor50?: string;
  lockInEndDateAnchorRemaining?: string;

  // --- Registrar / Quotas ---
  registrar: string;
  retailQuota: string;
  qibQuota: string;
  niiQuota: string;

  // --- Subscription (multiples). NULL when unavailable for upcoming IPOs ---
  retailSub: number;
  qibSub: number;
  niiSub: number;
  totalSub: number;
  instReserved?: number;
  instApplied?: number;
  instSub?: number;
  niiReserved?: number;
  niiApplied?: number;
  retailReserved?: number;
  retailApplied?: number;
  totalReserved?: number;
  totalApplied?: number;

  // --- GMP (NULL when the API has no GMP trend data) ---
  gmp?: number;
  gmpGainPercent?: number;
  gmpDate?: string;
  gmpSource?: string;
  gmpTrends?: any[] | null; // full history preserved for the AI Mentor

  listingGainPercent?: number;
  status: 'open' | 'upcoming' | 'closed' | 'listed';

  // --- Company information ---
  aboutCompany?: string;
  strengths?: string[] | null;
  risks?: string[] | null;
  drhpLink?: string;
  rhpLink?: string;
  utilizationOfProceeds?: any | null;
}
