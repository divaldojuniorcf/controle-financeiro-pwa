// Lembretes de vencimento: uma notificação por dia, na véspera, com os nomes das contas (sem valores).
import { ano, mes, serialParaIso } from "./datas";
import type { DataISO, ItemConta } from "./tipos";

export const HORA_LEMBRETE = 9;
/** Até quantos dias à frente os lembretes são agendados. */
export const DIAS_LEMBRETES = 120;

export interface Lembrete {
  /** Dia do vencimento (o aviso sai na véspera). */
  dia: DataISO;
  /** Quando enviar: véspera às 9h no fuso do aparelho (milissegundos). */
  enviarEm: number;
  titulo: string;
  corpo: string;
}

const diaDoMes = (serial: number) => Number(serialParaIso(serial).slice(8, 10));

/** Véspera do vencimento, às `hora`, no fuso do aparelho. */
export function horarioDoLembrete(vencimento: number, hora = HORA_LEMBRETE): number {
  return new Date(ano(vencimento), mes(vencimento) - 1, diaDoMes(vencimento) - 1, hora, 0, 0, 0).getTime();
}

const lista = (nomes: string[]) => [...new Set(nomes)].join(", ");

/**
 * Agrupa as contas em aberto (a pagar e a receber) por dia de vencimento e
 * monta um lembrete por dia, só para avisos que ainda vão acontecer.
 */
export function gerarLembretes(pagar: ItemConta[], receber: ItemConta[], agora: Date, hora = HORA_LEMBRETE): Lembrete[] {
  const limite = agora.getTime() + DIAS_LEMBRETES * 86_400_000;
  const porDia = new Map<number, { pagar: string[]; receber: string[] }>();
  const juntar = (itens: ItemConta[], tipo: "pagar" | "receber") => {
    for (const i of itens) {
      if (i.pago || !i.vencimento) continue;
      const g = porDia.get(i.vencimento) ?? { pagar: [], receber: [] };
      g[tipo].push(i.descricao);
      porDia.set(i.vencimento, g);
    }
  };
  juntar(pagar, "pagar");
  juntar(receber, "receber");

  return [...porDia.entries()]
    .map(([venc, g]) => ({ venc, g, enviarEm: horarioDoLembrete(venc, hora) }))
    .filter((x) => x.enviarEm > agora.getTime() && x.enviarEm <= limite)
    .sort((a, b) => a.venc - b.venc)
    .map(({ venc, g, enviarEm }) => {
      const iso = serialParaIso(venc);
      const linhas = [
        g.pagar.length ? `A pagar: ${lista(g.pagar)}` : "",
        g.receber.length ? `A receber: ${lista(g.receber)}` : "",
      ].filter(Boolean);
      return {
        dia: iso,
        enviarEm,
        titulo: `Vencem amanhã (${iso.slice(8, 10)}/${iso.slice(5, 7)})`,
        corpo: linhas.join("\n"),
      };
    });
}
