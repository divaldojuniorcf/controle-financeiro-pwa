// Salvar e abrir arquivos no iPhone (Compartilhar → Salvar em Arquivos) e no computador.

export async function salvarArquivo(nome: string, conteudo: string, tipo: string): Promise<void> {
  const arquivo = new File([conteudo], nome, { type: tipo });
  // No iPhone, a folha de compartilhamento permite "Salvar em Arquivos".
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function escolherArquivo(aceita: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = aceita;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function dataParaNomeDeArquivo(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
