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
}

export const UI_PADRAO: EstadoUi = {
  dataAnalise: null,
  filtroPagar: { dataEscolhida: null, visualizar: "Data / mês atual" },
  filtroReceber: { dataEscolhida: null, visualizar: "Data / mês atual" },
  dataPagasRecebidas: null,
  ultimoBackup: null,
  inicio: null,
};

export interface Gravado {
  estado: Estado;
  ui: EstadoUi;
}

const NOME = "controle-financeiro";
const LOJA = "dados";
const CIFRADO = "cifrado";
/** Formato antigo, sem cifra (Fases 2 a 5). Só é lido para migrar. */
const SEM_CIFRA = "atual";

let conexao: Promise<IDBPDatabase> | null = null;
function db() {
  conexao ??= openDB(NOME, 1, {
    upgrade(d) {
      d.createObjectStore(LOJA);
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

export async function apagarTudo(): Promise<void> {
  const d = await db();
  const tx = d.transaction(LOJA, "readwrite");
  await tx.store.clear();
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
