// Criptografia dos dados no aparelho: chave derivada do PIN (PBKDF2-SHA-256) e AES-GCM.
// Sem o PIN não há como ler os dados; o GCM também detecta PIN errado ou dado corrompido.

export const ITERACOES = 310_000;

export interface Cifrado {
  versao: 1;
  salt: Uint8Array;
  iv: Uint8Array;
  iteracoes: number;
  dados: ArrayBuffer;
}

export const PIN_VALIDO = /^\d{4,8}$/;

export async function derivarChave(pin: string, salt: Uint8Array, iteracoes = ITERACOES): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iteracoes, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function novoSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function cifrar(chave: CryptoKey, salt: Uint8Array, valor: unknown, iteracoes = ITERACOES): Promise<Cifrado> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(JSON.stringify(valor)));
  return { versao: 1, salt, iv, iteracoes, dados };
}

export class PinIncorreto extends Error {
  constructor() {
    super("PIN incorreto.");
  }
}

export async function decifrar<T>(chave: CryptoKey, c: Cifrado): Promise<T> {
  let claro: ArrayBuffer;
  try {
    claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: c.iv }, chave, c.dados);
  } catch {
    throw new PinIncorreto();
  }
  return JSON.parse(new TextDecoder().decode(claro)) as T;
}

/** Abre os dados com o PIN; devolve também a chave para as gravações seguintes. */
export async function abrirComPin<T>(pin: string, c: Cifrado): Promise<{ valor: T; chave: CryptoKey }> {
  const chave = await derivarChave(pin, c.salt, c.iteracoes);
  return { valor: await decifrar<T>(chave, c), chave };
}
