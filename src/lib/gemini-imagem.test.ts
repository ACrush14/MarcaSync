import { describe, expect, it, vi } from "vitest";
import { MODELO_PADRAO, gerarImagemGemini } from "./gemini-imagem";

const BASE64 = "iVBORw0KGgo".repeat(20);
const CHAVE = "chave-secreta-de-teste-123";

const resposta = (status: number, corpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } }));

const boa = { steps: [{ type: "model_output", content: [{ type: "image", data: BASE64, mime_type: "image/png" }] }] };

describe("gerarImagemGemini", () => {
  it("sem chave nem chama o Google", async () => {
    const fetchImpl = vi.fn();
    const r = await gerarImagemGemini({ prompt: "x", apiKey: undefined, fetchImpl });
    expect(r).toEqual({ ok: false, motivo: "sem-chave" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("manda a chave só no cabeçalho, com o modelo e o pedido", async () => {
    const fetchImpl = vi.fn(() => resposta(200, boa));
    const r = await gerarImagemGemini({ prompt: "faça uma logo", apiKey: CHAVE, fetchImpl });
    expect(r).toEqual({ ok: true, mime: "image/png", base64: BASE64 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(CHAVE);
    expect(url).not.toContain(CHAVE);
    expect(String(init.body)).not.toContain(CHAVE);
    const corpo = JSON.parse(String(init.body));
    expect(corpo.model).toBe(MODELO_PADRAO);
    expect(corpo.input[0].text).toBe("faça uma logo");
    expect(init.redirect).toBe("error");
  });

  it("usa o modelo pedido", async () => {
    const fetchImpl = vi.fn(() => resposta(200, boa));
    await gerarImagemGemini({ prompt: "x", apiKey: CHAVE, modelo: "outro-modelo", fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe("outro-modelo");
  });

  it.each([
    [429, "limite"],
    [400, "recusou"],
    [403, "erro"],
    [500, "erro"],
  ])("HTTP %i vira motivo %s, sem repassar o texto do Google", async (status, motivo) => {
    const fetchImpl = vi.fn(() => resposta(status, { error: { message: `segredo ${CHAVE}` } }));
    const r = await gerarImagemGemini({ prompt: "x", apiKey: CHAVE, fetchImpl });
    expect(r).toEqual({ ok: false, motivo });
    expect(JSON.stringify(r)).not.toContain(CHAVE);
  });

  it("resposta sem imagem (só texto) vira sem-imagem", async () => {
    const fetchImpl = vi.fn(() => resposta(200, { steps: [{ content: [{ type: "text", text: "não posso" }] }] }));
    expect(await gerarImagemGemini({ prompt: "x", apiKey: CHAVE, fetchImpl })).toEqual({ ok: false, motivo: "sem-imagem" });
  });

  it("corpo que não é JSON vira erro", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response("<html>", { status: 200 })));
    expect(await gerarImagemGemini({ prompt: "x", apiKey: CHAVE, fetchImpl })).toEqual({ ok: false, motivo: "erro" });
  });

  it("rede caindo vira erro, e demora vira demorou", async () => {
    const cai = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    expect(await gerarImagemGemini({ prompt: "x", apiKey: CHAVE, fetchImpl: cai })).toEqual({ ok: false, motivo: "erro" });
    const demora = vi.fn(() => {
      const e = new Error("tempo");
      e.name = "TimeoutError";
      return Promise.reject(e);
    });
    expect(await gerarImagemGemini({ prompt: "x", apiKey: CHAVE, fetchImpl: demora })).toEqual({ ok: false, motivo: "demorou" });
  });
});
