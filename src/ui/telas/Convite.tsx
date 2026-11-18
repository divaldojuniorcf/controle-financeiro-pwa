import { useState, type FormEvent } from "react";
import { DIAS_SEM_CONFIRMAR, usarConvite } from "../../app/convite";
import { codigoNoTexto, conviteDoLink, ehIOS } from "../../app/plataforma";
import { gerarBackup } from "../../core/backup";
import { dataParaNomeDeArquivo, salvarArquivo } from "../../storage/arquivos";
import { abrirComPin, PinIncorreto, type Cifrado } from "../../storage/cripto";
import { completarUi, type ConviteLocal, type Gravado } from "../../storage/db";
import { copiarTexto } from "../componentes";

/**
 * Link aberto no navegador: explica como instalar antes de pedir o convite.
 * No iPhone o Safari e o app da Tela de Início guardam dados separados, então o convite
 * só pode ser usado dentro do app instalado (do contrário, ele ficaria preso ao Safari).
 */
export function TelaInstalar({ aoContinuar }: { aoContinuar?: () => void }) {
  const convite = conviteDoLink();
  const ios = ehIOS();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await copiarTexto(convite);
      setCopiado(true);
    } catch {
      /* o código continua visível para anotar */
    }
  }

  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Controle Financeiro</h1>
      <p className="ajuda">Para usar, instale o app na Tela de Início. Leva menos de um minuto.</p>
      {convite && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="rotulo">Seu convite</div>
          <div className="valor" style={{ letterSpacing: ".12em", fontFamily: "ui-monospace, Menlo, monospace" }}>{convite}</div>
          <div className="botoes">
            <button className="botao primario" onClick={copiar}>{copiado ? "Convite copiado ✔" : "Copiar convite"}</button>
          </div>
        </div>
      )}
      <ol className="passos">
        {ios ? (
          <>
            <li>Confira se está no <b>Safari</b>. Em outro navegador, abra este mesmo link no Safari.</li>
            <li>{convite ? <>Toque em <b>Copiar convite</b> (acima).</> : <>Tenha em mãos o código do convite que você recebeu.</>}</li>
            <li>Toque em <b>Compartilhar</b> <span aria-hidden="true">(quadrado com seta para cima ⬆︎)</span>, na barra de baixo.</li>
            <li>Role e toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</li>
            <li>Feche o Safari e abra o app pelo ícone <b>Finanças</b> na Tela de Início.</li>
            <li>No app, toque em <b>Colar</b> para inserir o convite e em <b>Continuar</b>.</li>
          </>
        ) : (
          <>
            <li>{convite ? <>Toque em <b>Copiar convite</b> (acima).</> : <>Tenha em mãos o código do convite que você recebeu.</>}</li>
            <li>No menu do navegador, escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
            <li>Abra o app instalado e cole o convite.</li>
          </>
        )}
      </ol>
      {ios ? (
        <p className="aviso">Não digite o convite aqui no Safari: no iPhone ele só funciona dentro do app instalado.</p>
      ) : (
        aoContinuar && (
          <div className="botoes">
            <button className="botao" onClick={aoContinuar}>Usar aqui no navegador mesmo</button>
          </div>
        )
      )}
      <p className="sec">Seus dados financeiros ficam só no seu aparelho.</p>
    </main>
  );
}

/** Primeira abertura num aparelho novo: pede o código do convite. */
export function TelaConvite({ aoUsar }: { aoUsar: (c: ConviteLocal) => Promise<void> }) {
  const [codigo, setCodigo] = useState(conviteDoLink());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const limpar = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 11);

  async function colar() {
    setErro(null);
    try {
      const texto = await navigator.clipboard.readText();
      setCodigo(limpar(codigoNoTexto(texto)));
    } catch {
      setErro("Não foi possível colar. Toque e segure no campo e escolha Colar.");
    }
  }

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
            onChange={(e) => setCodigo(limpar(e.target.value))}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
        </label>
        {erro && <p className="aviso">{erro}</p>}
        <div className="botoes">
          <button className="botao" type="button" onClick={colar}>Colar</button>
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
