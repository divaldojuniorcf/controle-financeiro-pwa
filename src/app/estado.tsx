import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { aplicarRecorrencia, contasDoEstado, type Contas } from "../core/calculo";
import { hojeDoAparelho } from "../core/datas";
import type { Estado } from "../core/tipos";
import { abrirComPin, derivarChave, ITERACOES, novoSalt, type Cifrado } from "../storage/cripto";
import {
  apagarTudo, completarUi, lerConviteLocal, lerSituacao, pedirArmazenamentoPersistente, salvarCifrado, salvarConviteLocal, UI_PADRAO,
  type ConviteLocal, type EstadoUi, type Gravado,
} from "../storage/db";
import { AcessoBloqueado, SemConexao, TelaConvite } from "../ui/telas/Convite";
import { CriarPin, Desbloquear } from "../ui/telas/Pin";
import { confirmarConvite, dentroDoPrazoOffline, INTERVALO_CONFIRMACAO_MS } from "./convite";

interface ContextoApp {
  estado: Estado;
  ui: EstadoUi;
  contas: Contas;
  /** `recorrencia`: roda a geração "Mensal" depois da alteração (campo Recorrente mudou). */
  alterarEstado: (f: (e: Estado) => Estado, opcoes?: { recorrencia?: boolean }) => void;
  alterarUi: (f: (u: EstadoUi) => EstadoUi) => void;
  substituirTudo: (estado: Estado, ui?: Partial<EstadoUi>) => void;
  bloquear: () => void;
  /** Lança Error("PIN incorreto.") se o PIN atual estiver errado. */
  trocarPin: (atual: string, novo: string) => Promise<void>;
}

const Ctx = createContext<ContextoApp | null>(null);

export function useApp(): ContextoApp {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do ProvedorApp");
  return c;
}

export const novoId = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Bloqueia de novo se o app ficar em segundo plano por mais que isto. */
const BLOQUEIO_MS = 60_000;

interface Cofre { chave: CryptoKey; salt: Uint8Array; iteracoes: number }
type Pronto = { tipo: "pronto"; estado: Estado; ui: EstadoUi; aviso: string | null; cofre: Cofre };
type Situacao =
  | { tipo: "carregando" }
  | { tipo: "vazio" }
  | { tipo: "criar-pin"; pendente: Gravado; migracao: boolean }
  | { tipo: "bloqueado"; cifrado: Cifrado }
  | { tipo: "convite" }
  | { tipo: "acesso-bloqueado"; cifrado: Cifrado | null }
  | { tipo: "sem-conexao" }
  | Pronto
  | { tipo: "erro"; msg: string };

/** Gera as recorrências "Mensal" que faltam e avisa quantas linhas entraram. */
function comRecorrencia(x: Pronto): Pronto {
  const r = aplicarRecorrencia(x.estado, novoId);
  if (r.geradas === 0) return x;
  const n = r.geradas;
  return { ...x, estado: r.estado, aviso: `${n} lançamento${n > 1 ? "s" : ""} recorrente${n > 1 ? "s" : ""} (Mensal) gerado${n > 1 ? "s" : ""} no final de Lançamentos.` };
}

/** Situação dos dados ao abrir: PIN, migração ou nenhum dado ainda. */
async function situacaoDosDados(): Promise<Situacao> {
  const g = await lerSituacao();
  if (g.tipo === "cifrado") return { tipo: "bloqueado", cifrado: g.cifrado };
  if (g.tipo === "sem-cifra") return { tipo: "criar-pin", pendente: g.gravado, migracao: true };
  return { tipo: "vazio" };
}

/**
 * Confere o convite antes de tudo. Aparelhos que já tinham dados antes dos convites ficam isentos;
 * instalações novas precisam de convite. Sem internet, vale por 7 dias desde a última confirmação.
 */
async function verificarAcesso(): Promise<"livre" | Situacao> {
  const [g, c] = await Promise.all([lerSituacao(), lerConviteLocal()]);
  if (!c) {
    if (g.tipo === "vazio") return { tipo: "convite" };
    await salvarConviteLocal({ isento: true });
    return "livre";
  }
  if (c.isento) return "livre";
  const r = await confirmarConvite(c);
  if (r === "ok") {
    await salvarConviteLocal({ ...c, ultimaConfirmacao: Date.now() });
    return "livre";
  }
  if (r === "sem-conexao") return dentroDoPrazoOffline(c.ultimaConfirmacao) ? "livre" : { tipo: "sem-conexao" };
  return { tipo: "acesso-bloqueado", cifrado: g.tipo === "cifrado" ? g.cifrado : null };
}

