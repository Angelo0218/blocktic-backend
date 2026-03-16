import { createHash } from 'crypto';

/**
 * 綠界 ECPay CheckMacValue 產生工具。
 *
 * 演算法（SHA256）：
 * 1. 所有參數依 key 字母排序
 * 2. 組成 key=value& 字串
 * 3. 前後加上 HashKey= 和 &HashIV=
 * 4. URL encode（小寫）
 * 5. 轉小寫後 SHA256 → 轉大寫
 *
 * 參考：https://developers.ecpay.com.tw/?p=2902
 */
export function generateCheckMacValue(
  params: Record<string, string | number>,
  hashKey: string,
  hashIV: string,
): string {
  // Step 1: 按 key 排序
  const sorted = Object.keys(params)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Step 2: 前後加 HashKey / HashIV
  const raw = `HashKey=${hashKey}&${sorted}&HashIV=${hashIV}`;

  // Step 3: URL encode（依綠界規範特殊字元替換）
  let encoded = encodeURIComponent(raw)
    .replace(/%20/g, '+')
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');

  // Step 4: 轉小寫
  encoded = encoded.toLowerCase();

  // Step 5: SHA256 → 轉大寫
  return createHash('sha256').update(encoded).digest('hex').toUpperCase();
}
