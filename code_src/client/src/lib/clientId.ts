/**
 * 生成客户端唯一标识符
 * 
 * 优先使用现代浏览器的 `crypto.randomUUID()` API，
 * 如果不可用则降级使用 `crypto.getRandomValues()` 或 `Math.random()`
 * 
 * @param prefix - ID 前缀（默认为 "client"）
 * @returns 格式为 `${prefix}-${时间戳}-${随机数}` 的唯一标识符
 */
export function createClientId(prefix = "client") {
  const browserCrypto = globalThis.crypto;

  // 优先使用原生 UUID 生成器
  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  // 降级使用 getRandomValues
  const randomPart =
    typeof browserCrypto?.getRandomValues === "function"
      ? Array.from(browserCrypto.getRandomValues(new Uint32Array(2)))
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2);

  // 组合前缀、时间戳和随机数
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}