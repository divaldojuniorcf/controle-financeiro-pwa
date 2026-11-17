import { useEffect, useState, type ReactNode } from "react";
import { lerNumero } from "../core/csv";
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
