import { useMemo, useState } from "react";
import { novoId, useApp } from "../../app/estado";
import { categoriasDoTipo } from "../../core/dashboard";
import { formatarData, hojeDoAparelho } from "../../core/datas";
import { moeda } from "../../core/numeros";
import { analisarCodigo } from "../../core/pagamento";
import type { Lancamento } from "../../core/tipos";
import { CampoData, CampoLista, CampoNumero, CampoTexto, Folha, Tela } from "../componentes";

type Rascunho = Omit<Lancamento, "id"> & { id: string | null };

const NOVO = (): Rascunho => ({
  id: null, dataEntrada: hojeDoAparelho(), vencimento: null, descricao: "",
  tipo: "Saída", categoria: "", valor: null, recorrente: "", codigoPagamento: "",
});

/** Guarda o código só em saídas e sem espaços nas pontas; vazio some do registro. */
function semCodigoVazio<T extends { tipo: string; codigoPagamento?: string }>(l: T): T {
  const { codigoPagamento, ...resto } = l;
  const c = (codigoPagamento ?? "").trim();
  return (l.tipo === "Saída" && c ? { ...resto, codigoPagamento: c } : resto) as T;
}

/** Campo do Pix copia e cola ou da linha digitável/código de barras, com conferência na hora. */
function CampoCodigo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const c = analisarCodigo(valor);
  const [erro, setErro] = useState<string | null>(null);
  async function colar() {
    setErro(null);
    try {
      onChange((await navigator.clipboard.readText()).trim());
    } catch {
      setErro("Não foi possível ler a área de transferência. Toque e segure no campo e escolha Colar.");
    }
  }
  return (
    <div className="campo">
      <span>Código Pix ou do boleto (opcional)</span>
      <textarea className="codigo" value={valor} onChange={(e) => onChange(e.target.value)}
        placeholder="Cole aqui o Pix copia e cola ou a linha digitável do boleto" autoComplete="off" autoCorrect="off" spellCheck={false} />
      {c && (
        <span className={c.valido === false ? "erro-campo" : "sec"}>
          {c.rotulo}
          {c.valido === true ? " · conferido ✔" : c.valido === false ? " · a conferência dos dígitos não bateu: confira se colou o código inteiro" : ""}
        </span>
      )}
      {erro && <span className="erro-campo">{erro}</span>}
      <div className="botoes">
        <button type="button" className="botao" onClick={colar}>Colar</button>
        {valor && <button type="button" className="botao" onClick={() => onChange("")}>Limpar código</button>}
      </div>
      <span className="sec">Em Contas a Pagar, o botão "Pagar" copia este código. Na recorrência (Mensal), o Pix se repete nos próximos meses; o código de barras do boleto não (cada mês tem um boleto novo).</span>
    </div>
  );
}

function validar(r: Rascunho): Partial<Record<keyof Rascunho, string>> {
  const e: Partial<Record<keyof Rascunho, string>> = {};
  if (!r.vencimento) e.vencimento = "Informe o vencimento.";
  if (r.descricao.trim() === "") e.descricao = "Informe a descrição.";
  if (r.tipo !== "Entrada" && r.tipo !== "Saída") e.tipo = "Escolha Entrada ou Saída.";
  if (r.categoria === "") e.categoria = "Escolha a categoria.";
  if (r.valor === null || r.valor <= 0) e.valor = "O valor deve ser positivo.";
  return e;
}

/** Campos que entram na chave da baixa (seção 4.3). */
const mudaChave = (a: Lancamento, b: Rascunho) =>
  a.descricao !== b.descricao || a.vencimento !== b.vencimento || a.valor !== b.valor || a.tipo !== b.tipo;

