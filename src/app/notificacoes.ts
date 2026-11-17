// Lembretes de vencimento por Web Push.
// O servidor recebe só a assinatura de push e os HORÁRIOS; os nomes ficam no aparelho.
import { useSyncExternalStore } from "react";
import type { Lembrete } from "../core/lembretes";
import { lerConviteLocal, salvarLembretesLocais } from "../storage/db";

const URL_SERVIDOR = (import.meta.env.VITE_URL_LEMBRETES ?? "").replace(/\/$/, "");
const CHAVE_VAPID = import.meta.env.VITE_VAPID_PUBLICA ?? "";

export interface ConfigNotificacoes {
  id: string;
  token: string;
}

/** Por que os lembretes não podem ser ativados aqui (null = podem). */
export function motivoSemSuporte(): string | null {
  if (!URL_SERVIDOR || !CHAVE_VAPID) return "O servidor de lembretes ainda não foi configurado nesta versão do app.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return "Este navegador não recebe notificações. No iPhone, abra o app pelo ícone da Tela de Início (iOS 16.4 ou mais novo).";
  return null;
}

function bytesDeB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function assinaturaAtual(criar: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const atual = await reg.pushManager.getSubscription();
  if (atual || !criar) return atual;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeB64url(CHAVE_VAPID) });
}

async function chamar(cfg: ConfigNotificacoes, metodo: string, caminho: string, corpo?: unknown): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`${URL_SERVIDOR}/dispositivos/${cfg.id}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${cfg.token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new Error("Sem conexão com o servidor de lembretes.");
  }
  if (!r.ok) throw new Error(`O servidor de lembretes recusou o pedido (${r.status}).`);
}

/** Pede permissão e cria a identificação do aparelho. Precisa ser chamada por um toque do usuário. */
export async function ativarNotificacoes(): Promise<ConfigNotificacoes> {
  const motivo = motivoSemSuporte();
  if (motivo) throw new Error(motivo);
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted")
    throw new Error("As notificações não foram permitidas. Para mudar: Ajustes do iPhone → Notificações → Finanças.");
  await assinaturaAtual(true);
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { id: crypto.randomUUID(), token };
}

/** Guarda os textos no aparelho e envia ao servidor só os horários. */
export async function sincronizarLembretes(cfg: ConfigNotificacoes, lembretes: Lembrete[]): Promise<void> {
  await salvarLembretesLocais(lembretes.map(({ dia, titulo, corpo }) => ({ dia, titulo, corpo })));
  const assinatura = await assinaturaAtual(false);
  if (!assinatura) throw new Error("A permissão de notificações foi retirada. Desative e ative os lembretes de novo.");
  // Aparelho com convite: o servidor confere o convite e para os lembretes se ele for bloqueado.
  const c = await lerConviteLocal();
  const convite = c && !c.isento ? { codigo: c.codigo, aparelho: c.aparelho, token: c.token } : undefined;
  await chamar(cfg, "PUT", "", { assinatura: { endpoint: assinatura.endpoint }, horarios: lembretes.map((l) => l.enviarEm), convite });
}

export async function testarNotificacao(cfg: ConfigNotificacoes): Promise<void> {
  await chamar(cfg, "POST", "/teste");
}

export async function desativarNotificacoes(cfg: ConfigNotificacoes): Promise<void> {
  await salvarLembretesLocais([]);
  try {
    await chamar(cfg, "DELETE", "");
  } finally {
    await (await assinaturaAtual(false))?.unsubscribe();
  }
}

// ---------- situação da última sincronização (para mostrar em Parâmetros) ----------

export interface SituacaoLembretes {
  ultima: Date | null;
  agendados: number;
  erro: string | null;
}

let situacao: SituacaoLembretes = { ultima: null, agendados: 0, erro: null };
const ouvintes = new Set<() => void>();

export function registrarSituacao(s: SituacaoLembretes): void {
  situacao = s;
  ouvintes.forEach((f) => f());
}

export function useSituacaoLembretes(): SituacaoLembretes {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => situacao,
  );
}
