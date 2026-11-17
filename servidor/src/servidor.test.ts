import { describe, expect, it } from "vitest";
import { ATRASO_MAXIMO_MS, separarVencidos, validarAssinatura, validarHorarios } from "./agenda";
import { autorizacaoVapid, b64url } from "./vapid";

describe("Agendador", () => {
  const agora = 1_000_000_000_000;
  it("envia uma vez quando chega a hora e guarda o resto", () => {
    expect(separarVencidos([agora - 60_000, agora + 1, agora + 2], agora)).toEqual({ enviar: true, restantes: [agora + 1, agora + 2] });
    expect(separarVencidos([agora + 1], agora)).toEqual({ enviar: false, restantes: [agora + 1] });
  });
  it("descarta aviso muito atrasado sem enviar", () => {
    expect(separarVencidos([agora - ATRASO_MAXIMO_MS - 1], agora)).toEqual({ enviar: false, restantes: [] });
  });
  it("aceita só horários numéricos e serviços de push conhecidos", () => {
    expect(validarHorarios([3, 1, 3])).toEqual([1, 3]);
    expect(validarHorarios(["1"])).toBeNull();
    expect(validarAssinatura({ endpoint: "https://web.push.apple.com/QWx" })).toEqual({ endpoint: "https://web.push.apple.com/QWx" });
    expect(validarAssinatura({ endpoint: "https://exemplo.com/roubar" })).toBeNull();
    expect(validarAssinatura({ endpoint: "http://web.push.apple.com/x" })).toBeNull();
  });
});

describe("VAPID", () => {
  it("gera um JWT ES256 válido para a origem do serviço de push", async () => {
    const par = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);
    const pub = b64url(await crypto.subtle.exportKey("raw", par.publicKey));
    const h = await autorizacaoVapid("https://web.push.apple.com/abc", jwk, pub, "https://exemplo.github.io/app/", 1_700_000_000_000);
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h)!;
    expect(k).toBe(pub);
    const [cab, corpo, sig] = jwt!.split(".");
    const dec = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString());
    expect(dec(cab!)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(dec(corpo!)).toEqual({ aud: "https://web.push.apple.com", exp: 1_700_000_000 + 43_200, sub: "https://exemplo.github.io/app/" });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, par.publicKey, Buffer.from(sig!, "base64url"), new TextEncoder().encode(`${cab}.${corpo}`),
    );
    expect(ok).toBe(true);
  });
});
