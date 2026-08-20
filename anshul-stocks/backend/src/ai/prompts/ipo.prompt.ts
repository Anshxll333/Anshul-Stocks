export const IPO_ANALYSIS_PROMPT_TEMPLATE = (
  companyName: string,
  context?: string
) => `
Please act as my Investment Mentor and analyze this IPO: ${companyName}.
${context ? `Here is the real IPO data retrieved from PostgreSQL for ${companyName}:\n${context}` : ''}

Strictly output your response inside a \`\`\`json block adhering to the IPO Analysis JSON schema.

Use ONLY the data provided in the context above. Map the PostgreSQL fields exactly:
- "priceRange" / "priceBand" / "issueUpperPrice" -> Issue Details & Price Band
- "lotSize", "minInvestment" -> Lot size & minimum investment
- "issueSizeCr", "totalIssueSize" -> Issue size (₹ Cr)
- "openDate", "closeDate", "listingDate" -> IPO dates
- "status" -> open / upcoming / closed / listed
- "gmp", "gmpGainPercent", "gmpDate" -> GMP and GMP %
- "retailSub", "qibSub", "niiSub", "totalSub" -> Subscription multiples
- "aboutCompany", "strengths", "risks", "drhpLink" -> DRHP summary, financials, key risks

NEVER invent data. If GMP, subscription, dates, issue size or any other metric is missing (null) in the context, set it to "Not available". Do NOT guess or fabricate numbers.
Cover the core IPO decision fields (IPO Rating /10, GMP, Subscription, Listing Probability, Recommendation: Apply/Avoid, Risk Level: Low/Moderate/High, Final Verdict 2-3 sentences) and populate the collapsible 'details' object (Issue Details, Retail Allocation, DRHP Summary, Financials, Key Risks, Full AI Explanation).
`;

export const IPO_LIST_ANALYSIS_PROMPT_TEMPLATE = (context?: string) => `
The user asked about the current/live/upcoming IPOs.

Here is the real IPO list retrieved from PostgreSQL:
${context || '[]'}

If the list is empty, clearly state that there are currently no open or upcoming IPOs synchronized in the database, and do NOT invent any IPO.
If the list is non-empty, present a concise Markdown list of the IPOs with: company name, symbol, status, price band/range, lot size, issue size (₹ Cr), open & close dates, GMP (or "Not available"), and subscription multiple (or "Not available").
Use ONLY the IPOs present in the list above. NEVER invent any IPO, GMP, subscription, or date.
`;
