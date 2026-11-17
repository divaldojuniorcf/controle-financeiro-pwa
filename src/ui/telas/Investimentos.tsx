import { useState } from "react";
import { novoId, useApp } from "../../app/estado";
import { formatarData } from "../../core/datas";
import { moeda, percentual } from "../../core/numeros";
import type { Investimento } from "../../core/tipos";
import { CampoData, CampoNumero, CampoTexto, Card, Faixa, Folha, Tela } from "../componentes";

type Rascunho = Omit<Investimento, "id"> & { id: string | null };

const NOVO = (): Rascunho => ({ id: null, dataAporte: null, ativo: "", valorInvestido: null, rentabilidadeAA: null, dataResgate: null });

function validar(r: Rascunho) {
  const e: Partial<Record<keyof Rascunho, string>> = {};
  if (!r.dataAporte) e.dataAporte = "Informe a data do aporte.";
  if (r.ativo.trim() === "") e.ativo = "Informe o ativo.";
  if (r.valorInvestido === null || r.valorInvestido <= 0) e.valorInvestido = "O valor deve ser positivo.";
  if (r.rentabilidadeAA === null) e.rentabilidadeAA = "Informe a rentabilidade ao ano.";
  if (r.dataResgate && r.dataAporte && r.dataResgate < r.dataAporte) e.dataResgate = "O resgate não pode ser antes do aporte.";
  return e;
}

const r$ = (v: number | null) => (v === null ? "" : moeda(v));

export function Investimentos() {
  const { estado, contas, alterarEstado } = useApp();
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [erros, setErros] = useState<ReturnType<typeof validar>>({});
  const r = contas.resumoInv;

  function salvar() {
    if (!editando) return;
    const e = validar(editando);
    setErros(e);
    if (Object.keys(e).length > 0) return;
    const id = editando.id;
    if (id) alterarEstado((s) => ({ ...s, investimentos: s.investimentos.map((i) => (i.id === id ? { ...editando, id } : i)) }));
    else alterarEstado((s) => ({ ...s, investimentos: [...s.investimentos, { ...editando, id: novoId() }] }));
    setEditando(null);
  }

  function excluir() {
    const id = editando?.id;
    if (!id || !confirm("Excluir este investimento? O aporte sai de Contas a Pagar e o rendimento sai de Contas a Receber.")) return;
    alterarEstado((s) => ({ ...s, investimentos: s.investimentos.filter((i) => i.id !== id) }));
    setEditando(null);
  }

  return (
    <Tela
      titulo="Investimentos"
      ajuda="Preencha os campos em azul (aporte, ativo, valor, rentabilidade ao ano e data de resgate). Rendimento calculado por juros compostos (base 365 dias). Aportes futuros entram na carteira como planejados."
    >
      <div className="cards">
        <Card rotulo="Total investido (carteira)" valor={r.totalInvestido} />
        <Card rotulo="Rendimento acumulado até hoje" valor={r.rendimentoAcumulado} />
        <Card rotulo="Carteira atual (investido + rendimento)" valor={r.carteiraAtual} />
        <Card rotulo="Rendimento projetado (12 meses)" valor={r.rendimentoProjetado} />
        <Card rotulo="Total projetado em 12 meses" valor={r.totalProjetado} />
        <Card rotulo="Rentabilidade média ponderada (a.a.)" texto={percentual(r.rentabilidadeMediaPonderada)} />
      </div>

      <Faixa cor="tabela">Carteira de investimentos</Faixa>
      <div className="botoes">
        <button className="botao primario" onClick={() => { setErros({}); setEditando(NOVO()); }}>+ Novo investimento</button>
      </div>
      <div className="lista">
        {contas.investimentos.length === 0 && <div className="vazia">Nenhum investimento.</div>}
        {contas.investimentos.map((i) => (
          <button key={i.id} className="item" style={{ gridTemplateColumns: "1fr auto" }}
            onClick={() => { setErros({}); setEditando({ ...estado.investimentos.find((x) => x.id === i.id)! }); }}>
            <span className="forte editavel">{i.ativo}</span>
            <span className="num forte editavel">{r$(i.valorInvestido)}</span>
            <span className="sec">
              Aporte <span className="editavel">{formatarData(i.dataAporte)}</span> · <span className="editavel">{i.rentabilidadeAA === null ? "" : percentual(i.rentabilidadeAA)}</span> a.a.
              {" · "}Resgate <span className="editavel">{i.dataResgate ? formatarData(i.dataResgate) : "—"}</span>
            </span>
            <span />
            <dl className="sec" style={{ gridColumn: "1 / 3", display: "grid", gridTemplateColumns: "1fr auto", gap: "1px 8px", margin: "4px 0 0" }}>
              <dt>Dias aplicados</dt><dd className="num" style={{ margin: 0 }}>{i.diasAplicados ?? ""}</dd>
              <dt>Rendimento até hoje</dt><dd className="num" style={{ margin: 0 }}>{r$(i.rendimentoAteHoje)}</dd>
              <dt>Valor atual</dt><dd className="num" style={{ margin: 0 }}>{r$(i.valorAtual)}</dd>
              <dt>Rendimento projetado 12m</dt><dd className="num" style={{ margin: 0 }}>{r$(i.rendimentoProjetado12m)}</dd>
              <dt>Total projetado 12m</dt><dd className="num" style={{ margin: 0 }}>{r$(i.totalProjetado12m)}</dd>
              <dt>Rendimento no resgate</dt><dd className="num" style={{ margin: 0 }}>{r$(i.rendimentoNoResgate)}</dd>
            </dl>
          </button>
        ))}
      </div>

      {editando && (
        <Folha titulo={editando.id ? "Editar investimento" : "Novo investimento"} aoFechar={() => setEditando(null)}>
          <CampoData rotulo="Data do aporte" valor={editando.dataAporte} erro={erros.dataAporte} onChange={(v) => setEditando({ ...editando, dataAporte: v })} />
          <CampoTexto rotulo="Ativo" valor={editando.ativo} erro={erros.ativo} onChange={(v) => setEditando({ ...editando, ativo: v })} />
          <div className="linha-campos">
            <CampoNumero rotulo="Valor investido" sufixo="R$" valor={editando.valorInvestido} erro={erros.valorInvestido} onChange={(v) => setEditando({ ...editando, valorInvestido: v })} />
            <CampoNumero rotulo="Rentabilidade a.a." sufixo="%" escala={100} valor={editando.rentabilidadeAA} erro={erros.rentabilidadeAA} onChange={(v) => setEditando({ ...editando, rentabilidadeAA: v })} />
          </div>
          <CampoData rotulo="Data de resgate (opcional)" valor={editando.dataResgate} erro={erros.dataResgate} onChange={(v) => setEditando({ ...editando, dataResgate: v })} />
          <p className="ajuda">O aporte vira um item em Contas a Pagar na data do aporte. Com data de resgate, o rendimento vira um item em Contas a Receber.</p>
          <div className="botoes">
            <button className="botao primario" onClick={salvar}>Salvar</button>
            <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
          {editando.id && (
            <div className="botoes"><button className="botao perigo" onClick={excluir}>Excluir investimento</button></div>
          )}
        </Folha>
      )}
    </Tela>
  );
}
