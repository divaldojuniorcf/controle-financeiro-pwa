import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./ui/estilo.css";

// Versão nova publicada: o service worker novo assume e a página recarrega uma vez,
// para não rodar a versão antiga guardada para uso offline. Na primeira visita
// (sem versão anterior) não recarrega.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregou) return;
    recarregou = true;
    location.reload();
  });
}

// O app pode ficar dias em segundo plano sem ser reaberto: ao voltar para a tela,
// procura versão nova (no máximo a cada 30 minutos).
const INTERVALO_ATUALIZACAO_MS = 30 * 60_000;
let ultimaProcura = Date.now();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !("serviceWorker" in navigator)) return;
  if (Date.now() - ultimaProcura < INTERVALO_ATUALIZACAO_MS) return;
  ultimaProcura = Date.now();
  navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {
    /* sem internet: tenta na próxima vez */
  });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
