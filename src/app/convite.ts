// Convite do aparelho: instalações novas precisam de um código; o dono pode bloquear.
import type { ConviteLocal } from "../storage/db";

const URL_SERVIDOR = (import.meta.env.VITE_URL_LEMBRETES ?? "").replace(/\/$/, "");

/** Sem internet, o app segue funcionando por este tempo desde a última confirmação. */
export const DIAS_SEM_CONFIRMAR = 7;
/** Com o app aberto, confirma de novo ao voltar para a tela depois deste intervalo. */
export const INTERVALO_CONFIRMACAO_MS = 12 * 3_600_000;
const TEMPO_LIMITE_MS = 6000;

export type ResultadoConfirmacao = "ok" | "bloqueado" | "invalido" | "sem-conexao";

async function chamar(caminho: string, corpo: unknown): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    return await fetch(`${URL_SERVIDOR}${caminho}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

const MENSAGENS: Record<string, string> = {
  invalido: "Convite não encontrado. Confira o código (letras e números, sem 0 e sem 1).",
  "em-uso": "Este convite já está sendo usado em outro aparelho. Peça um novo convite.",
  bloqueado: "Este convite foi bloqueado. Fale com quem enviou o convite.",
};

/** Primeira abertura: troca o código do convite pela credencial deste aparelho. */
export async function usarConvite(codigo: string): Promise<ConviteLocal> {
  const aparelho = crypto.randomUUID();
  let r: Response;
  try {
    r = await chamar("/convites/usar", { codigo, aparelho });
  } catch {
    throw new Error("Sem conexão com a internet. O convite precisa de internet na primeira vez.");
  }
  const corpo = (await r.json().catch(() => ({}))) as { situacao?: string; token?: string; codigo?: string };
  if (corpo.situacao !== "ok" || !corpo.token || !corpo.codigo)
    throw new Error(MENSAGENS[corpo.situacao ?? ""] ?? `Não foi possível validar o convite (${r.status}).`);
  return { codigo: corpo.codigo, aparelho, token: corpo.token, ultimaConfirmacao: Date.now() };
}

/** Confere no servidor se o convite segue valendo para este aparelho. */
export async function confirmarConvite(c: Extract<ConviteLocal, { codigo: string }>): Promise<ResultadoConfirmacao> {
  try {
    const r = await chamar("/convites/verificar", { codigo: c.codigo, aparelho: c.aparelho, token: c.token });
    if (!r.ok) return "sem-conexao";
    const { situacao } = (await r.json()) as { situacao?: ResultadoConfirmacao };
    return situacao === "ok" || situacao === "bloqueado" || situacao === "invalido" ? situacao : "sem-conexao";
  } catch {
    return "sem-conexao";
  }
}

/** Sem internet: libera se a última confirmação foi há menos de 7 dias. */
export function dentroDoPrazoOffline(ultimaConfirmacao: number, agora = Date.now()): boolean {
  return agora - ultimaConfirmacao < DIAS_SEM_CONFIRMAR * 86_400_000;
}
