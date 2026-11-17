import { useEffect, useState, type ReactNode } from "react";
import { Tela } from "../ui/componentes";
import { BoasVindas } from "../ui/telas/BoasVindas";
import { Contas } from "../ui/telas/Contas";
import { Investimentos } from "../ui/telas/Investimentos";
import { Lancamentos } from "../ui/telas/Lancamentos";
import { PagasRecebidas } from "../ui/telas/PagasRecebidas";
import { Parametros } from "../ui/telas/Parametros";
import { ProvedorApp } from "./estado";

type Aba = "dashboard" | "pagar" | "receber" | "pagas" | "lancamentos" | "investimentos" | "parametros";

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONES: Record<Aba, ReactNode> = {
  dashboard: <svg viewBox="0 0 24 24" {...s}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  pagar: <svg viewBox="0 0 24 24" {...s}><path d="M12 4v14M6 12l6 6 6-6" /></svg>,
  receber: <svg viewBox="0 0 24 24" {...s}><path d="M12 20V6M6 12l6-6 6 6" /></svg>,
  pagas: <svg viewBox="0 0 24 24" {...s}><path d="M4 12l5 5L20 6" /></svg>,
  lancamentos: <svg viewBox="0 0 24 24" {...s}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>,
  investimentos: <svg viewBox="0 0 24 24" {...s}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>,
  parametros: <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>,
};

const ABAS: { id: Aba; rotulo: string; curto: string }[] = [
  { id: "dashboard", rotulo: "Dashboard", curto: "Dashboard" },
  { id: "pagar", rotulo: "Pagar", curto: "Pagar" },
  { id: "receber", rotulo: "Receber", curto: "Receber" },
  { id: "pagas", rotulo: "Pagas/Recebidas", curto: "Pagas/Rec." },
  { id: "lancamentos", rotulo: "Lançamentos", curto: "Lançam." },
  { id: "investimentos", rotulo: "Investimentos", curto: "Investim." },
  { id: "parametros", rotulo: "Parâmetros", curto: "Parâm." },
];

function EmConstrucao({ titulo, fase }: { titulo: string; fase: number }) {
  return <Tela titulo={titulo} ajuda={`Esta tela chega na Fase ${fase}.`}>{null}</Tela>;
}

function Telas() {
  const [aba, setAba] = useState<Aba>(() => (sessionStorage.getItem("aba") as Aba | null) ?? "lancamentos");
  useEffect(() => {
    sessionStorage.setItem("aba", aba);
    window.scrollTo(0, 0);
  }, [aba]);

  return (
    <div className="app">
      {aba === "dashboard" && <EmConstrucao titulo="Dashboard Financeiro" fase={5} />}
      {aba === "pagar" && <Contas key="pagar" tipo="Pagar" />}
      {aba === "receber" && <Contas key="receber" tipo="Receber" />}
      {aba === "pagas" && <PagasRecebidas />}
      {aba === "lancamentos" && <Lancamentos />}
      {aba === "investimentos" && <Investimentos />}
      {aba === "parametros" && <Parametros />}
      <nav className="nav">
        {ABAS.map((a) => (
          <button key={a.id} className={aba === a.id ? "ativa" : ""} onClick={() => setAba(a.id)} aria-label={a.rotulo}>
            {ICONES[a.id]}
            <span>{a.curto}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <ProvedorApp vazio={(iniciar) => <BoasVindas iniciar={iniciar} />}>
      <Telas />
    </ProvedorApp>
  );
}
