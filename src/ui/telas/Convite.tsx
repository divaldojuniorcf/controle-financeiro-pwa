import { useState, type FormEvent } from "react";
import { DIAS_SEM_CONFIRMAR, usarConvite } from "../../app/convite";
import { gerarBackup } from "../../core/backup";
import { dataParaNomeDeArquivo, salvarArquivo } from "../../storage/arquivos";
import { abrirComPin, PinIncorreto, type Cifrado } from "../../storage/cripto";
import { completarUi, type ConviteLocal, type Gravado } from "../../storage/db";

/** Primeira abertura num aparelho novo: pede o código do convite. */
export function TelaConvite({ aoUsar }: { aoUsar: (c: ConviteLocal) => Promise<void> }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await aoUsar(await usarConvite(codigo));
    } catch (x) {
      setErro((x as Error).message);
      setOcupado(false);
    }
  }

  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Controle Financeiro</h1>
      <p className="ajuda">Este app é de uso por convite. Digite o código que você recebeu (ex.: ABCDE-FGH23). Ele vale para este aparelho.</p>
      <form onSubmit={enviar}>
        <label className="campo">
          <span>Código do convite</span>
          <input
            className="pin"
            style={{ letterSpacing: ".15em", textTransform: "uppercase" }}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 11))}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
        </label>
        {erro && <p className="aviso">{erro}</p>}
        <div className="botoes">
          <button className="botao primario" type="submit" disabled={ocupado || codigo.replace(/-/g, "").length < 10}>
            {ocupado ? "Conferindo…" : "Continuar"}
          </button>
        </div>
      </form>
      <p className="sec">Seus dados financeiros continuam só neste aparelho. O convite envia apenas um identificador aleatório do aparelho.</p>
    </main>
  );
}

/** Convite bloqueado, liberado para outro aparelho ou excluído. Só permite exportar os próprios dados. */
export function AcessoBloqueado({ cifrado }: { cifrado: Cifrado | null }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function exportar(e: FormEvent) {
    e.preventDefault();
    if (!cifrado) return;
    setOcupado(true);
    setMsg(null);
    try {
      const { valor } = await abrirComPin<Gravado>(pin, cifrado);
      const g = completarUi(valor);
      await salvarArquivo(
        `controle-financeiro-${dataParaNomeDeArquivo()}.json`,
        JSON.stringify(gerarBackup(g.estado, g.ui.dataAnalise), null, 2),
        "application/json",
      );
      setMsg("Backup exportado.");
    } catch (x) {
      if ((x as Error).name !== "AbortError") setMsg(x instanceof PinIncorreto ? "PIN incorreto." : (x as Error).message);
    } finally {
      setPin("");
      setOcupado(false);
    }
  }

  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Acesso bloqueado</h1>
      <p className="ajuda">O convite deste aparelho foi bloqueado ou não vale mais. Fale com quem enviou o convite.</p>
      {cifrado && (
        <>
          <p>Seus dados continuam neste aparelho. Você pode exportar uma cópia deles (arquivo JSON):</p>
          <form onSubmit={exportar}>
            <label className="campo">
              <span>PIN</span>
              <input className="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={8}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </label>
            <div className="botoes">
              <button className="botao primario" type="submit" disabled={ocupado || pin === ""}>{ocupado ? "Exportando…" : "Exportar meus dados"}</button>
            </div>
          </form>
        </>
      )}
      {msg && <p className="aviso">{msg}</p>}
    </main>
  );
}

/** Mais de 7 dias sem conseguir confirmar o convite. */
export function SemConexao({ aoTentar }: { aoTentar: () => void }) {
  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Conecte-se à internet</h1>
      <p className="ajuda">
        O app precisa confirmar o convite deste aparelho pelo menos a cada {DIAS_SEM_CONFIRMAR} dias. Conecte-se à internet e tente de novo.
      </p>
      <div className="botoes">
        <button className="botao primario" onClick={aoTentar}>Tentar de novo</button>
      </div>
    </main>
  );
}
