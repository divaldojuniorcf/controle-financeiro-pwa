import type { ArquivoDados } from "./importacao";
import type { DataISO, Estado } from "./tipos";

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
