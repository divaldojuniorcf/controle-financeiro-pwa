import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { aplicarRecorrencia, contasDoEstado, type Contas } from "../core/calculo";
import { hojeDoAparelho } from "../core/datas";
import type { Estado } from "../core/tipos";
import { carregar, pedirArmazenamentoPersistente, salvar, UI_PADRAO, type EstadoUi } from "../storage/db";

interface ContextoApp {
  estado: Estado;
  ui: EstadoUi;
  contas: Contas;
  /** `recorrencia`: roda a geração "Mensal" depois da alteração (campo Recorrente mudou). */
  alterarEstado: (f: (e: Estado) => Estado, opcoes?: { recorrencia?: boolean }) => void;
  alterarUi: (f: (u: EstadoUi) => EstadoUi) => void;
  substituirTudo: (estado: Estado, ui?: Partial<EstadoUi>) => void;
}

const Ctx = createContext<ContextoApp | null>(null);

export function useApp(): ContextoApp {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do ProvedorApp");
  return c;
}

export const novoId = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Pronto = { tipo: "pronto"; estado: Estado; ui: EstadoUi; aviso: string | null };
type Situacao = { tipo: "carregando" } | { tipo: "vazio" } | Pronto | { tipo: "erro"; msg: string };

/** Gera as recorrências "Mensal" que faltam e avisa quantas linhas entraram. */
function comRecorrencia(x: Pronto): Pronto {
  const r = aplicarRecorrencia(x.estado, novoId);
  if (r.geradas === 0) return x;
  const n = r.geradas;
  return { ...x, estado: r.estado, aviso: `${n} lançamento${n > 1 ? "s" : ""} recorrente${n > 1 ? "s" : ""} (Mensal) gerado${n > 1 ? "s" : ""} no final de Lançamentos.` };
}

export function ProvedorApp({ vazio, children }: { vazio: (iniciar: ContextoApp["substituirTudo"]) => ReactNode; children: ReactNode }) {
  const [s, setS] = useState<Situacao>({ tipo: "carregando" });
  // Muda quando o dia vira ou o app volta ao primeiro plano, para recalcular "Hoje".
  const [dia, setDia] = useState(hojeDoAparelho());

  useEffect(() => {
    carregar()
      // Ao abrir o app: gera as recorrências que faltam (macro Workbook_Open).
      .then((g) => setS(g ? comRecorrencia({ tipo: "pronto", ...g, aviso: null }) : { tipo: "vazio" }))
      .catch((e: Error) => setS({ tipo: "erro", msg: e.message }));
    void pedirArmazenamentoPersistente();
    const ver = () => document.visibilityState === "visible" && setDia(hojeDoAparelho());
    document.addEventListener("visibilitychange", ver);
    const t = setInterval(() => setDia(hojeDoAparelho()), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", ver);
      clearInterval(t);
    };
  }, []);

  // Dia novo com o app aberto equivale a abrir o app de novo.
  useEffect(() => {
    setS((x) => (x.tipo === "pronto" ? comRecorrencia(x) : x));
  }, [dia]);

  // Grava a cada alteração (em sequência, para não perder a última).
  const fila = useRef(Promise.resolve());
  useEffect(() => {
    if (s.tipo !== "pronto") return;
    const g = { estado: s.estado, ui: s.ui };
    fila.current = fila.current.then(() => salvar(g)).catch((e) => console.error("Falha ao salvar", e));
  }, [s]);

  const alterarEstado = useCallback((f: (e: Estado) => Estado, opcoes?: { recorrencia?: boolean }) => {
    setS((x) => {
      if (x.tipo !== "pronto") return x;
      const novo: Pronto = { ...x, estado: f(x.estado) };
      return opcoes?.recorrencia ? comRecorrencia(novo) : novo;
    });
  }, []);
  const alterarUi = useCallback((f: (u: EstadoUi) => EstadoUi) => {
    setS((x) => (x.tipo === "pronto" ? { ...x, ui: f(x.ui) } : x));
  }, []);
  const substituirTudo = useCallback((estado: Estado, ui?: Partial<EstadoUi>) => {
    // Dados importados entram como num app recém-aberto.
    setS((x) => comRecorrencia({ tipo: "pronto", estado, ui: { ...(x.tipo === "pronto" ? x.ui : UI_PADRAO), ...ui }, aviso: null }));
  }, []);

  const estado = s.tipo === "pronto" ? s.estado : null;
  const contas = useMemo(() => (estado ? contasDoEstado(estado) : null), [estado, dia]);

  if (s.tipo === "carregando") return <div className="centro">Carregando…</div>;
  if (s.tipo === "erro") return <div className="centro erro">Não foi possível abrir os dados: {s.msg}</div>;
  if (s.tipo === "vazio") return <>{vazio(substituirTudo)}</>;
  return (
    <Ctx.Provider value={{ estado: s.estado, ui: s.ui, contas: contas!, alterarEstado, alterarUi, substituirTudo }}>
      {s.aviso && (
        <div className="faixa-aviso" role="status">
          <span>{s.aviso}</span>
          <button onClick={() => setS((x) => (x.tipo === "pronto" ? { ...x, aviso: null } : x))} aria-label="Fechar aviso">✕</button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
