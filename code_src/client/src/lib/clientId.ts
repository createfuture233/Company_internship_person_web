export function createClientId(prefix = "client") {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  const randomPart =
    typeof browserCrypto?.getRandomValues === "function"
      ? Array.from(browserCrypto.getRandomValues(new Uint32Array(2)))
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2);

  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}
