// Notificações de vencimento (carregado pelo service worker gerado pelo Workbox).
// O servidor manda um push VAZIO às 9h da véspera; aqui o aparelho monta a notificação
// com os nomes das contas que vencem amanhã, lidos do IndexedDB local (sem valores).

const BANCO = "controle-financeiro";
const VERSAO = 2; // igual a VERSAO_DB em src/storage/db.ts
const LOJA = "lembretes";

function abrirBanco() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, VERSAO);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("dados")) d.createObjectStore("dados");
      if (!d.objectStoreNames.contains(LOJA)) d.createObjectStore(LOJA);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function lembreteDe(dia) {
  const d = await abrirBanco();
  return new Promise((ok) => {
    const r = d.transaction(LOJA).objectStore(LOJA).get(dia);
    r.onsuccess = () => ok(r.result || null);
    r.onerror = () => ok(null);
  });
}

function amanha() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function mostrar() {
  const dia = amanha();
  let l = null;
  try {
    l = await lembreteDe(dia);
  } catch {
    /* mostra o aviso genérico */
  }
  // O iPhone exige que todo push mostre uma notificação.
  const titulo = l ? l.titulo : "Lembretes de vencimento ativos ✔";
  const corpo = l ? l.corpo : "Nenhuma conta em aberto vence amanhã.";
  return self.registration.showNotification(titulo, {
    body: corpo,
    icon: "icon-192.png",
    tag: `vencimentos-${dia}`,
    data: { url: self.registration.scope },
  });
}

self.addEventListener("push", (evento) => {
  evento.waitUntil(mostrar());
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) if ("focus" in j) return j.focus();
      return self.clients.openWindow(evento.notification.data?.url || "./");
    }),
  );
});
