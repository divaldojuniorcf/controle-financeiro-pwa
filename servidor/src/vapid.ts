// Autenticação VAPID (RFC 8292) para Web Push, só com WebCrypto.
// O envio é sem conteúdo (corpo vazio), então não há cifra de mensagem a fazer aqui.

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const texto = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** Cabeçalho Authorization para enviar um push ao `endpoint`. */
export async function autorizacaoVapid(
  endpoint: string,
  chavePrivadaJwk: JsonWebKey,
  chavePublica: string,
  assunto: string,
  agora = Date.now(),
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const corpo = `${texto({ typ: "JWT", alg: "ES256" })}.${texto({ aud, exp: Math.floor(agora / 1000) + 12 * 3600, sub: assunto })}`;
  const chave = await crypto.subtle.importKey("jwk", chavePrivadaJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, new TextEncoder().encode(corpo));
  return `vapid t=${corpo}.${b64url(assinatura)}, k=${chavePublica}`;
}

export async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
