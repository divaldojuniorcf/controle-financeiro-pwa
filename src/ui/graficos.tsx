// Os 7 gráficos do Dashboard (seção 6), com tipos, títulos, cores e rótulos da planilha.
import type { ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Dashboard } from "../core/dashboard";
import { nomeDoMes } from "../core/datas";
import { fixo, moeda, percentual } from "../core/numeros";

// Tema do Excel usado na planilha (accent1..6) e as variações 40% mais escuras (lumMod 60%).
const TEMA = ["#156082", "#E97132", "#196B24", "#0F9ED5", "#A02B93", "#4EA72E"];
const TEMA_ESCURO = ["#0D3A4E", "#994010", "#0F4016", "#095F80", "#601A58", "#2F641C"];
const PIZZA = [...TEMA, ...TEMA_ESCURO];
const ENTRADAS = "#548235";
const SAIDAS = "#C00000";

const EIXO = { fontSize: 11, fill: "#595959" };
const GRADE = "#E3E7ED";
const LEGENDA = { fontSize: 12, color: "#1a1a1a" } as const;
const mesCurto = (serial: number) => nomeDoMes(serial).slice(0, 3);
const milhar = (v: number) => fixo(v, 0); // #.##0
const pct0 = (v: number) => `${fixo(v * 100, 0)}%`; // 0%

function Grafico({ titulo, altura = 260, children }: { titulo: string; altura?: number; children: ReactNode }) {
  return (
    <figure className="grafico">
      <figcaption>{titulo}</figcaption>
      <div style={{ width: "100%", height: altura }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </figure>
  );
}

const dicaMoeda = (v: number) => moeda(v);

/** 1. Entradas × Saídas por mês: colunas agrupadas, legenda embaixo. */
export function GraficoEntradasSaidas({ d }: { d: Dashboard }) {
  const dados = d.mensal.map((m) => ({ mes: mesCurto(m.mes), Entradas: m.entradas, Saídas: m.saidas }));
  return (
    <Grafico titulo="Entradas × Saídas por mês (ano analisado)">
      <BarChart data={dados} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={GRADE} />
        <XAxis dataKey="mes" tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} interval={0} />
        <YAxis tick={EIXO} tickFormatter={milhar} width={52} axisLine={false} tickLine={false} />
        <Tooltip formatter={dicaMoeda} cursor={{ fill: "rgba(21,96,130,.08)" }} />
        <Legend verticalAlign="bottom" wrapperStyle={LEGENDA} />
        <Bar dataKey="Entradas" fill={ENTRADAS} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Saídas" fill={SAIDAS} radius={[3, 3, 0, 0]} />
      </BarChart>
    </Grafico>
  );
}

/** 2. Saldo mensal e acumulado: linhas com marcadores, legenda embaixo. */
export function GraficoSaldo({ d }: { d: Dashboard }) {
  const dados = d.mensal.map((m) => ({ mes: mesCurto(m.mes), Saldo: m.saldo, "Saldo acumulado": m.saldoAcumulado }));
  return (
    <Grafico titulo="Saldo mensal e acumulado (ano analisado)">
      <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRADE} />
        <XAxis dataKey="mes" tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} interval={0} padding={{ left: 12, right: 12 }} />
        <YAxis tick={EIXO} tickFormatter={milhar} width={56} axisLine={false} tickLine={false} />
        <Tooltip formatter={dicaMoeda} />
        <Legend verticalAlign="bottom" wrapperStyle={LEGENDA} />
        <Line dataKey="Saldo" stroke={TEMA[0]} strokeWidth={2} dot={{ r: 4, fill: TEMA[0] }} isAnimationActive={false} />
        <Line dataKey="Saldo acumulado" stroke={TEMA[1]} strokeWidth={2} dot={{ r: 4, fill: TEMA[1] }} isAnimationActive={false} />
      </LineChart>
    </Grafico>
  );
}

