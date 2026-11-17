import type { ArquivoDados } from "./importacao";
import type { DataISO, Estado } from "./tipos";

export const DIAS_AVISO_BACKUP = 30;

/**
 * Dias desde o último "Exportar JSON" (ou desde que os dados entraram no app,
 * se nunca houve exportação). null quando não há referência.
 */
export function diasSemBackup(ultimoBackup: string | null, inicio: string | null, agora = new Date()): number | null {
  const base = ultimoBackup ?? inicio;
  if (!base) return null;
  return Math.floor((agora.getTime() - new Date(base).getTime()) / 86_400_000);
}

export function precisaAvisarBackup(ultimoBackup: string | null, inicio: string | null, agora = new Date()): boolean {
  const d = diasSemBackup(ultimoBackup, inicio, agora);
  return d !== null && d > DIAS_AVISO_BACKUP;
}

/** Backup do app no mesmo formato do dados.json da planilha (reimportável). */
export function gerarBackup(estado: Estado, dataAnalise: DataISO | null, agora = new Date()): ArquivoDados & { exportadoEm: string } {
  const semId = <T extends { id: string }>({ id: _id, ...resto }: T) => resto;
  return {
    formato: "controle-financeiro-app",
    versao: 1,
    exportadoEm: agora.toISOString(),
    parametros: { ...estado.parametros },
    dashboard: { dataAnalise },
    lancamentos: estado.lancamentos.map(semId),
    investimentos: estado.investimentos.map(semId),
    baixas: estado.baixas,
  };
}
