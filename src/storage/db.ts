// Persistência local (IndexedDB). Nada sai do aparelho.
import { openDB, type IDBPDatabase } from "idb";
import type { DataISO, Estado } from "../core/tipos";
import type { Visualizar } from "../core/contas";

export interface EstadoUi {
  dataAnalise: DataISO | null;
  filtroPagar: { dataEscolhida: DataISO | null; visualizar: Visualizar };
  filtroReceber: { dataEscolhida: DataISO | null; visualizar: Visualizar };
  dataPagasRecebidas: DataISO | null;
  ultimoBackup: string | null;
}

export const UI_PADRAO: EstadoUi = {
  dataAnalise: null,
  filtroPagar: { dataEscolhida: null, visualizar: "Data / mês atual" },
  filtroReceber: { dataEscolhida: null, visualizar: "Data / mês atual" },
  dataPagasRecebidas: null,
  ultimoBackup: null,
};

interface Gravado {
  estado: Estado;
  ui: EstadoUi;
}

const NOME = "controle-financeiro";
const LOJA = "dados";
const CHAVE = "atual";

let conexao: Promise<IDBPDatabase> | null = null;
function db() {
  conexao ??= openDB(NOME, 1, {
    upgrade(d) {
      d.createObjectStore(LOJA);
    },
  });
  return conexao;
}

export async function carregar(): Promise<Gravado | null> {
  const g = (await (await db()).get(LOJA, CHAVE)) as Gravado | undefined;
  if (!g) return null;
  return { estado: g.estado, ui: { ...UI_PADRAO, ...g.ui } };
}

export async function salvar(g: Gravado): Promise<void> {
  await (await db()).put(LOJA, g, CHAVE);
}

export async function apagarTudo(): Promise<void> {
  await (await db()).delete(LOJA, CHAVE);
}

/** Pede ao navegador para não apagar os dados por falta de espaço (Safari respeita no app instalado). */
export async function pedirArmazenamentoPersistente(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* sem suporte */
  }
}