/** Rótulo de % fora da fatia; zero não aparece (formato "0%;;;"). */
function rotuloPct({ cx, cy, midAngle, outerRadius, percent, index }: { cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; index: number }) {
  if (!percent || percent < 0.005) return null;
  // Fatias pequenas vizinhas: alterna a distância para os rótulos não se sobreporem.
  const r = outerRadius + 12 + (percent < 0.06 && index % 2 === 1 ? 12 : 0);
  const rad = (-midAngle * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  return (
    <text x={x} y={y} fill="#1a1a1a" fontSize={11} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {pct0(percent)}
    </text>
  );
}

function Pizza({ titulo, dados, legenda, altura, rosca }: {
  titulo: string; dados: { nome: string; valor: number }[]; legenda: "right" | "bottom"; altura: number; rosca?: boolean;
}) {
  const total = dados.reduce((s, x) => s + x.valor, 0);
  const lateral = legenda === "right";
  return (
    <Grafico titulo={titulo} altura={altura}>
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Tooltip formatter={(v: number) => `${moeda(v)} (${total > 0 ? percentual(v / total) : "0,0%"})`} />
        <Legend
          layout={lateral ? "vertical" : "horizontal"}
          align={lateral ? "right" : "center"}
          verticalAlign={lateral ? "middle" : "bottom"}
          iconSize={10}
          wrapperStyle={{ ...LEGENDA, fontSize: 11, ...(lateral ? { width: "40%", lineHeight: "16px" } : {}) }}
        />
        <Pie
          data={dados}
          dataKey="valor"
          nameKey="nome"
          cx={lateral ? "34%" : "50%"}
          cy={lateral ? "50%" : "45%"}
          outerRadius={lateral ? "42%" : "70%"}
          innerRadius={rosca ? (lateral ? "46%" : "52%") : 0}
          stroke="#fff"
          strokeWidth={2}
          label={rotuloPct}
          labelLine={false}
          isAnimationActive={false}
        >
          {dados.map((_, k) => <Cell key={k} fill={PIZZA[k % PIZZA.length]} />)}
        </Pie>
        {total === 0 && (
          <text x="50%" y="45%" textAnchor="middle" fill="#595959" fontSize={12}>Sem valores no período</text>
        )}
      </PieChart>
    </Grafico>
  );
}

/** 3. Despesas por categoria (mês): pizza, legenda à direita. */
export function GraficoDespesas({ d }: { d: Dashboard }) {
  return <Pizza titulo="Despesas por categoria (mês)" legenda="right" altura={260}
    dados={d.categoriasSaida.map((c) => ({ nome: c.categoria, valor: c.valor }))} />;
}

/** 4. Fontes de entrada (mês): pizza, legenda à direita (como na planilha). */
export function GraficoFontes({ d }: { d: Dashboard }) {
  return <Pizza titulo="Fontes de entrada (mês)" legenda="right" altura={220}
    dados={d.fontesEntrada.map((c) => ({ nome: c.categoria, valor: c.valor }))} />;
}

/** 5. Composição da carteira (hoje): rosca (furo 75%), legenda embaixo. */
export function GraficoCarteira({ d }: { d: Dashboard }) {
  return <Pizza titulo="Composição da carteira (hoje)" legenda="bottom" altura={260} rosca
    dados={d.composicaoCarteira.map((c) => ({ nome: c.nome, valor: c.valor }))} />;
}

/** 6. Situação das contas: colunas empilhadas (Baixado e Em aberto), legenda embaixo. */
export function GraficoSituacao({ d }: { d: Dashboard }) {
  const dados = d.situacaoContas.map((s) => ({ nome: s.nome, Baixado: s.baixado, "Em aberto": s.emAberto }));
  return (
    <Grafico titulo="Situação das contas">
      <BarChart data={dados} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid vertical={false} stroke={GRADE} />
        <XAxis dataKey="nome" tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} />
        <YAxis tick={EIXO} tickFormatter={milhar} width={56} axisLine={false} tickLine={false} />
        <Tooltip formatter={dicaMoeda} cursor={{ fill: "rgba(21,96,130,.08)" }} />
        <Legend verticalAlign="bottom" wrapperStyle={LEGENDA} />
        <Bar dataKey="Baixado" stackId="s" fill={TEMA[0]} stroke="#fff" strokeWidth={1} />
        <Bar dataKey="Em aberto" stackId="s" fill={TEMA[1]} stroke="#fff" strokeWidth={1} radius={[3, 3, 0, 0]} />
      </BarChart>
    </Grafico>
  );
}

/** 7. % da renda comprometida por categoria (mês): barras horizontais, sem legenda, rótulo 0%. */
export function GraficoComprometimento({ d }: { d: Dashboard }) {
  const dados = d.categoriasSaida.map((c) => ({ nome: c.categoria, pct: c.pctRenda }));
  return (
    <Grafico titulo="% da renda comprometida por categoria (mês)" altura={Math.max(220, dados.length * 26 + 40)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid horizontal={false} stroke={GRADE} />
        <XAxis type="number" tick={EIXO} tickFormatter={pct0} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="nome" tick={EIXO} width={118} tickLine={false} axisLine={{ stroke: GRADE }} interval={0} />
        <Tooltip formatter={(v: number) => percentual(v)} cursor={{ fill: "rgba(21,96,130,.08)" }} />
        <Bar dataKey="pct" name="% da renda" fill={TEMA[0]} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="pct" position="right" formatter={pct0} style={{ fontSize: 11, fill: "#1a1a1a" }} />
        </Bar>
      </BarChart>
    </Grafico>
  );
}