export function ProvedorApp({ vazio, children }: { vazio: (iniciar: ContextoApp["substituirTudo"]) => ReactNode; children: ReactNode }) {
  const [s, setS] = useState<Situacao>({ tipo: "carregando" });
  // Muda quando o dia vira ou o app volta ao primeiro plano, para recalcular "Hoje".
  const [dia, setDia] = useState(hojeDoAparelho());
  const fila = useRef(Promise.resolve());

  const bloquear = useCallback(() => {
    // Espera a última gravação e volta para a tela do PIN.
    fila.current = fila.current.then(async () => {
      const g = await lerSituacao();
      if (g.tipo === "cifrado") setS((x) => (x.tipo === "pronto" ? { tipo: "bloqueado", cifrado: g.cifrado } : x));
    });
  }, []);

  const ultimaVerificacao = useRef(0);
  const abrir = useCallback(async () => {
    try {
      const a = await verificarAcesso();
      ultimaVerificacao.current = Date.now();
      setS(a === "livre" ? await situacaoDosDados() : a);
    } catch (e) {
      setS({ tipo: "erro", msg: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void abrir();
    void pedirArmazenamentoPersistente();

    let escondidoEm: number | null = null;
    const ver = () => {
      if (document.visibilityState === "hidden") {
        escondidoEm = Date.now();
        return;
      }
      if (escondidoEm !== null && Date.now() - escondidoEm >= BLOQUEIO_MS) bloquear();
      escondidoEm = null;
      setDia(hojeDoAparelho());
      // App aberto há muito tempo: confere o convite de novo (é aqui que um bloqueio passa a valer).
      if (Date.now() - ultimaVerificacao.current >= INTERVALO_CONFIRMACAO_MS) {
        ultimaVerificacao.current = Date.now();
        void verificarAcesso().then((a) => {
          if (a !== "livre") setS(a);
        });
      }
    };
    document.addEventListener("visibilitychange", ver);
    const t = setInterval(() => setDia(hojeDoAparelho()), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", ver);
      clearInterval(t);
    };
  }, [bloquear, abrir]);

  // Dia novo com o app aberto equivale a abrir o app de novo.
  useEffect(() => {
    setS((x) => (x.tipo === "pronto" ? comRecorrencia(x) : x));
  }, [dia]);

  // Grava cifrado a cada alteração (em sequência, para não perder a última).
  useEffect(() => {
    if (s.tipo !== "pronto") return;
    const g = { estado: s.estado, ui: s.ui };
    const { chave, salt, iteracoes } = s.cofre;
    fila.current = fila.current.then(() => salvarCifrado(g, chave, salt, iteracoes)).catch((e) => console.error("Falha ao salvar", e));
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
    setS((x) => {
      if (x.tipo === "pronto") {
        // Dados importados entram como num app recém-aberto.
        return comRecorrencia({ ...x, estado, ui: { ...x.ui, ...ui }, aviso: null });
      }
      // Primeira importação: falta criar o PIN.
      return { tipo: "criar-pin", pendente: { estado, ui: { ...UI_PADRAO, ...ui, inicio: new Date().toISOString() } }, migracao: false };
    });
  }, []);

  const trocarPin = useCallback(async (atual: string, novo: string) => {
    await fila.current;
    const g = await lerSituacao();
    if (g.tipo !== "cifrado") throw new Error("Dados não encontrados.");
    await abrirComPin(atual, g.cifrado); // lança PinIncorreto
    const salt = novoSalt();
    const chave = await derivarChave(novo, salt);
    setS((x) => (x.tipo === "pronto" ? { ...x, cofre: { chave, salt, iteracoes: ITERACOES } } : x));
  }, []);

  async function criarPin(pin: string) {
    if (s.tipo !== "criar-pin") return;
    const salt = novoSalt();
    const chave = await derivarChave(pin, salt);
    const g = s.pendente;
    setS(comRecorrencia({
      tipo: "pronto", estado: g.estado, ui: { ...g.ui, inicio: g.ui.inicio ?? new Date().toISOString() }, aviso: null,
      cofre: { chave, salt, iteracoes: ITERACOES },
    }));
  }

  async function desbloquear(pin: string) {
    if (s.tipo !== "bloqueado") return;
    const { valor, chave } = await abrirComPin<Gravado>(pin, s.cifrado); // lança PinIncorreto
    const g = completarUi(valor);
    // Abrir o app: gera as recorrências que faltam (macro Workbook_Open).
    setS(comRecorrencia({
      tipo: "pronto", ...g, aviso: null,
      cofre: { chave, salt: s.cifrado.salt, iteracoes: s.cifrado.iteracoes },
    }));
  }

  async function esqueciPin() {
    await apagarTudo();
    setS({ tipo: "vazio" });
  }

  const estado = s.tipo === "pronto" ? s.estado : null;
  const contas = useMemo(() => (estado ? contasDoEstado(estado) : null), [estado, dia]);

  if (s.tipo === "carregando") return <div className="centro">Carregando…</div>;
  if (s.tipo === "erro") return <div className="centro erro">Não foi possível abrir os dados: {s.msg}</div>;
  if (s.tipo === "vazio") return <>{vazio(substituirTudo)}</>;
  if (s.tipo === "criar-pin") return <CriarPin migracao={s.migracao} aoCriar={criarPin} />;
  if (s.tipo === "bloqueado") return <Desbloquear aoDesbloquear={desbloquear} aoEsquecer={esqueciPin} />;
  if (s.tipo === "convite")
    return <TelaConvite aoUsar={async (c: ConviteLocal) => { await salvarConviteLocal(c); setS(await situacaoDosDados()); }} />;
  if (s.tipo === "acesso-bloqueado") return <AcessoBloqueado cifrado={s.cifrado} />;
  if (s.tipo === "sem-conexao") return <SemConexao aoTentar={() => { setS({ tipo: "carregando" }); void abrir(); }} />;
  return (
    <Ctx.Provider value={{ estado: s.estado, ui: s.ui, contas: contas!, alterarEstado, alterarUi, substituirTudo, bloquear, trocarPin }}>
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
