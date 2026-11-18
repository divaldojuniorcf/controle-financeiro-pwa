// Página de administração dos convites (só para o dono do app; protegida por senha).

export function paginaAdmin(urlApp: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Convites · Controle Financeiro</title>
<style>
  :root { --azul: #1f3864; --cab: #156082; --borda: #d0d7e2; --ajuda: #595959; --ok: #006100; --okf: #c6efce; --neg: #9c0006; --negf: #ffc7ce; --at: #7f6000; --atf: #ffeb9c; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1a1a1a; background: #f3f6fa; }
  main { max-width: 640px; margin: 0 auto; padding: 16px; }
  h1 { color: var(--azul); font-size: 22px; margin: 4px 0; }
  p.ajuda { color: var(--ajuda); font-style: italic; margin: 0 0 12px; font-size: 13px; }
  input { width: 100%; min-height: 44px; padding: 8px 10px; border: 1px solid #b7c3d4; border-radius: 8px; font-size: 16px; }
  button { min-height: 40px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--cab); background: #fff; color: var(--cab); font-weight: 600; font-size: 14px; cursor: pointer; }
  button.prim { background: var(--cab); color: #fff; }
  button.neg { border-color: var(--neg); color: var(--neg); }
  .linha { display: flex; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
  .linha > input { flex: 1 1 180px; }
  .resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .resumo div { background: #fff; border: 1px solid var(--borda); border-radius: 8px; padding: 8px; }
  .resumo b { display: block; font-size: 22px; color: var(--azul); }
  .resumo span { font-size: 12px; color: var(--ajuda); font-weight: 700; }
  .convite { background: #fff; border: 1px solid var(--borda); border-radius: 10px; padding: 12px; margin: 10px 0; }
  .topo { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .nome { font-weight: 700; font-size: 16px; overflow-wrap: anywhere; }
  .cod { font: 600 17px ui-monospace, Menlo, monospace; letter-spacing: .05em; color: var(--azul); }
  .sit { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
  .livre { background: var(--atf); color: var(--at); } .uso { background: var(--okf); color: var(--ok); } .bloq { background: var(--negf); color: var(--neg); }
  .det { color: var(--ajuda); font-size: 13px; margin: 6px 0; }
  #msg { position: fixed; left: 12px; right: 12px; bottom: 16px; background: var(--azul); color: #fff; padding: 12px; border-radius: 10px; display: none; }
  .erro { color: var(--neg); font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>Convites</h1>
  <p class="ajuda">Cada convite libera o app em 1 aparelho. Bloquear corta o acesso na próxima abertura com internet e para os lembretes na hora.</p>
  <section id="entrar">
    <div class="linha"><input id="senha" type="password" placeholder="Senha de administração" autocomplete="current-password"><button class="prim" id="btEntrar">Entrar</button></div>
    <p id="erroEntrar" class="erro"></p>
  </section>
  <section id="painel" hidden>
    <div class="resumo">
      <div><b id="nUso">0</b><span>Aparelhos usando</span></div>
      <div><b id="nLivre">0</b><span>Convites livres</span></div>
      <div><b id="nBloq">0</b><span>Bloqueados</span></div>
    </div>
    <div class="linha"><input id="nome" maxlength="60" placeholder="Nome do convite (ex.: amigo-joão)"><button class="prim" id="btCriar">Criar convite</button></div>
    <div id="lista"></div>
    <div class="linha"><button id="btSair">Sair</button></div>
  </section>
</main>
<div id="msg"></div>
<script>
  const URL_APP = ${JSON.stringify(urlApp)};
  let senha = sessionStorage.getItem("senha") || "";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const data = (t) => t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const fmt = (c) => c.slice(0, 5) + "-" + c.slice(5);
  function aviso(t) { const m = $("msg"); m.textContent = t; m.style.display = "block"; clearTimeout(aviso.t); aviso.t = setTimeout(() => m.style.display = "none", 4000); }

  async function api(metodo, caminho, corpo) {
    const r = await fetch("/admin/api" + caminho, { method: metodo, headers: { Authorization: "Bearer " + senha, "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
    if (r.status === 401) { sessionStorage.removeItem("senha"); throw new Error("Senha incorreta."); }
    if (!r.ok) throw new Error("Erro " + r.status);
    return r.json();
  }

  function render(convites) {
    $("nUso").textContent = convites.filter((c) => c.aparelho && !c.bloqueado).length;
    $("nLivre").textContent = convites.filter((c) => !c.aparelho && !c.bloqueado).length;
    $("nBloq").textContent = convites.filter((c) => c.bloqueado).length;
    $("lista").innerHTML = convites.length ? convites.map((c) => {
      const sit = c.bloqueado ? '<span class="sit bloq">Bloqueado</span>' : c.aparelho ? '<span class="sit uso">Em uso</span>' : '<span class="sit livre">Livre</span>';
      return '<div class="convite"><div class="topo"><span class="nome">' + esc(c.nome) + '</span>' + sit + '</div>' +
        '<div class="cod">' + fmt(c.codigo) + '</div>' +
        '<div class="det">Criado em ' + data(c.criadoEm) + (c.ativadoEm ? ' · ativado em ' + data(c.ativadoEm) : '') + (c.ultimoAcesso ? ' · último acesso ' + data(c.ultimoAcesso) : '') + '</div>' +
        '<div class="linha">' +
        (!c.aparelho && !c.bloqueado ? '<button data-a="copiar" data-c="' + c.codigo + '">Copiar mensagem</button>' : '') +
        (c.bloqueado ? '<button data-a="desbloquear" data-c="' + c.codigo + '">Desbloquear</button>' : '<button class="neg" data-a="bloquear" data-c="' + c.codigo + '">Bloquear</button>') +
        (c.aparelho ? '<button data-a="liberar" data-c="' + c.codigo + '">Liberar p/ outro celular</button>' : '') +
        '<button class="neg" data-a="excluir" data-c="' + c.codigo + '">Excluir</button></div></div>';
    }).join("") : '<p class="ajuda">Nenhum convite ainda.</p>';
  }

  async function carregar() { render((await api("GET", "/convites")).convites); }

  async function entrar() {
    senha = $("senha").value || senha;
    try {
      await carregar();
      sessionStorage.setItem("senha", senha);
      $("entrar").hidden = true; $("painel").hidden = false; $("erroEntrar").textContent = "";
    } catch (e) { $("erroEntrar").textContent = e.message; }
  }

  $("btEntrar").onclick = entrar;
  $("senha").onkeydown = (e) => e.key === "Enter" && entrar();
  $("btSair").onclick = () => { sessionStorage.removeItem("senha"); location.reload(); };
  $("btCriar").onclick = async () => {
    try {
      const { convite } = await api("POST", "/convites", { nome: $("nome").value });
      $("nome").value = ""; await carregar(); aviso("Convite " + fmt(convite.codigo) + " criado.");
    } catch (e) { aviso(e.message); }
  };
  const CONFIRMA = {
    bloquear: "Bloquear este convite? O aparelho perde o acesso na próxima abertura com internet e os lembretes param.",
    liberar: "Liberar o convite para outro celular? O aparelho atual perde o acesso.",
    excluir: "Excluir este convite? Se estiver em uso, o aparelho perde o acesso.",
  };
  $("lista").onclick = async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const { a, c } = b.dataset;
    if (a === "copiar") {
      const texto = [
        "Você recebeu um convite para o app Controle Financeiro.",
        "",
        "Seu convite: " + fmt(c),
        "",
        "Como instalar no iPhone:",
        "1. Abra este link no Safari: " + URL_APP + "?convite=" + fmt(c),
        "2. Toque em \\"Copiar convite\\".",
        "3. Toque em Compartilhar (quadrado com seta para cima) e em \\"Adicionar à Tela de Início\\" → Adicionar.",
        "4. Feche o Safari e abra o app pelo ícone \\"Finanças\\".",
        "5. Toque em \\"Colar\\" para inserir o convite e em \\"Continuar\\".",
        "",
        "O convite vale para 1 aparelho. Seus dados ficam só no seu celular.",
      ].join("\\n");
      try { await navigator.clipboard.writeText(texto); aviso("Mensagem copiada. Cole no WhatsApp ou e-mail."); } catch { prompt("Copie a mensagem:", texto); }
      return;
    }
    if (CONFIRMA[a] && !confirm(CONFIRMA[a])) return;
    try { await api("POST", "/convites/" + c + "/" + a); await carregar(); aviso("Feito."); } catch (e2) { aviso(e2.message); }
  };
  if (senha) entrar();
</script>
</body>
</html>`;
}
