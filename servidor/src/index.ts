// Servidor de lembretes (Cloudflare Worker).
// Guarda, por aparelho, só a assinatura de push e os HORÁRIOS dos avisos.
// Na hora marcada envia um push vazio; o próprio iPhone monta a notificação com os nomes.
import {
  ID_VALIDO, separarVencidos, validarAssinatura, validarHorarios, type Dispositivo,
} from "./agenda";
import { autorizacaoVapid, sha256Hex } from "./vapid";

interface KV {
  get(chave: string): Promise<string | null>;
  put(chave: string, valor: string): Promise<void>;
  delete(chave: string): Promise<void>;
  list(op: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

interface Env {
  DISPOSITIVOS: KV;
  VAPID_PUBLICA: string;
  VAPID_PRIVADA: string; // segredo: JWK em JSON
  ORIGENS: string; // origens permitidas, separadas por vírgula
  ASSUNTO: string; // "sub" do VAPID (URL do app)
}

const PREFIXO = "d:";

function cors(req: Request, env: Env): Record<string, string> {
  const origem = req.headers.get("Origin") ?? "";
  const permitidas = env.ORIGENS.split(",").map((s) => s.trim());
  return permitidas.includes(origem)
    ? {
        "Access-Control-Allow-Origin": origem,
        "Access-Control-Allow-Methods": "PUT, DELETE, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : {};
}

const json = (corpo: unknown, status: number, extra: Record<string, string>) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...extra } });

/** Envia um push vazio. Devolve false se a assinatura não vale mais (app desinstalado, permissão retirada). */
async function enviarPush(d: Dispositivo, env: Env): Promise<boolean> {
  const auth = await autorizacaoVapid(d.assinatura.endpoint, JSON.parse(env.VAPID_PRIVADA), env.VAPID_PUBLICA, env.ASSUNTO);
  const r = await fetch(d.assinatura.endpoint, {
    method: "POST",
    headers: { Authorization: auth, TTL: "21600", Urgency: "high", "Content-Length": "0" },
  });
  if (r.status === 404 || r.status === 410) return false;
  if (!r.ok) console.log("push recusado", r.status, await r.text());
  return true;
}

async function autenticar(req: Request, env: Env, id: string): Promise<{ hash: string; atual: Dispositivo | null } | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (token.length < 32) return null;
  const hash = await sha256Hex(token);
  const bruto = await env.DISPOSITIVOS.get(PREFIXO + id);
  const atual = bruto ? (JSON.parse(bruto) as Dispositivo) : null;
  if (atual && atual.hash !== hash) return null;
  return { hash, atual };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (!h["Access-Control-Allow-Origin"]) return json({ erro: "origem não permitida" }, 403, {});

    const m = /^\/dispositivos\/([^/]+)(\/teste)?$/.exec(new URL(req.url).pathname);
    if (!m || !ID_VALIDO.test(m[1]!)) return json({ erro: "não encontrado" }, 404, h);
    const id = m[1]!;
    const a = await autenticar(req, env, id);
    if (!a) return json({ erro: "não autorizado" }, 403, h);

    if (req.method === "PUT" && !m[2]) {
      const corpo = (await req.json().catch(() => null)) as { assinatura?: unknown; horarios?: unknown } | null;
      const assinatura = validarAssinatura(corpo?.assinatura);
      const horarios = validarHorarios(corpo?.horarios);
      if (!assinatura || !horarios) return json({ erro: "dados inválidos" }, 400, h);
      const d: Dispositivo = { hash: a.hash, assinatura, horarios };
      await env.DISPOSITIVOS.put(PREFIXO + id, JSON.stringify(d));
      return json({ ok: true, agendados: horarios.length }, 200, h);
    }
    if (req.method === "DELETE" && !m[2]) {
      await env.DISPOSITIVOS.delete(PREFIXO + id);
      return json({ ok: true }, 200, h);
    }
    if (req.method === "POST" && m[2]) {
      if (!a.atual) return json({ erro: "aparelho não cadastrado" }, 404, h);
      const valido = await enviarPush(a.atual, env);
      if (!valido) await env.DISPOSITIVOS.delete(PREFIXO + id);
      return json({ ok: valido }, valido ? 200 : 410, h);
    }
    return json({ erro: "método não permitido" }, 405, h);
  },

  /** A cada 5 minutos: envia os avisos cuja hora chegou. */
  async scheduled(_evento: unknown, env: Env): Promise<void> {
    const agora = Date.now();
    let cursor: string | undefined;
    do {
      const pagina = await env.DISPOSITIVOS.list({ prefix: PREFIXO, cursor });
      for (const { name } of pagina.keys) {
        const bruto = await env.DISPOSITIVOS.get(name);
        if (!bruto) continue;
        const d = JSON.parse(bruto) as Dispositivo;
        const { enviar, restantes } = separarVencidos(d.horarios, agora);
        if (restantes.length === d.horarios.length) continue;
        if (enviar && !(await enviarPush(d, env))) {
          await env.DISPOSITIVOS.delete(name);
          continue;
        }
        await env.DISPOSITIVOS.put(name, JSON.stringify({ ...d, horarios: restantes }));
      }
      cursor = pagina.list_complete ? undefined : pagina.cursor;
    } while (cursor);
  },
};
