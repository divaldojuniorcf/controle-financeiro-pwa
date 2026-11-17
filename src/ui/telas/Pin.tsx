import { useEffect, useState, type FormEvent } from "react";
import { PIN_VALIDO, PinIncorreto } from "../../storage/cripto";

const MAX_TENTATIVAS = 5;
const ESPERA_S = 30;

function CampoPin({ rotulo, valor, onChange, autoFocus }: { rotulo: string; valor: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input
        className="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={8}
        autoFocus={autoFocus}
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
    </label>
  );
}

export function CriarPin({ migracao, aoCriar }: { migracao: boolean; aoCriar: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!PIN_VALIDO.test(pin)) return setErro("O PIN deve ter de 4 a 8 números.");
    if (pin !== conf) return setErro("Os dois PINs não são iguais.");
    setOcupado(true);
    try {
      await aoCriar(pin);
    } catch (x) {
      setErro((x as Error).message);
      setOcupado(false);
    }
  }

  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Crie um PIN</h1>
      <p className="ajuda">
        {migracao ? "Os dados deste aparelho passam a ser protegidos por PIN. " : ""}
        O PIN bloqueia o app e cifra os dados no aparelho. <b>Se esquecer o PIN, os dados só voltam por um backup</b> (Exportar JSON em Parâmetros).
      </p>
      <form onSubmit={enviar}>
        <CampoPin rotulo="PIN (4 a 8 números)" valor={pin} onChange={setPin} autoFocus />
        <CampoPin rotulo="Repita o PIN" valor={conf} onChange={setConf} />
        {erro && <p className="aviso">{erro}</p>}
        <div className="botoes">
          <button className="botao primario" type="submit" disabled={ocupado}>{ocupado ? "Protegendo…" : "Criar PIN"}</button>
        </div>
      </form>
    </main>
  );
}

export function Desbloquear({ aoDesbloquear, aoEsquecer }: { aoDesbloquear: (pin: string) => Promise<void>; aoEsquecer: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erros, setErros] = useState(0);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (espera > 0 || pin === "") return;
    setOcupado(true);
    setErro(null);
    try {
      await aoDesbloquear(pin);
    } catch (x) {
      setPin("");
      setOcupado(false);
      if (!(x instanceof PinIncorreto)) return setErro((x as Error).message);
      const n = erros + 1;
      setErros(n);
      if (n % MAX_TENTATIVAS === 0) {
        setEspera(ESPERA_S);
        setErro(`PIN incorreto ${n} vezes. Aguarde ${ESPERA_S} segundos.`);
      } else setErro("PIN incorreto.");
    }
  }

  async function esqueci() {
    if (!confirm("Esqueceu o PIN? Sem ele não há como abrir os dados. Você pode APAGAR os dados deste app e começar de novo importando um backup (Exportar JSON) ou o dados.json.")) return;
    if (!confirm("Confirma apagar TODOS os dados deste app? Isso não pode ser desfeito.")) return;
    await aoEsquecer();
  }

  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Controle Financeiro</h1>
      <p className="ajuda">Digite o PIN para abrir.</p>
      <form onSubmit={enviar}>
        <CampoPin rotulo="PIN" valor={pin} onChange={setPin} autoFocus />
        {erro && <p className="aviso">{erro}{espera > 0 ? ` (${espera}s)` : ""}</p>}
        <div className="botoes">
          <button className="botao primario" type="submit" disabled={ocupado || espera > 0 || pin === ""}>{ocupado ? "Abrindo…" : "Entrar"}</button>
        </div>
      </form>
      <div className="botoes" style={{ marginTop: 32 }}>
        <button className="botao perigo" onClick={esqueci}>Esqueci o PIN</button>
      </div>
    </main>
  );
}
