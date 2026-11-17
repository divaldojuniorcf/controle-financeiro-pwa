import { useEffect, useState, type ReactNode } from "react";
import type { MarcaDia } from "../core/contas";
import { lerNumero } from "../core/csv";
import { date, diaDaSemana, eomonth, formatarData, isoParaSerial, nomeDoMes, serialParaIso } from "../core/datas";
import { moedaCard } from "../core/numeros";
import type { DataISO } from "../core/tipos";

export function Tela({ titulo, ajuda, grande, children }: { titulo: string; ajuda?: ReactNode; grande?: boolean; children: ReactNode }) {
  return (
    <main className="conteudo">
      <h1 className={`titulo-tela${grande ? " grande" : ""}`}>{titulo}</h1>
      {ajuda && <p className="ajuda">{ajuda}</p>}
      {children}
    </main>
  );
}

export function Faixa({ cor, children }: { cor: "escura" | "mes" | "cinza" | "tabela"; children: ReactNode }) {
  return <div className={`faixa ${cor}`}>{children}</div>;
}

/** Card de valor em R$: negativos em vermelho, zero como "-". */
export function Card({ rotulo, valor, texto, classe }: { rotulo: string; valor?: number; texto?: ReactNode; classe?: string }) {
  const cls = classe ?? (valor !== undefined && valor < 0 ? "neg" : "");
  return (
    <div className="card">
      <div className="rotulo">{rotulo}</div>
      <div className={`valor ${cls}`}>{texto ?? (valor !== undefined ? moedaCard(valor) : "")}</div>
    </div>
  );
}

export function CampoData({
  rotulo, valor, onChange, amarelo, erro,
}: { rotulo: string; valor: DataISO | null; onChange: (v: DataISO | null) => void; amarelo?: boolean; erro?: string }) {
  return (
    <label className={`campo${amarelo ? " amarelo" : ""}`}>
      <span>{rotulo}</span>
      <input type="date" value={valor ?? ""} onChange={(e) => onChange(e.target.value || null)} />
      {erro && <span className="erro-campo">{erro}</span>}
    </label>
  );
}

/** Data de filtro (amarela, seção 7): vazio tem significado ("mês atual", "Hoje"). */
export function CampoFiltroData({
  rotulo, valor, onChange,
}: { rotulo: string; valor: DataISO | null; onChange: (v: DataISO | null) => void }) {
  return (
    <div className="campo amarelo">
      <span>{rotulo}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" value={valor ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label={rotulo} />
        {valor && <button className="botao" onClick={() => onChange(null)}>Limpar</button>}
      </div>
    </div>
  );
}

export function CampoTexto({ rotulo, valor, onChange, erro }: { rotulo: string; valor: string; onChange: (v: string) => void; erro?: string }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input type="text" value={valor} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      {erro && <span className="erro-campo">{erro}</span>}
    </label>
  );
}

export function CampoLista({
  rotulo, valor, opcoes, onChange, erro,
}: { rotulo: string; valor: string; opcoes: string[]; onChange: (v: string) => void; erro?: string }) {
  const lista = valor !== "" && !opcoes.includes(valor) ? [...opcoes, valor] : opcoes;
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        {lista.map((o) => <option key={o} value={o}>{o === "" ? "(vazio)" : o}</option>)}
      </select>
      {erro && <span className="erro-campo">{erro}</span>}
    </label>
  );
}

/** Número com vírgula decimal e teclado numérico do iPhone. `escala` 100 mostra 0,135 como 13,5. */
export function CampoNumero({
  rotulo, valor, onChange, erro, escala = 1, sufixo,
}: { rotulo: string; valor: number | null; onChange: (v: number | null) => void; erro?: string; escala?: number; sufixo?: string }) {
  const paraTexto = (v: number | null) => (v === null ? "" : String(Number((v * escala).toPrecision(12))).replace(".", ","));
  const [texto, setTexto] = useState(paraTexto(valor));
  const [invalido, setInvalido] = useState(false);
  useEffect(() => {
    // Atualiza se o valor mudar por fora (ex.: outro registro aberto).
    setTexto((t) => {
      try {
        const atual = lerNumero(t, rotulo);
        return atual !== null && valor !== null && Math.abs(atual / escala - valor) < 1e-12 ? t : paraTexto(valor);
      } catch {
        return paraTexto(valor);
      }
    });
  }, [valor]);
  return (
    <label className="campo">
      <span>{rotulo}{sufixo ? ` (${sufixo})` : ""}</span>
      <input
        type="text"
        inputMode="decimal"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          try {
            const n = lerNumero(e.target.value, rotulo);
            setInvalido(false);
            onChange(n === null ? null : n / escala);
          } catch {
            setInvalido(true);
          }
        }}
      />
      {(erro || invalido) && <span className="erro-campo">{invalido ? "Número inválido" : erro}</span>}
    </label>
  );
}

