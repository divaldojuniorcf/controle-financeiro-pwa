import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// O servidor de desenvolvimento serve a pasta do projeto; nunca entregar dados pessoais.
const PRIVADOS = /(^|\/)(dados\.json|backup-[^/]*\.json|[^/]*\.xlsx?|[^/]*\.xlsm)(\?|$)/i;
type Middleware = Parameters<Parameters<NonNullable<Plugin["configureServer"]>>[0]["middlewares"]["use"]>[0];
const bloquear: Middleware = (req, res, next) => {
  if (PRIVADOS.test(decodeURIComponent(req.url ?? ""))) {
    res.statusCode = 404;
    res.end();
    return;
  }
  next();
};
const bloquearDadosPessoais = (): Plugin => ({
  name: "bloquear-dados-pessoais",
  configureServer: (server) => void server.middlewares.use(bloquear),
  configurePreviewServer: (server) => void server.middlewares.use(bloquear),
});

// base "./" permite publicar em qualquer subpasta (ex.: usuario.github.io/controle-financeiro-pwa/).
// Modo "iphone": HTTPS com certificado próprio, porque o Safari só libera a criptografia (PIN) em HTTPS.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    ...(mode === "iphone" ? [basicSsl()] : []),
    bloquearDadosPessoais(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "favicon.png"],
      manifest: {
        name: "Controle Financeiro",
        short_name: "Finanças",
        description: "Controle Financeiro pessoal (dados só no aparelho).",
        lang: "pt-BR",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FFFFFF",
        theme_color: "#1F3864",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        // Recebe os pushes dos lembretes de vencimento.
        importScripts: ["sw-push.js"],
      },
    }),
  ],
}));
