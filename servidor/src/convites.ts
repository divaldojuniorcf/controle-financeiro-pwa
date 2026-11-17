// Convites: cada código libera o app em 1 aparelho; o dono pode bloquear a qualquer momento.
import { sha256Hex } from "./vapid";

export interface KV {
  get(chave: string): Promise<string | null>;
  put(chave: string, valor: string): Promise<void>;
  delete(chave: string): Promise<void>;
  list(op: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Convite {
  codigo: string;
  /** Nome que o dono deu ao convite (ex.: "amigo-joão"). */
  nome: string;
  criadoEm: number;
  bloqueado: boolean;
  /** Identificador aleatório do aparelho que usou o convite (null = livre). */
  aparelho: string | null;
  /** SHA-256 do segredo entregue ao aparelho. */
  tokenHash: string | null;
  ativadoEm: number | null;
  ultimoAcesso: number | null;
  /** id do aparelho no servidor de lembretes, para parar os avisos ao bloquear. */
  lembrete: string | null;
}

export const PREFIXO_CONVITE = "c:";
/** Sem 0/O e 1/I, para não confundir ao digitar. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Grava "último acesso" no máximo a cada 12 h (poupa gravações do plano grátis). */
const INTERVALO_ACESSO_MS = 12 * 3_600_000;

export function normalizarCodigo(c: unknown): string {
  return typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export function formatarCodigo(c: string): string {
  return c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

export function gerarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}

function gerarToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function lerConvite(kv: KV, codigo: string): Promise<Convite | null> {
  const bruto = await kv.get(PREFIXO_CONVITE + normalizarCodigo(codigo));
  return bruto ? (JSON.parse(bruto) as Convite) : null;
}

async function gravar(kv: KV, c: Convite): Promise<void> {
  await kv.put(PREFIXO_CONVITE + c.codigo, JSON.stringify(c));
}

export type ResultadoUso =
  | { situacao: "ok"; token: string; codigo: string }
  | { situacao: "invalido" | "bloqueado" | "em-uso" };

/** Primeira abertura num aparelho novo: prende o convite a este aparelho. */
export async function usarConvite(kv: KV, codigo: string, aparelho: string, agora = Date.now()): Promise<ResultadoUso> {
  const c = await lerConvite(kv, codigo);
  if (!c) return { situacao: "invalido" };
  if (c.bloqueado) return { situacao: "bloqueado" };
  if (c.aparelho && c.aparelho !== aparelho) return { situacao: "em-uso" };
  const token = gerarToken();
  await gravar(kv, { ...c, aparelho, tokenHash: await sha256Hex(token), ativadoEm: c.ativadoEm ?? agora, ultimoAcesso: agora });
  return { situacao: "ok", token, codigo: c.codigo };
}

export type ResultadoVerificacao = "ok" | "bloqueado" | "invalido";

/** A cada abertura com internet: confirma que o convite segue valendo para este aparelho. */
export async function verificarConvite(
  kv: KV, codigo: string, aparelho: string, token: string, agora = Date.now(),
): Promise<ResultadoVerificacao> {
  const c = await lerConvite(kv, codigo);
  if (!c || c.aparelho !== aparelho || !c.tokenHash || c.tokenHash !== (await sha256Hex(token))) return "invalido";
  if (c.bloqueado) return "bloqueado";
  if (!c.ultimoAcesso || agora - c.ultimoAcesso >= INTERVALO_ACESSO_MS) await gravar(kv, { ...c, ultimoAcesso: agora });
  return "ok";
}

// ---------- administração ----------

export async function listarConvites(kv: KV): Promise<Convite[]> {
  const todos: Convite[] = [];
  let cursor: string | undefined;
  do {
    const p = await kv.list({ prefix: PREFIXO_CONVITE, cursor });
    for (const { name } of p.keys) {
      const b = await kv.get(name);
      if (b) todos.push(JSON.parse(b) as Convite);
    }
    cursor = p.list_complete ? undefined : p.cursor;
  } while (cursor);
  return todos.sort((a, b) => b.criadoEm - a.criadoEm);
}

export async function criarConvite(kv: KV, nome: string, agora = Date.now()): Promise<Convite> {
  let codigo = gerarCodigo();
  while (await kv.get(PREFIXO_CONVITE + codigo)) codigo = gerarCodigo();
  const c: Convite = {
    codigo, nome: nome.trim().slice(0, 60) || "sem nome", criadoEm: agora, bloqueado: false,
    aparelho: null, tokenHash: null, ativadoEm: null, ultimoAcesso: null, lembrete: null,
  };
  await gravar(kv, c);
  return c;
}

export type AcaoAdmin = "bloquear" | "desbloquear" | "liberar" | "excluir";

/**
 * bloquear: o aparelho perde o acesso e os lembretes dele são apagados.
 * liberar: solta o aparelho atual, para o convite ser usado em outro (troca de celular).
 */
export async function aplicarAcao(kv: KV, codigo: string, acao: AcaoAdmin, prefixoLembretes: string): Promise<Convite | null> {
  const c = await lerConvite(kv, codigo);
  if (!c) return null;
  const pararLembretes = async () => {
    if (c.lembrete) await kv.delete(prefixoLembretes + c.lembrete);
  };
  if (acao === "excluir") {
    await pararLembretes();
    await kv.delete(PREFIXO_CONVITE + c.codigo);
    return c;
  }
  let novo: Convite;
  if (acao === "bloquear") {
    await pararLembretes();
    novo = { ...c, bloqueado: true, lembrete: null };
  } else if (acao === "desbloquear") {
    novo = { ...c, bloqueado: false };
  } else {
    await pararLembretes();
    novo = { ...c, aparelho: null, tokenHash: null, ativadoEm: null, ultimoAcesso: null, lembrete: null };
  }
  await gravar(kv, novo);
  return novo;
}

/** Guarda qual registro de lembretes pertence ao aparelho deste convite. */
export async function vincularLembrete(kv: KV, codigo: string, lembrete: string): Promise<void> {
  const c = await lerConvite(kv, codigo);
  if (c && c.lembrete !== lembrete) await gravar(kv, { ...c, lembrete });
}
