import { useState } from "react";
import { PARAMETROS_PADRAO } from "../../core/importacao";
import type { Estado } from "../../core/tipos";
import { lerJson, resumoDaImportacao } from "../../app/transferencia";
import { escolherArquivo } from "../../storage/arquivos";

export function BoasVindas({ iniciar }: { iniciar: (e: Estado, ui?: { dataAnalise: string | null }) => void }) {
  const [erro, setErro] = useState<string | null>(null);

  async function importar() {
    setErro(null);
    const arq = await escolherArquivo(".json,application/json");
    if (!arq) return;
    try {
      const { estado, dataAnalise } = await lerJson(arq);
      alert(`Importados: ${resumoDaImportacao(estado)}`);
      iniciar(estado, { dataAnalise });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function comecarVazio() {
    if (!confirm("Começar sem dados? Você poderá importar depois em Parâmetros.")) return;
    iniciar({ lancamentos: [], investimentos: [], baixas: [], parametros: { ...PARAMETROS_PADRAO } });
  }

  return (
    <main className="boas-vindas">
      <h1 className="titulo-tela grande">Controle Financeiro</h1>
      <p className="ajuda">Seus dados ficam só neste aparelho. Nada é enviado para a internet.</p>
      <p>Para começar, importe o arquivo <b>dados.json</b> exportado da planilha:</p>
      <ol>
        <li>Salve o dados.json no iCloud Drive (ou em "No meu iPhone").</li>
        <li>Toque em <b>Importar dados.json</b> e escolha o arquivo.</li>
      </ol>
      <div className="botoes">
        <button className="botao primario" onClick={importar}>Importar dados.json</button>
      </div>
      {erro && <p className="aviso">{erro}</p>}
      <div className="botoes">
        <button className="botao" onClick={comecarVazio}>Começar sem dados</button>
      </div>
    </main>
  );
}
