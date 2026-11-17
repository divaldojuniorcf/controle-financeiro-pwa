import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { contasDoEstado, type Contas } from "../core/calculo";
import { hojeDoAparelho } from "../core/datas";
import type { Estado } from "../core/tipos";
import { carregar, pedirArmazenamentoPersistente, salvar, UI_PADRAO, type EstadoUi } from "../storage/db";

interface ContextoApp {
  estado: Estado;
  ui: EstadoUi;
  contas: Contas;
  alterarEstado: (f: (e: Estado) => Estado) => void;
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

type Situacao = { tipo: "carregando" } | { tipo: "vazio" } | { tipo: "pronto"; estado: Estado; ui: EstadoUi } | { tipo: "erro"; msg: string };

export function ProvedorApp({ vazio, children }: { vazio: (iniciar: ContextoApp["substituirTudo"]) => ReactNode; children: ReactNode }) {
  const [s, setS] = useState<Situacao>({ tipo: "carregando" });
  // Muda quando o dia vira ou o app volta ao primeiro plano, para recalcular "Hoje".
  const [dia, setDia] = useState(hojeDoAparelho());

  useEffect(() => {
    carregar()
      .then((g) => setS(g ? { tipo: "pronto", ...g } : { tipo: "vazio" }))
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

  // Grava a cada alteração (em sequência, para não perder a última).
  const fila = useRef(Promise.resolve());
  useEffect(() => {
    if (s.tipo !== "pronto") return;
    const g = { estado: s.estado, ui: s.ui };
    fila.current = fila.current.then(() => salvar(g)).catch((e) => console.error("Falha ao salvar", e));
  }, [s]);

  const alterarEstado = useCallback((f: (e: Estado) => Estado) => {
    setS((x) => (x.tipo === "pronto" ? { ...x, estado: f(x.estado) } : x));
  }, []);
  const alterarUi = useCallback((f: (u: EstadoUi) => EstadoUi) => {
    setS((x) => (x.tipo === "pronto" ? { ...x, ui: f(x.ui) } : x));
  }, []);
  const substituirTudo = useCallback((estado: Estado, ui?: Partial<EstadoUi>) => {
    setS((x) => ({ tipo: "pronto", estado, ui: { ...(x.tipo === "pronto" ? x.ui : UI_PADRAO), ...ui } }));
  }, []);

  const estado = s.tipo === "pronto" ? s.estado : null;
  const contas = useMemo(() => (estado ? contasDoEstado(estado) : null), [estado, dia]);

  if (s.tipo === "carregando") return <div className="centro">Carregando…</div>;
  if (s.tipo === "erro") return <div className="centro erro">Não foi possível abrir os dados: {s.msg}</div>;
  if (s.tipo === "vazio") return <>{vazio(substituirTudo)}</>;
  return (
    <Ctx.Provider value={{ estado: s.estado, ui: s.ui, contas: contas!, alterarEstado, alterarUi, substituirTudo }}>
      {children}
    </Ctx.Provider>
  );
}
