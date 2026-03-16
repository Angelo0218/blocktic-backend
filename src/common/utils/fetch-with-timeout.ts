/**
 * 帶 timeout 的 fetch wrapper。
 *
 * @param url - 請求 URL
 * @param options - fetch options
 * @param timeoutMs - 超時毫秒數（預設 15 秒）
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
