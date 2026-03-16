import { generateCheckMacValue } from './ecpay.util';

describe('generateCheckMacValue', () => {
  // 使用綠界測試商店的已知 HashKey / HashIV
  const hashKey = 'pwFHCqoQZGmho4w6';
  const hashIV = 'EkRm7iFT261dpevs';

  it('should generate a 64-char uppercase hex string', () => {
    const result = generateCheckMacValue(
      { MerchantID: '3002607', TotalAmount: 100 },
      hashKey,
      hashIV,
    );
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9A-F]{64}$/);
  });

  it('should be deterministic (same input → same output)', () => {
    const params = { A: '1', B: '2', C: '3' };
    const result1 = generateCheckMacValue(params, hashKey, hashIV);
    const result2 = generateCheckMacValue(params, hashKey, hashIV);
    expect(result1).toBe(result2);
  });

  it('should produce different results for different params', () => {
    const result1 = generateCheckMacValue({ A: '1' }, hashKey, hashIV);
    const result2 = generateCheckMacValue({ A: '2' }, hashKey, hashIV);
    expect(result1).not.toBe(result2);
  });

  it('should sort keys case-insensitively', () => {
    const result1 = generateCheckMacValue({ aaa: '1', BBB: '2' }, hashKey, hashIV);
    const result2 = generateCheckMacValue({ BBB: '2', aaa: '1' }, hashKey, hashIV);
    expect(result1).toBe(result2);
  });
});
