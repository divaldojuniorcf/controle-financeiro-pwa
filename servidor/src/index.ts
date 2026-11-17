// Servidor do app (Cloudflare Worker): convites e lembretes de vencimento.
// Lembretes: guarda, por aparelho, só a assinatura de push e os HORÁRIOS dos avisos.
// Na hora marcada envia um push vazio; o próprio iPhone monta a notificação com os nomes.
// Convites: cada código libera o app em 1 aparelho; o dono gerencia em /admin.
import { paginaAdmin } from "./admin";
import { ID_VALIDO, separarVencidos, validarAssinatura, validarHorarios, type Dispositivo } from "./agenda";
import {
  aplicarAcao, criarConvite, listarConvites, normalizarCodigo, usarConvite, verificarConvite, vincularLembrete,
  type AcaoAdmin, type KV,
} from "./convites";
import { autorizacaoVapid, sha256Hex } from "./vapid";

interface Env {
  DISPOSITIVOS: KV;
  VAPID_PUBLICA: string;
  VAPID_PRIVADA: string; // segredo: JWK em JSON
  ADMIN_SENHA: string; // segredo: senha da página /admin
  ORIGENS: string; // origens permitidas, separadas por vírgula
  ASSUNTO: string; // "sub" do VAPID e endereço do app
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

/** Comparação em tempo constante (não revela quantos caracteres da senha acertaram). */
async function mesmaSenha(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let dif = 0;
  for (let i = 0; i < ha.length; i++) dif |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return dif === 0 && !!b;
}

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

interface CredencialConvite { codigo?: unknown; aparelho?: unknown; token?: unknown }

async function conviteValido(env: Env, c: CredencialConvite | undefined): Promise<"ok" | "bloqueado" | "invalido"> {
  if (typeof c?.codigo !== "string" || typeof c.aparelho !== "string" || typeof c.token !== "string") return "invalido";
  return verificarConvite(env.DISPOSITIVOS, c.codigo, c.aparelho, c.token);
}

/** Página e API de administração (mesma origem, senha no cabeçalho). */
async function admin(req: Request, env: Env, caminho: string): Promise<Response> {
  const seguro = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Frame-Options": "DENY" };
  if (caminho === "/admin" && req.method === "GET") {
    return new Response(paginaAdmin(env.ASSUNTO), { headers: { "Content-Type": "text/html; charset=utf-8", ...seguro } });
  }
  const senha = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!env.ADMIN_SENHA || !(await mesmaSenha(senha, env.ADMIN_SENHA))) return json({ erro: "senha incorreta" }, 401, seguro);

  if (caminho === "/admin/api/convites" && req.method === "GET") {
    const convites = (await listarConvites(env.DISPOSITIVOS)).map(({ tokenHash: _t, lembrete: _l, ...c }) => c);
    return json({ convites }, 200, seguro);
  }
  if (caminho === "/admin/api/convites" && req.method === "POST") {
    const corpo = (await req.json().catch(() => ({}))) as { nome?: unknown };
    const c = await criarConvite(env.DISPOSITIVOS, typeof corpo.nome === "string" ? corpo.nome : "");
    return json({ convite: { codigo: c.codigo, nome: c.nome } }, 200, seguro);
  }
  const m = /^\/admin\/api\/convites\/([A-Z0-9]+)\/(bloquear|desbloquear|liberar|excluir)$/.exec(caminho);
  if (m && req.method === "POST") {
    const c = await aplicarAcao(env.DISPOSITIVOS, m[1]!, m[2] as AcaoAdmin, PREFIXO);
    return c ? json({ ok: true }, 200, seguro) : json({ erro: "convite não encontrado" }, 404, seguro);
  }
  return json({ erro: "não encontrado" }, 404, seguro);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const caminho = new URL(req.url).pathname;
    if (caminho === "/admin" || caminho.startsWith("/admin/")) return admin(req, env, caminho);

    const h = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (!h["Access-Control-Allow-Origin"]) return json({ erro: "origem não permitida" }, 403, {});

    // ---------- convites ----------
    if (caminho === "/convites/usar" && req.method === "POST") {
      const corpo = (await req.json().catch(() => ({}))) as { codigo?: unknown; aparelho?: unknown };
      if (typeof corpo.aparelho !== "string" || !ID_VALIDO.test(corpo.aparelho)) return json({ erro: "dados inválidos" }, 400, h);
      const r = await usarConvite(env.DISPOSITIVOS, normalizarCodigo(corpo.codigo), corpo.aparelho);
      return json(r, r.situacao === "ok" ? 200 : 403, h);
    }
    if (caminho === "/convites/verificar" && req.method === "POST") {
      const corpo = (await req.json().catch(() => ({}))) as CredencialConvite;
      return json({ situacao: await conviteValido(env, corpo) }, 200, h);
    }

    // ---------- lembretes ----------
    const m = /^\/dispositivos\/([^/]+)(\/teste)?$/.exec(caminho);
    if (!m || !ID_VALIDO.test(m[1]!)) return json({ erro: "não encontrado" }, 404, h);
    const id = m[1]!;
    const a = await autenticar(req, env, id);
    if (!a) return json({ erro: "não autorizado" }, 403, h);

    if (req.method === "PUT" && !m[2]) {
      const corpo = (await req.json().catch(() => null)) as { assinatura?: unknown; horarios?: unknown; convite?: CredencialConvite } | null;
      const assinatura = validarAssinatura(corpo?.assinatura);
      const horarios = validarHorarios(corpo?.horarios);
      if (!assinatura || !horarios) return json({ erro: "dados inválidos" }, 400, h);
      // Aparelho com convite: só agenda se o convite segue valendo (aparelhos antigos, sem convite, ficam isentos).
      let convite: string | undefined;
      if (corpo?.convite) {
        if ((await conviteValido(env, corpo.convite)) !== "ok") {
          await env.DISPOSITIVOS.delete(PREFIXO + id);
          return json({ erro: "convite bloqueado" }, 403, h);
        }
        convite = normalizarCodigo(corpo.convite.codigo);
        await vincularLembrete(env.DISPOSITIVOS, convite, id);
      }
      const d: Dispositivo = { hash: a.hash, assinatura, horarios, ...(convite ? { convite } : {}) };
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
