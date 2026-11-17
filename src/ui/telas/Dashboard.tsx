import { useMemo, type ReactNode } from "react";
import { useApp } from "../../app/estado";
import { calcularDashboard, CORES_SITUACAO, REGRA_DIAGNOSTICO } from "../../core/dashboard";
import { formatarData, formatarMesAno, isoParaSerial, nomeDoMes } from "../../core/datas";
import { moeda, percentual } from "../../core/numeros";
import { CampoFiltroData, Card, Faixa, Tela } from "../componentes";
import {
  GraficoCarteira, GraficoComprometimento, GraficoDespesas, GraficoEntradasSaidas, GraficoFontes, GraficoSaldo, GraficoSituacao,
} from "../graficos";

const sinal = (v: number) => (v >= 0 ? "pos" : "neg");

/** Saldo com o rótulo SUPERÁVIT/DÉFICIT nas cores da seção 5. */
function CardSaldo({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <Card
      rotulo={rotulo}
      classe={sinal(valor)}
      texto={<>{valor === 0 ? "-" : moeda(valor)}<div className={`rotulo-saldo ${sinal(valor)}`}>{valor >= 0 ? "SUPERÁVIT" : "DÉFICIT"}</div></>}
    />
  );
}

function TabelaApoio({ cabecalho, linhas, total }: { cabecalho: string[]; linhas: ReactNode[][]; total?: ReactNode[] }) {
  return (
    <table className="apoio">
      <thead><tr>{cabecalho.map((c, k) => <th key={k} className={k > 0 ? "num" : ""}>{c}</th>)}</tr></thead>
      <tbody>
        {linhas.map((l, i) => <tr key={i}>{l.map((c, k) => <td key={k} className={k > 0 ? "num" : ""}>{c}</td>)}</tr>)}
        {total && <tr className="total">{total.map((c, k) => <td key={k} className={k > 0 ? "num" : ""}>{c}</td>)}</tr>}
      </tbody>
    </table>
  );
}

