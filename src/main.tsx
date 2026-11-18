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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
