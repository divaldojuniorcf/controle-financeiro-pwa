import { useApp } from "../../app/estado";
import { pagasERecebidas, VAZIO_BAIXAS_PERIODO, VAZIO_BAIXAS_TODAS, type LinhaBaixada } from "../../core/contas";
import { formatarData, isoParaSerial } from "../../core/datas";
import { moeda } from "../../core/numeros";
import { CampoFiltroData, Card, Faixa, Tela } from "../componentes";

const COLUNAS = "1fr auto";

function ListaBaixadas({ titulo, linhas, vazio }: { titulo: string; linhas: LinhaBaixada[]; vazio: string }) {
  return (
    <>
      <Faixa cor="tabela">{titulo}</Faixa>
      <div className="lista">
        <div className="cab" style={{ gridTemplateColumns: COLUNAS }}><span>Descrição</span><span className="num">Valor</span></div>
        {linhas.length === 0 && <div className="vazia">{vazio}</div>}
        {linhas.map(({ tipo, item }, k) => (
          <div key={`${tipo}${item.chave}${k}`} className="item" style={{ gridTemplateColumns: COLUNAS }}>
            <span>
              <span className="forte">{item.descricao}</span>
              <br />
              <span className="sec">
                <span className={`etiqueta${tipo === "Recebido" ? " ok" : ""}`}>{tipo}</span>
                {" "}{item.origem} · {item.categoria} · {formatarData(item.vencimento)}
              </span>
            </span>
            <span className={`num forte ${tipo === "Recebido" ? "pos" : ""}`}>{item.valor === null ? "" : moeda(item.valor)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function PagasRecebidas() {
  const { estado, contas, ui, alterarUi } = useApp();
  const data = ui.dataPagasRecebidas;
  const pr = pagasERecebidas(contas.pagar, contas.receber, data ? isoParaSerial(data) : null, contas.hoje);

  return (
    <Tela
      titulo="Contas Pagas e Recebidas"
      ajuda="Preenchida automaticamente com os itens marcados com ✔ em Contas a Pagar e Contas a Receber. Para desfazer, remova o ✔ na tela de origem."
    >
      <CampoFiltroData rotulo="Data escolhida (vazio = mês atual)" valor={data} onChange={(v) => alterarUi((u) => ({ ...u, dataPagasRecebidas: v }))} />
      <div className="cards">
        <Card rotulo="Total pago" valor={pr.totalPago} />
        <Card rotulo="Total recebido" valor={pr.totalRecebido} />
        <Card rotulo="Saldo (recebido − pago)" valor={pr.saldo} />
      </div>

      <ListaBaixadas titulo={pr.tituloLista} linhas={pr.doPeriodo} vazio={VAZIO_BAIXAS_PERIODO} />
      <ListaBaixadas titulo="TODAS AS BAIXAS (pagas e recebidas)" linhas={pr.todas} vazio={VAZIO_BAIXAS_TODAS} />

      <details style={{ marginTop: 16 }}>
        <summary className="forte" style={{ color: "var(--titulo)", minHeight: 44, display: "flex", alignItems: "center" }}>
          Registro de baixas ({estado.baixas.length}) — somente leitura
        </summary>
        <p className="ajuda">Registro interno (aba Baixas da planilha). Para desfazer, marque ✔ de novo na conta.</p>
        <div className="lista">
          {estado.baixas.length === 0 && <div className="vazia">{VAZIO_BAIXAS_TODAS}</div>}
          {estado.baixas.map((b, k) => (
            <div key={k} className="item" style={{ gridTemplateColumns: COLUNAS }}>
              <span>
                <span className="forte">{b.descricao}</span>
                <br />
                <span className="sec">{b.tipo} · venc. {formatarData(b.vencimento)} · baixa {formatarData(b.dataBaixa)}{b.observacao ? ` · ${b.observacao}` : ""}</span>
                <br />
                <span className="sec" style={{ wordBreak: "break-all" }}>{b.chave}</span>
              </span>
              <span className="num">{b.valor === null ? "" : moeda(b.valor)}</span>
            </div>
          ))}
        </div>
      </details>
    </Tela>
  );
}
