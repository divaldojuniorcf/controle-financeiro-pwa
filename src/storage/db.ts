// Persistência local (IndexedDB), sempre cifrada com o PIN. Nada sai do aparelho.
import { openDB, type IDBPDatabase } from "idb";
import type { DataISO, Estado } from "../core/tipos";
import type { Visualizar } from "../core/contas";
import { cifrar, type Cifrado } from "./cripto";

export interface EstadoUi {
  dataAnalise: DataISO | null;
  filtroPagar: { dataEscolhida: DataISO | null; visualizar: Visualizar };
  filtroReceber: { dataEscolhida: DataISO | null; visualizar: Visualizar };
  dataPagasRecebidas: DataISO | null;
  /** Data e hora (ISO) do último "Exportar JSON". */
  ultimoBackup: string | null;
  /** Quando os dados foram criados no aparelho; base do aviso de backup se nunca houve exportação. */
  inicio: string | null;
  /** Lembretes de vencimento ativos neste aparelho (identificação junto ao servidor). */
  notificacoes: { id: string; token: string } | null;
}

export const UI_PADRAO: EstadoUi = {
  dataAnalise: null,
  filtroPagar: { dataEscolhida: null, visualizar: "Data / mês atual" },
  filtroReceber: { dataEscolhida: null, visualizar: "Data / mês atual" },
  dataPagasRecebidas: null,
  ultimoBackup: null,
  inicio: null,
  notificacoes: null,
};

export interface Gravado {
  estado: Estado;
  ui: EstadoUi;
}

const NOME = "controle-financeiro";
const LOJA = "dados";
/** Textos dos lembretes (nomes e datas, sem valores), lidos pelo service worker com o app fechado. */
export const LOJA_LEMBRETES = "lembretes";
export const VERSAO_DB = 2;
const CIFRADO = "cifrado";
/** Formato antigo, sem cifra (Fases 2 a 5). Só é lido para migrar. */
const SEM_CIFRA = "atual";

let conexao: Promise<IDBPDatabase> | null = null;
function db() {
  // A versão e as lojas precisam bater com public/sw-push.js.
  conexao ??= openDB(NOME, VERSAO_DB, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(LOJA)) d.createObjectStore(LOJA);
      if (!d.objectStoreNames.contains(LOJA_LEMBRETES)) d.createObjectStore(LOJA_LEMBRETES);
    },
  });
  return conexao;
}

export type Situacao =
  | { tipo: "vazio" }
  | { tipo: "cifrado"; cifrado: Cifrado }
  | { tipo: "sem-cifra"; gravado: Gravado };

export async function lerSituacao(): Promise<Situacao> {
  const d = await db();
  const c = (await d.get(LOJA, CIFRADO)) as Cifrado | undefined;
  if (c) return { tipo: "cifrado", cifrado: c };
  const g = (await d.get(LOJA, SEM_CIFRA)) as Gravado | undefined;
  if (g) return { tipo: "sem-cifra", gravado: completarUi(g) };
  return { tipo: "vazio" };
}

export function completarUi(g: Gravado): Gravado {
  return { estado: g.estado, ui: { ...UI_PADRAO, ...g.ui } };
}

export async function salvarCifrado(g: Gravado, chave: CryptoKey, salt: Uint8Array, iteracoes: number): Promise<void> {
  const c = await cifrar(chave, salt, g, iteracoes);
  const d = await db();
  const tx = d.transaction(LOJA, "readwrite");
  await tx.store.put(c, CIFRADO);
  await tx.store.delete(SEM_CIFRA);
  await tx.done;
}

/** Apaga os dados financeiros e os lembretes. O convite do aparelho é mantido. */
export async function apagarTudo(): Promise<void> {
  const d = await db();
  const tx = d.transaction([LOJA, LOJA_LEMBRETES], "readwrite");
  await Promise.all([
    tx.objectStore(LOJA).delete(CIFRADO),
    tx.objectStore(LOJA).delete(SEM_CIFRA),
    tx.objectStore(LOJA_LEMBRETES).clear(),
  ]);
  await tx.done;
}

// ---------- convite do aparelho (fora da cifra: é lido antes do PIN) ----------

const CHAVE_CONVITE = "convite";

/** isento: marca antiga (aparelhos de antes dos convites); hoje vale como "sem convite". */
export type ConviteLocal =
  | { isento: true }
  | { isento?: false; codigo: string; aparelho: string; token: string; ultimaConfirmacao: number };

export async function lerConviteLocal(): Promise<ConviteLocal | null> {
  return ((await (await db()).get(LOJA, CHAVE_CONVITE)) as ConviteLocal | undefined) ?? null;
}

export async function salvarConviteLocal(c: ConviteLocal): Promise<void> {
  await (await db()).put(LOJA, c, CHAVE_CONVITE);
}

export interface LembreteLocal {
  dia: DataISO;
  titulo: string;
  corpo: string;
}

/** Substitui os lembretes guardados no aparelho (chave = dia do vencimento). */
export async function salvarLembretesLocais(lembretes: LembreteLocal[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(LOJA_LEMBRETES, "readwrite");
  await tx.store.clear();
  await Promise.all(lembretes.map((l) => tx.store.put(l, l.dia)));
  await tx.done;
}

/** Pede ao navegador para não apagar os dados por falta de espaço. */
export async function pedirArmazenamentoPersistente(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* sem suporte */
  }
}
