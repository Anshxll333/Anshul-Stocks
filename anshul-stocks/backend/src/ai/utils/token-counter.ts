export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