export function Dashboard() {
  const { contas, ui, alterarUi } = useApp();
  const d = useMemo(() => calcularDashboard(contas, ui.dataAnalise ? isoParaSerial(ui.dataAnalise) : null), [contas, ui.dataAnalise]);
  const cor = CORES_SITUACAO[d.situacao];

  return (
    <Tela
      titulo="Dashboard Financeiro"
      grande
      ajuda="Resumo automático de Lançamentos, Investimentos, Contas a Pagar e Contas a Receber. Data de análise (campo amarelo): deixe em branco para usar a data de hoje."
    >
      <CampoFiltroData rotulo="Data de análise (vazio = Hoje)" valor={ui.dataAnalise} onChange={(v) => alterarUi((u) => ({ ...u, dataAnalise: v }))} />
      <div className="cards">
        <Card rotulo="Mês analisado" texto={formatarMesAno(d.mesAnalisado)} />
        <div className="card" style={{ background: cor.fundo }}>
          <div className="rotulo">Situação</div>
          <div className="valor" style={{ color: cor.texto, fontSize: "12pt" }}>{d.situacao}</div>
        </div>
      </div>
      <p className="sec">Data usada: {formatarData(d.dataAnalise)}{ui.dataAnalise ? "" : " (Hoje)"}</p>

      <Faixa cor="escura">DATA ESCOLHIDA</Faixa>
      <div className="cards tres">
        <Card rotulo="Entradas previstas" valor={d.entradasData} />
        <Card rotulo="Saídas previstas" valor={d.saidasData} />
        <CardSaldo rotulo="Saldo da data" valor={d.saldoData} />
      </div>

      <Faixa cor="mes">MÊS ANALISADO</Faixa>
      <div className="cards tres">
        <Card rotulo="Entradas do mês" valor={d.entradasMes} />
        <Card rotulo="Saídas do mês" valor={d.saidasMes} />
        <CardSaldo rotulo="Saldo do mês" valor={d.saldoMes} />
      </div>

      <Faixa cor="cinza">TODAS AS DATAS (não muda com a data de análise)</Faixa>
      <div className="cards">
        <Card rotulo="A pagar em aberto" valor={d.aPagarEmAberto} />
        <Card rotulo="A receber em aberto" valor={d.aReceberEmAberto} />
        <Card rotulo="Saldo em aberto" valor={d.saldoEmAberto} classe={sinal(d.saldoEmAberto)} />
        <Card rotulo="Carteira atual" valor={d.carteiraAtual} />
        <Card rotulo="Rendimento acumulado" valor={d.rendimentoAcumulado} />
        <Card rotulo="Rendimento projetado 12m" valor={d.rendimentoProjetado12m} />
      </div>

      <Faixa cor="escura">ANO ANALISADO (jan a dez)</Faixa>
      <GraficoEntradasSaidas d={d} />
      <GraficoSaldo d={d} />

      <Faixa cor="mes">MÊS ANALISADO</Faixa>
      <GraficoDespesas d={d} />
      <GraficoFontes d={d} />

      <Faixa cor="cinza">TODAS AS DATAS</Faixa>
      <GraficoCarteira d={d} />
      <GraficoSituacao d={d} />

      <Faixa cor="mes">MÊS ANALISADO</Faixa>
      <GraficoComprometimento d={d} />

      <Faixa cor="escura">DIAGNÓSTICO FINAL</Faixa>
      <div className="diagnostico" style={{ background: cor.fundo, color: cor.texto }}>
        <div className="forte" style={{ fontSize: 16 }}>{d.situacao}</div>
        <ul>{d.frases.map((f, k) => <li key={k}>{f}</li>)}</ul>
      </div>
      <p className="ajuda">{REGRA_DIAGNOSTICO}</p>

      <Faixa cor="tabela">INDICADORES DO DIAGNÓSTICO</Faixa>
      <TabelaApoio
        cabecalho={["Indicador", "Valor"]}
        linhas={[
          ["Saldo da data de análise", <span className={sinal(d.saldoData)}>{moeda(d.saldoData)}</span>],
          ["Saldo do mês analisado", <span className={sinal(d.saldoMes)}>{moeda(d.saldoMes)}</span>],
          ["Contas a pagar vencidas em aberto (até hoje)", moeda(d.pagarVencidasEmAberto)],
          ["Comprometimento da renda no mês (saídas ÷ entradas)", percentual(d.comprometimento)],
          ["Limite de comprometimento (Parâmetros)", percentual(d.limiteComprometimento)],
          ["% da renda investida no mês (aportes)", percentual(d.pctRendaInvestida)],
          ["% da renda vinda de rendimentos no mês", percentual(d.pctRendaRendimentos)],
        ]}
      />

      <details className="dados-graficos">
        <summary>DADOS DOS GRÁFICOS (calculados automaticamente)</summary>
        <TabelaApoio
          cabecalho={["Mês", "Entradas", "Saídas", "Saldo", "Saldo acumulado"]}
          linhas={d.mensal.map((m) => [nomeDoMes(m.mes).slice(0, 3), moeda(m.entradas), moeda(m.saidas), moeda(m.saldo), moeda(m.saldoAcumulado)])}
        />
        <TabelaApoio
          cabecalho={["Categoria de saída", "Valor no mês", "% da renda", "% das saídas"]}
          linhas={d.categoriasSaida.map((c) => [c.categoria, moeda(c.valor), percentual(c.pctRenda), percentual(c.pctSaidas)])}
          total={["Total", moeda(d.totalCategoriasSaida.valor), percentual(d.totalCategoriasSaida.pctRenda), percentual(d.totalCategoriasSaida.pctSaidas)]}
        />
        <TabelaApoio
          cabecalho={["Fonte de entrada", "Valor no mês", "% das entradas"]}
          linhas={d.fontesEntrada.map((c) => [c.categoria, moeda(c.valor), percentual(c.pctEntradas)])}
          total={["Total", moeda(d.totalFontesEntrada.valor), percentual(d.totalFontesEntrada.pctEntradas)]}
        />
        <TabelaApoio
          cabecalho={["Composição da carteira", "Valor", "%"]}
          linhas={d.composicaoCarteira.map((c) => [c.nome, moeda(c.valor), percentual(c.pct)])}
        />
        <TabelaApoio
          cabecalho={["Situação das contas", "Baixado", "Em aberto"]}
          linhas={d.situacaoContas.map((s) => [s.nome, moeda(s.baixado), moeda(s.emAberto)])}
        />
      </details>
    </Tela>
  );
}