export function Lancamentos() {
  const { estado, contas, alterarEstado } = useApp();
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [erros, setErros] = useState<ReturnType<typeof validar>>({});

  const baixados = useMemo(
    () => new Set([...contas.pagar, ...contas.receber].filter((i) => i.pago && i.origem === "Lançamento").map((i) => i.ref)),
    [contas],
  );

  function abrir(r: Rascunho) {
    setErros({});
    setEditando(r);
  }

  function salvar() {
    if (!editando) return;
    const r = editando;
    const e = validar(r);
    setErros(e);
    if (Object.keys(e).length > 0) return;
    if (r.id) {
      const original = estado.lancamentos.find((l) => l.id === r.id)!;
      if (baixados.has(r.id) && mudaChave(original, r) &&
        !confirm("Este lançamento já tem baixa (✔). Alterar descrição, tipo, vencimento ou valor faz a baixa deixar de valer e o item volta a ficar em aberto, como na planilha. Continuar?"))
        return;
      // Mudar o campo Recorrente roda a geração "Mensal" (como a macro da planilha).
      alterarEstado(
        (s) => ({ ...s, lancamentos: s.lancamentos.map((l) => (l.id === r.id ? semCodigoVazio({ ...r, id: r.id! }) : l)) }),
        { recorrencia: original.recorrente !== r.recorrente },
      );
    } else {
      // Novas linhas sempre no final.
      alterarEstado((s) => ({ ...s, lancamentos: [...s.lancamentos, semCodigoVazio({ ...r, id: novoId() })] }), { recorrencia: r.recorrente !== "" });
    }
    setEditando(null);
  }

  function excluir() {
    if (!editando?.id) return;
    const aviso = baixados.has(editando.id)
      ? "Este lançamento já tem baixa (✔). A planilha recomenda não apagar linhas já baixadas: a baixa fica sem o item. Excluir mesmo assim?"
      : "Excluir este lançamento?";
    if (!confirm(aviso)) return;
    // Na planilha, apagar a linha também mexe na coluna Recorrente e roda a geração.
    alterarEstado((s) => ({ ...s, lancamentos: s.lancamentos.filter((l) => l.id !== editando.id) }), { recorrencia: true });
    setEditando(null);
  }

  const cats = editando ? categoriasDoTipo(estado.parametros, editando.tipo) : [];

  return (
    <Tela
      titulo="Lançamentos"
      ajuda="Registre aqui todas as entradas e saídas. Novos lançamentos entram sempre no final da lista. Não reordene nem apague lançamentos depois de dar baixa em Contas a Pagar/Receber (a baixa acompanha a ordem dos lançamentos). Toque em um lançamento para editar. Recorrente = Mensal gera os próximos meses automaticamente (ao abrir o app e ao marcar Mensal); para encerrar, limpe Recorrente na última ocorrência."
    >
      <div className="botoes">
        <button className="botao primario" onClick={() => abrir(NOVO())}>+ Novo lançamento</button>
      </div>
      <p className="sec">{estado.lancamentos.length} lançamentos, na ordem da planilha.</p>
      <div className="lista">
        <div className="cab" style={{ gridTemplateColumns: "84px 1fr auto" }}>
          <span>Vencimento</span><span>Descrição</span><span className="num">Valor</span>
        </div>
        {estado.lancamentos.length === 0 && <div className="vazia">Nenhum lançamento.</div>}
        {estado.lancamentos.map((l) => (
          <button
            key={l.id}
            className="item"
            style={{ gridTemplateColumns: "84px 1fr auto" }}
            onClick={() => abrir({ ...l, codigoPagamento: l.codigoPagamento ?? "" })}
          >
            <span className="editavel">{formatarData(l.vencimento)}</span>
            <span className="editavel">{l.descricao}</span>
            <span className={`num editavel ${l.tipo === "Entrada" ? "pos" : ""}`}>{l.valor === null ? "" : moeda(l.valor)}</span>
            <span />
            <span className="sec" style={{ gridColumn: "2 / 4" }}>
              {l.tipo} · {l.categoria}
              {l.dataEntrada ? ` · entrada ${formatarData(l.dataEntrada)}` : ""}
              {l.recorrente ? ` · ${l.recorrente}` : ""}
              {analisarCodigo(l.codigoPagamento) ? (analisarCodigo(l.codigoPagamento)!.tipo === "pix" ? " · Pix" : " · Boleto") : ""}
              {baixados.has(l.id) ? " · ✔" : ""}
            </span>
          </button>
        ))}
      </div>

      {editando && (
        <Folha titulo={editando.id ? "Editar lançamento" : "Novo lançamento"} aoFechar={() => setEditando(null)}>
          {editando.id && baixados.has(editando.id) && (
            <p className="aviso">Este lançamento já tem baixa (✔).</p>
          )}
          <div className="linha-campos">
            <CampoData rotulo="Data de entrada" valor={editando.dataEntrada} onChange={(v) => setEditando({ ...editando, dataEntrada: v })} />
            <CampoData rotulo="Vencimento" valor={editando.vencimento} erro={erros.vencimento} onChange={(v) => setEditando({ ...editando, vencimento: v })} />
          </div>
          <CampoTexto rotulo="Descrição" valor={editando.descricao} erro={erros.descricao} onChange={(v) => setEditando({ ...editando, descricao: v })} />
          <div className="linha-campos">
            <CampoLista
              rotulo="Tipo" valor={editando.tipo} opcoes={["Entrada", "Saída"]} erro={erros.tipo}
              onChange={(v) => setEditando({ ...editando, tipo: v, categoria: categoriasDoTipo(estado.parametros, v).includes(editando.categoria) ? editando.categoria : "" })}
            />
            <CampoLista rotulo="Recorrente" valor={editando.recorrente} opcoes={["", "Mensal"]} onChange={(v) => setEditando({ ...editando, recorrente: v })} />
          </div>
          <CampoLista rotulo="Categoria" valor={editando.categoria} opcoes={["", ...cats]} erro={erros.categoria} onChange={(v) => setEditando({ ...editando, categoria: v })} />
          <CampoNumero rotulo="Valor" sufixo="R$" valor={editando.valor} erro={erros.valor} onChange={(v) => setEditando({ ...editando, valor: v })} />
          {editando.tipo === "Saída" && (
            <CampoCodigo valor={editando.codigoPagamento ?? ""} onChange={(v) => setEditando({ ...editando, codigoPagamento: v })} />
          )}
          <div className="botoes">
            <button className="botao primario" onClick={salvar}>Salvar</button>
            <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
          {editando.id && (
            <div className="botoes">
              <button className="botao perigo" onClick={excluir}>Excluir lançamento</button>
            </div>
          )}
        </Folha>
      )}
    </Tela>
  );
}
