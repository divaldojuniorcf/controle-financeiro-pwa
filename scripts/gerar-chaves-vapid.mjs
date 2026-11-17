// Gera o par de chaves VAPID das notificações.
// Privada: servidor/.segredos.json (fora do Git), enviada ao Cloudflare com `wrangler secret bulk`.
// Pública: impressa na tela, para .env.production (app) e servidor/wrangler.toml (VAPID_PUBLICA).
import { existsSync, writeFileSync } from "node:fs";

const destino = "servidor/.segredos.json";
if (existsSync(destino) && !process.argv.includes("--substituir")) {
  console.error(`${destino} já existe. Use --substituir para gerar outro par (os aparelhos terão de ativar os lembretes de novo).`);
  process.exit(1);
}

const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const privada = await crypto.subtle.exportKey("jwk", par.privateKey);
const publica = Buffer.from(await crypto.subtle.exportKey("raw", par.publicKey)).toString("base64url");

writeFileSync(destino, JSON.stringify({ VAPID_PRIVADA: JSON.stringify(privada) }, null, 2));
console.log(publica);
