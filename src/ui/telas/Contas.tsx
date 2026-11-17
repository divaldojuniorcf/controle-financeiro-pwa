import { useMemo, useState } from "react";
import { useApp } from "../../app/estado";
import { alternarBaixas } from "../../core/baixas";
import { cardsDeContas, listaDeContas, situacaoDoItem, TEXTOS_CONTAS, tituloDaLista, type FiltroContas, type Visualizar } from "../../core/contas";
import { formatarData, hojeDoAparelho, isoParaSerial } from "../../core/datas";
import { moeda } from "../../core/numeros";
import type { ItemConta, TipoBaixa } from "../../core/tipos";
import { CampoFiltroData, CampoLista, Card, Faixa, Tela } from "../componentes";

const COLUNAS = "44px 1fr auto";

/** Contas a Pagar e Contas a Receber (seções 2, 4.5 a 4.7): mesma tela, textos diferentes. */
export function Contas({ tipo }: { tipo: TipoBaixa }) {
  const { contas, ui, alterarUi, alterarEstado } = useApp();
  const t = TEXTOS_CONTAS[tipo];
  const chaveFiltro = tipo === "Pagar" ? "filtroPagar" : "filtroReceber";
  const f = ui[chaveFiltro];
  const filtro: FiltroContas = { dataEscolhida: f.dataEscolhida ? isoParaSerial(f.dataEscolhida) : null, visualizar: f.visualizar };
  const itens = tipo === "Pagar" ? contas.pagar : contas.receber;

  const lista = useMemo(() => listaDeContas(itens, filtro, contas.hoje), [itens, filtro.dataEscolhida, filtro.visualizar, contas.hoje]);
  const cards = cardsDeContas(itens, filtro, contas.hoje);

  const [varios, setVarios] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const mudarFiltro = (parcial: Partial<typeof f>) => alterarUi((u) => ({ ...u, [chaveFiltro]: { ...u[chaveFiltro], ...parcial } }));

  /** Marca ✔ (ou desfaz) e grava em Baixas com a data real de hoje. */
  function alternar(sel: ItemConta[]) {
    alterarEstado((s) => ({ ...s, baixas: alternarBaixas(s.baixas, sel, tipo, hojeDoAparelho()) }));
  }

  function aplicarVarios() {
    alternar(lista.filter((i) => marcados.has(i.chave)));
    setMarcados(new Set());
    setVarios(false);
  }

  return (
    <Tela titulo={t.titulo} ajuda={`${t.ajuda} Para marcar vários de uma vez, toque em "Marcar vários".`}>
      <div>
        <CampoFiltroData rotulo="Data escolhida (vazio = mês atual)" valor={f.dataEscolhida} onChange={(v) => mudarFiltro({ dataEscolhida: v })} />
        <CampoLista rotulo="Visualizar" valor={f.visualizar} opcoes={["Data / mês atual", "Todas as datas"]} onChange={(v) => mudarFiltro({ visualizar: v as Visualizar })} />
      </div>

      <div className="cards">
        <Card rotulo="Total no período" valor={cards.totalNoPeriodo} />
        <Card rotulo="Em aberto no período" valor={cards.emAbertoNoPeriodo} />
        <Card rotulo="Total em aberto (todas as datas)" valor={cards.totalEmAberto} />
        <Card rotulo={t.emAtraso} valor={cards.emAtraso} classe={cards.emAtraso > 0 ? "neg" : ""} />
      </div>

      <Faixa cor="tabela">{tituloDaLista(tipo, filtro)}</Faixa>
      <div className="botoes">
        {!varios ? (
          <button className="botao" onClick={() => setVarios(true)} disabled={lista.length === 0}>Marcar vários</button>
        ) : (
          <>
            <button className="botao primario" disabled={marcados.size === 0} onClick={aplicarVarios}>Aplicar ✔ ({marcados.size})</button>
            <button className="botao" onClick={() => { setVarios(false); setMarcados(new Set()); }}>Cancelar</button>
          </>
        )}
      </div>

      <div className="lista">
        <div className="cab" style={{ gridTemplateColumns: COLUNAS }}>
          <span>Marcar ✔</span><span>Descrição</span><span className="num">Valor</span>
        </div>
        {lista.length === 0 && <div className="vazia">{t.vazio}</div>}
        {lista.map((i) => {
          const sel = marcados.has(i.chave);
          return (
            <div key={i.chave} className="item" style={{ gridTemplateColumns: COLUNAS, alignItems: "center" }}>
              <button
                className={`marcar${i.pago ? " feito" : ""}${sel ? " sel" : ""}`}
                aria-label={varios ? `Selecionar ${i.descricao}` : i.pago ? `Desfazer baixa de ${i.descricao}` : `Dar baixa em ${i.descricao}`}
                aria-pressed={varios ? sel : i.pago}
                onClick={() => {
                  if (varios) {
                    setMarcados((atual) => {
                      const n = new Set(atual);
                      if (n.has(i.chave)) n.delete(i.chave); else n.add(i.chave);
                      return n;
                    });
                  } else alternar([i]);
                }}
              >
                {varios ? (sel ? "●" : "○") : i.pago ? "✔" : ""}
              </button>
              <span>
                <span className="forte">{i.descricao}</span>
                <br />
                <span className="sec">
                  <span className={`etiqueta${i.pago ? " ok" : ""}`}>{situacaoDoItem(tipo, i)}</span>
                  {" "}{i.origem} · {i.categoria} · {formatarData(i.vencimento)}
                  {!i.pago && i.vencimento < contas.hoje && <span className="neg"> · em atraso</span>}
                </span>
              </span>
              <span className="num forte">{i.valor === null ? "" : moeda(i.valor)}</span>
            </div>
          );
        })}
      </div>
    </Tela>
  );
}
