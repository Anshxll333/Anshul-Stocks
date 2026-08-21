import {
  repairDecisionJsonBlock,
  extractBalancedDecisionJson,
  repairTruncatedJsonObject,
} from './json-repair';

describe('json-repair', () => {
  describe('extractBalancedDecisionJson', () => {
    it('extracts a balanced JSON object wrapped in prose', () => {
      const content =
        'Here is your analysis:\n```json\n{"type": "stock", "companyName": "Bank of India Limited"}\n```\nEnjoy!';
      const result = extractBalancedDecisionJson(content);
      expect(result).toBe(
        '{"type": "stock", "companyName": "Bank of India Limited"}',
      );
    });

    it('returns null when the object is truncated (unbalanced)', () => {
      const content =
        '{"type": "stock", "companyName": "Bank of India Limited", "key": "unclosed';
      expect(extractBalancedDecisionJson(content)).toBeNull();
    });
  });

  describe('repairTruncatedJsonObject', () => {
    it('closes open braces after a complete trailing value', () => {
      const repaired = repairTruncatedJsonObject(
        '{"type": "stock", "companyName": "X", "rating": 7.5',
      );
      expect(repaired).toBe(
        '{"type": "stock", "companyName": "X", "rating": 7.5}',
      );
      expect(JSON.parse(repaired!).type).toBe('stock');
    });

    it('drops a dangling key/value pair that lost its value mid-string', () => {
      const partial =
        '{"type": "stock", "companyName": "Bank of India Limited", "currentPrice": "₹145.00", "detailedInfoPrompt": "If you want detailed';
      const repaired = repairTruncatedJsonObject(partial);
      expect(repaired).not.toBeNull();
      const parsed = JSON.parse(repaired!);
      expect(parsed.type).toBe('stock');
      expect(parsed.companyName).toBe('Bank of India Limited');
      expect(parsed.currentPrice).toBe('₹145.00');
      expect(parsed.detailedInfoPrompt).toBeUndefined();
    });

    it('drops a dangling key with no value at all', () => {
      const partial = '{"type": "stock", "companyName": "X", "bottomLine":';
      const repaired = repairTruncatedJsonObject(partial);
      expect(repaired).not.toBeNull();
      expect(JSON.parse(repaired!).bottomLine).toBeUndefined();
    });

    it('closes an unclosed array', () => {
      const repaired = repairTruncatedJsonObject(
        '{"type": "stock", "keyRisks": ["Risk 1", "Risk 2"',
      );
      expect(repaired).not.toBeNull();
      expect(JSON.parse(repaired!).keyRisks).toEqual(['Risk 1', 'Risk 2']);
    });

    it('returns null for garbage that cannot be repaired', () => {
      expect(repairTruncatedJsonObject('not json at all')).toBeNull();
    });
  });

  describe('repairDecisionJsonBlock', () => {
    it('leaves a complete, parseable response unchanged', () => {
      const input =
        '```json\n{"type": "stock", "companyName": "X"}\n```\n\nAll good.';
      expect(repairDecisionJsonBlock(input)).toBe(input);
    });

    it('repairs the exact user-facing truncation and keeps prose prefix', () => {
      const input =
        'Here is your decision card:\n```json\n{"type": "stock", "companyName": "Bank of India Limited", "currentPrice": "₹145.00", "detailedInfoPrompt": "If you want detailed';
      const repaired = repairDecisionJsonBlock(input);
      expect(repaired).toContain('Here is your decision card:');
      expect(repaired).toContain('"type": "stock"');
      // Repaired JSON must be parseable somewhere in the output
      const parsed = JSON.parse(
        repaired.substring(
          repaired.indexOf('{'),
          repaired.lastIndexOf('}') + 1,
        ),
      );
      expect(parsed.companyName).toBe('Bank of India Limited');
      expect(parsed.currentPrice).toBe('₹145.00');
    });

    it('closes a dangling code fence after repair', () => {
      const input =
        '```json\n{"type": "ipo", "companyName": "IPO Co", "finalVerdict": "Truncated verdict';
      const repaired = repairDecisionJsonBlock(input);
      const fenceCount = (repaired.match(/```/g) || []).length;
      expect(fenceCount % 2).toBe(0);
    });

    it('returns input unchanged when it contains no decision JSON', () => {
      const input = 'What is the P/E ratio?';
      expect(repairDecisionJsonBlock(input)).toBe(input);
    });
  });
});