export function Folha({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <div className="fundo-folha" onClick={aoFechar}>
      <div className="folha" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * "Data escolhida" com calendário próprio: bolinha vermelha nos dias com conta em aberto,
 * verde nos dias em que tudo já foi baixado. Vazio = mês atual.
 */
export function CalendarioFiltro({
  rotulo, valor, onChange, marcas, hoje,
}: { rotulo: string; valor: DataISO | null; onChange: (v: DataISO | null) => void; marcas: Map<number, MarcaDia>; hoje: number }) {
  const [aberto, setAberto] = useState(false);
  const base = valor ? isoParaSerial(valor) : hoje;
  const [mes, setMes] = useState<[number, number]>(() => {
    const [a, m] = serialParaIso(base).split("-").map(Number);
    return [a!, m!];
  });
  const abrir = () => {
    const [a, m] = serialParaIso(base).split("-").map(Number);
    setMes([a!, m!]);
    setAberto(true);
  };
  const [ano, m] = mes;
  const primeiro = date(ano, m, 1);
  const dias = eomonth(primeiro, 0) - primeiro + 1;
  const vazios = diaDaSemana(primeiro);
  const selecionado = valor ? isoParaSerial(valor) : null;
  const mover = (delta: number) => setMes(([a, mm]) => {
    const n = date(a, mm + delta, 1);
    const [na, nm] = serialParaIso(n).split("-").map(Number);
    return [na!, nm!];
  });

  return (
    <div className="campo amarelo">
      <span>{rotulo}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="campo-data" onClick={abrir} aria-label={`${rotulo}: ${valor ? formatarData(valor) : "vazio"}`}>
          {valor ? formatarData(valor) : "Escolher data"}
          <span aria-hidden="true">📅</span>
        </button>
        {valor && <button type="button" className="botao" onClick={() => onChange(null)}>Limpar</button>}
      </div>
      {aberto && (
        <Folha titulo={rotulo} aoFechar={() => setAberto(false)}>
          <div className="cal-topo">
            <button type="button" className="botao" onClick={() => mover(-1)} aria-label="Mês anterior">‹</button>
            <span className="forte">{nomeDoMes(primeiro).replace(/^./, (l) => l.toUpperCase())} de {ano}</span>
            <button type="button" className="botao" onClick={() => mover(1)} aria-label="Próximo mês">›</button>
          </div>
          <div className="cal-grade" role="grid">
            {SEMANA.map((s, k) => <span key={`s${k}`} className="cal-semana">{s}</span>)}
            {Array.from({ length: vazios }, (_, k) => <span key={`v${k}`} />)}
            {Array.from({ length: dias }, (_, k) => {
              const d = primeiro + k;
              const marca = marcas.get(d);
              return (
                <button
                  type="button"
                  key={d}
                  className={`cal-dia${d === selecionado ? " sel" : ""}${d === hoje ? " hoje" : ""}`}
                  onClick={() => { onChange(serialParaIso(d)); setAberto(false); }}
                  aria-label={`${formatarData(d)}${marca === "aberto" ? ", com conta em aberto" : marca === "pago" ? ", contas baixadas" : ""}`}
                >
                  {k + 1}
                  <span className={`ponto ${marca ?? ""}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <p className="cal-legenda">
            <span className="ponto aberto" /> Em aberto <span className="ponto pago" /> Tudo baixado
          </p>
          <div className="botoes">
            <button type="button" className="botao" onClick={() => { onChange(null); setAberto(false); }}>Mês atual (limpar)</button>
            <button type="button" className="botao" onClick={() => setAberto(false)}>Fechar</button>
          </div>
        </Folha>
      )}
    </div>
  );
}

/** Copia para a área de transferência (com alternativa para navegadores antigos). */
export async function copiarTexto(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    return;
  } catch {
    /* tenta o método antigo */
  }
  const t = document.createElement("textarea");
  t.value = texto;
  t.setAttribute("readonly", "");
  t.style.position = "fixed";
  t.style.opacity = "0";
  document.body.appendChild(t);
  t.select();
  t.setSelectionRange(0, texto.length);
  const ok = document.execCommand("copy");
  t.remove();
  if (!ok) throw new Error("Não foi possível copiar. Toque e segure no código para copiar manualmente.");
}

/** Mensagem rápida acima da barra de abas. */
export function Aviso({ texto, aoFechar }: { texto: string | null; aoFechar: () => void }) {
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(aoFechar, 6000);
    return () => clearTimeout(t);
  }, [texto, aoFechar]);
  if (!texto) return null;
  return (
    <div className="toast" role="status" onClick={aoFechar}>
      {texto}
    </div>
  );
}
