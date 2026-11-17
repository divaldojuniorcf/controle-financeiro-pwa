import { useState } from "react";
import { useApp } from "../../app/estado";
import { aplicarCsv, exportarCsv, exportarJson, lerJson, resumoDaImportacao } from "../../app/transferencia";
import { LINHAS_CATEGORIAS_ENTRADA, LINHAS_CATEGORIAS_SAIDA } from "../../core/dashboard";
import { formatarData, hojeDoAparelho } from "../../core/datas";
import type { Parametros as P } from "../../core/tipos";
import { escolherArquivo } from "../../storage/arquivos";
import { PIN_VALIDO } from "../../storage/cripto";
import { CampoData, CampoNumero, Faixa, Tela } from "../componentes";

/** Nomes que a planilha usa nas regras e não podem mudar. */
const FIXAS = new Set(["Investimentos", "Rendimentos de investimentos"]);

function ListaCategorias({ titulo, itens, limite, onChange }: { titulo: string; itens: string[]; limite: number; onChange: (l: string[]) => void }) {
  const [nova, setNova] = useState("");
  return (
    <>
      <Faixa cor="tabela">{titulo}</Faixa>
      <div className="lista">
        {itens.map((c, k) => (
          <div key={k} className="item" style={{ gridTemplateColumns: "24px 1fr auto", alignItems: "center" }}>
            <span className="sec">{k + 1}</span>
            {FIXAS.has(c) ? (
              <span className="editavel">{c} <span className="etiqueta">fixa</span></span>
            ) : (
              <input
                className="editavel"
                style={{ border: 0, background: "transparent", fontSize: 16, minHeight: 32, width: "100%" }}
                value={c}
                onChange={(e) => onChange(itens.map((x, i) => (i === k ? e.target.value : x)))}
              />
            )}
            {!FIXAS.has(c) && (
              <button className="botao perigo" style={{ minHeight: 32, padding: "2px 10px" }}
                onClick={() => confirm(`Remover a categoria "${c}"?`) && onChange(itens.filter((_, i) => i !== k))}>
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
      {itens.length > limite && (
        <p className="aviso">
          Como na planilha, só as {limite} primeiras aparecem no menu de Categoria e no Dashboard.
        </p>
      )}
      <div className="botoes">
        <input className="campo" style={{ flex: "2 1 160px", minHeight: 44, padding: "8px 10px", border: "1px solid #b7c3d4", borderRadius: 8, fontSize: 16, color: "var(--editavel)" }}
          placeholder="Nova categoria" value={nova} onChange={(e) => setNova(e.target.value)} />
        <button className="botao" disabled={nova.trim() === "" || itens.includes(nova.trim())}
          onClick={() => { onChange([...itens, nova.trim()]); setNova(""); }}>
          Adicionar
        </button>
      </div>
    </>
  );
}

function Seguranca() {
  const { bloquear, trocarPin } = useApp();
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [novo, setNovo] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pinProps = { type: "password", inputMode: "numeric", pattern: "[0-9]*", autoComplete: "off", maxLength: 8, className: "pin" } as const;
  const soNumeros = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => f(e.target.value.replace(/\D/g, ""));

  async function trocar() {
    if (!PIN_VALIDO.test(novo)) return setMsg("O novo PIN deve ter de 4 a 8 números.");
    if (novo !== conf) return setMsg("Os dois PINs novos não são iguais.");
    setOcupado(true);
    try {
      await trocarPin(atual, novo);
      setMsg("PIN trocado.");
      setAtual(""); setNovo(""); setConf(""); setAberto(false);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Faixa cor="tabela">Segurança</Faixa>
      <p className="ajuda">O app pede o PIN ao abrir e depois de 1 minuto em segundo plano. Os dados ficam cifrados no aparelho.</p>
      <div className="botoes">
        <button className="botao" onClick={bloquear}>Bloquear agora</button>
        <button className="botao" onClick={() => { setAberto(!aberto); setMsg(null); }}>Trocar PIN</button>
      </div>
      {aberto && (
        <div>
          <label className="campo"><span>PIN atual</span><input {...pinProps} value={atual} onChange={soNumeros(setAtual)} /></label>
          <label className="campo"><span>Novo PIN (4 a 8 números)</span><input {...pinProps} value={novo} onChange={soNumeros(setNovo)} /></label>
          <label className="campo"><span>Repita o novo PIN</span><input {...pinProps} value={conf} onChange={soNumeros(setConf)} /></label>
          <div className="botoes"><button className="botao primario" disabled={ocupado} onClick={trocar}>{ocupado ? "Trocando…" : "Salvar novo PIN"}</button></div>
        </div>
      )}
      {msg && <p className="aviso">{msg}</p>}
    </>
  );
}

export function Parametros() {
  const { estado, ui, alterarEstado, alterarUi, substituirTudo } = useApp();
  const p = estado.parametros;
  const [msg, setMsg] = useState<string | null>(null);
  const mudar = (parcial: Partial<P>) => alterarEstado((s) => ({ ...s, parametros: { ...s.parametros, ...parcial } }));

  async function rodar(f: () => Promise<void>) {
    setMsg(null);
    try {
      await f();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg((e as Error).message);
    }
  }

  const importarJson = () => rodar(async () => {
    const arq = await escolherArquivo(".json,application/json");
    if (!arq) return;
    const { estado: novo, dataAnalise } = await lerJson(arq);
    if (!confirm(`Substituir TODOS os dados atuais por: ${resumoDaImportacao(novo)}?`)) return;
    substituirTudo(novo, { dataAnalise });
    setMsg(`Importados: ${resumoDaImportacao(novo)}`);
  });

  const importarCsv = () => rodar(async () => {
    const arq = await escolherArquivo(".csv,text/csv");
    if (!arq) return;
    const r = await aplicarCsv(arq, estado);
    if (!confirm(`Importar ${r.descricao}?`)) return;
    substituirTudo(r.estado);
    setMsg(`Importado: ${r.descricao}.`);
  });

  return (
    <Tela titulo="Parâmetros e listas" ajuda="Campos em azul são editáveis. As listas abaixo alimentam os menus de categoria dos Lançamentos e o Dashboard.">
      <Faixa cor="tabela">Parâmetros gerais</Faixa>
      <label className="campo">
        <span>Data de hoje</span>
        <select value={p.hojeFixo === null ? "atual" : "fixa"}
          onChange={(e) => mudar({ hojeFixo: e.target.value === "atual" ? null : hojeDoAparelho() })}>
          <option value="atual">Data atual ({formatarData(hojeDoAparelho())})</option>
          <option value="fixa">Data fixa</option>
        </select>
      </label>
      {p.hojeFixo !== null && (
        <CampoData rotulo="Data fixa usada como Hoje" valor={p.hojeFixo} onChange={(v) => mudar({ hojeFixo: v ?? hojeDoAparelho() })} />
      )}
      <CampoNumero rotulo="Limite de comprometimento da renda (saídas ÷ entradas)" sufixo="%" escala={100}
        valor={p.limiteComprometimento} onChange={(v) => v !== null && mudar({ limiteComprometimento: v })} />
      <div className="linha-campos">
        <CampoNumero rotulo="Dias da projeção de rendimentos" valor={p.diasProjecao} onChange={(v) => v !== null && mudar({ diasProjecao: v })} />
        <CampoNumero rotulo="Meses futuros gerados para contas recorrentes" valor={p.mesesRecorrencia} onChange={(v) => mudar({ mesesRecorrencia: v })} />
      </div>

      <ListaCategorias titulo="Categorias de saída" itens={p.categoriasSaida} limite={LINHAS_CATEGORIAS_SAIDA} onChange={(l) => mudar({ categoriasSaida: l })} />
      <ListaCategorias titulo="Categorias de entrada" itens={p.categoriasEntrada} limite={LINHAS_CATEGORIAS_ENTRADA} onChange={(l) => mudar({ categoriasEntrada: l })} />
      <p className="ajuda">Obs.: 'Investimentos' = aportes (saída). 'Rendimentos de investimentos' = rendimentos no resgate (entrada). Mantenha esses nomes.</p>

      <Faixa cor="tabela">Backup e dados</Faixa>
      <p className="ajuda">
        Os dados ficam só neste aparelho. Exporte um backup com frequência e guarde no iCloud Drive ou no computador. O arquivo exportado não é cifrado: guarde-o em local seguro.
        {" "}Último backup: {ui.ultimoBackup ? formatarData(ui.ultimoBackup.slice(0, 10)) : "nunca"}.
      </p>
      <div className="botoes">
        <button className="botao primario" onClick={() => rodar(async () => {
          await exportarJson(estado, ui.dataAnalise);
          alterarUi((u) => ({ ...u, ultimoBackup: new Date().toISOString() }));
        })}>Exportar JSON</button>
        <button className="botao" onClick={importarJson}>Importar JSON</button>
      </div>
      <p className="sec">Importar JSON aceita o backup do app e o dados.json da planilha (substitui todos os dados).</p>
      <div className="botoes">
        <button className="botao" onClick={() => rodar(() => exportarCsv(estado, "lancamentos"))}>CSV Lançamentos</button>
        <button className="botao" onClick={() => rodar(() => exportarCsv(estado, "investimentos"))}>CSV Investimentos</button>
        <button className="botao" onClick={() => rodar(() => exportarCsv(estado, "baixas"))}>CSV Baixas</button>
        <button className="botao" onClick={() => rodar(() => exportarCsv(estado, "parametros"))}>CSV Parâmetros</button>
      </div>
      <div className="botoes">
        <button className="botao" onClick={importarCsv}>Importar CSV</button>
      </div>
      <p className="sec">Importar CSV substitui só a tabela do arquivo (reconhecida pelo cabeçalho). Abre no Excel com acentos e vírgula decimal.</p>
      {msg && <p className="aviso">{msg}</p>}

      <Seguranca />
    </Tela>
  );
}
