import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const db = vi.hoisted(() => ({
  processo: { findUnique: vi.fn() },
  geracaoLogo: { count: vi.fn(), create: vi.fn(), delete: vi.fn() },
}));
const gemini = vi.hoisted(() => ({ gerarImagemGemini: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/gemini-imagem", () => gemini);

import { zerarLimites } from "@/lib/limite-publico";
import { GET, POST } from "./route";

let pngBase64 = "";
beforeAll(async () => {
  const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 20, g: 120, b: 80, alpha: 0.5 } } })
    .png()
    .toBuffer();
  pngBase64 = png.toString("base64");
});

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const valido = {
  marca: "Kaza Doce",
  atividade: "confeitaria artesanal, bolos sob encomenda",
  apresentacao: "mista",
  variacao: 0,
  cienteIa: true,
};
const post = (corpo: unknown, ip = "1.1.1.1") =>
  new Request("http://x/api/processos/p1/logo-ia", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

beforeEach(() => {
  vi.clearAllMocks();
  zerarLimites();
  vi.stubEnv("GEMINI_API_KEY", "chave-de-teste");
  vi.stubEnv("LOGO_IA_LIMITE_DIA", "");
  db.processo.findUnique.mockResolvedValue({ id: "p1" });
  db.geracaoLogo.count.mockResolvedValue(0);
  db.geracaoLogo.create.mockResolvedValue({ id: "g1" });
  db.geracaoLogo.delete.mockResolvedValue({});
  gemini.gerarImagemGemini.mockImplementation(() => Promise.resolve({ ok: true, mime: "image/png", base64: pngBase64 }));
});

describe("GET /api/processos/:id/logo-ia", () => {
  it("sem GEMINI_API_KEY diz que não está disponível (a tela esconde o painel)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await (await GET(new Request("http://x"), ctx())).json()).toEqual({ disponivel: false, restantes: 0 });
  });
  it("com a chave, diz quantas logos o pedido ainda pode gerar (12 no total)", async () => {
    db.geracaoLogo.count.mockResolvedValue(4);
    expect(await (await GET(new Request("http://x"), ctx())).json()).toEqual({ disponivel: true, restantes: 8 });
  });
});

describe("POST /api/processos/:id/logo-ia", () => {
  it("cria a logo: reserva a cota, chama o Gemini e devolve uma prévia JPG", async () => {
    const r = await POST(post(valido), ctx());
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.imagem).toMatch(/^data:image\/jpeg;base64,/);
    expect(corpo.estilo).toBe("minimalista");
    expect(corpo.restantes).toBe(11);
    expect(db.geracaoLogo.create).toHaveBeenCalledWith({ data: { processoId: "p1", estilo: "minimalista" }, select: { id: true } });
    const chamada = gemini.gerarImagemGemini.mock.calls[0]?.[0];
    expect(chamada.prompt).toContain("Kaza Doce");
    expect(chamada.apiKey).toBe("chave-de-teste");
    // a prévia é um JPG de verdade, com fundo branco no lugar da transparência
    const jpg = Buffer.from(corpo.imagem.split(",")[1], "base64");
    expect((await sharp(jpg).metadata()).format).toBe("jpeg");
  });

  it("sem a chave no servidor: 503 e nada é gasto", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await POST(post(valido), ctx())).status).toBe(503);
    expect(gemini.gerarImagemGemini).not.toHaveBeenCalled();
  });

  it.each([
    ["sem marcar a ciência", { ...valido, cienteIa: false }],
    ["ciência como texto", { ...valido, cienteIa: "true" }],
    ["variação fora de 0 a 3", { ...valido, variacao: 4 }],
    ["marca nominativa", { ...valido, apresentacao: "nominativa" }],
    ["atividade curta", { ...valido, atividade: "bolos" }],
    ["sem nome", { ...valido, marca: "" }],
  ])("recusa %s (400) sem gastar nada", async (_n, corpo) => {
    expect((await POST(post(corpo), ctx())).status).toBe(400);
    expect(db.geracaoLogo.create).not.toHaveBeenCalled();
    expect(gemini.gerarImagemGemini).not.toHaveBeenCalled();
  });

  it("recusa JSON quebrado e corpo grande demais", async () => {
    expect((await POST(post("{ruim"), ctx())).status).toBe(400);
    const grande = new Request("http://x", { method: "POST", headers: { "content-length": "99999", "x-forwarded-for": "2.2.2.2" }, body: "{}" });
    expect((await POST(grande, ctx())).status).toBe(413);
  });

  it("processo inexistente: 404", async () => {
    db.processo.findUnique.mockResolvedValue(null);
    expect((await POST(post(valido), ctx("x"))).status).toBe(404);
    expect(gemini.gerarImagemGemini).not.toHaveBeenCalled();
  });

  it("o pedido que já gerou as 12 logos é barrado (429), sem chamar o Gemini", async () => {
    db.geracaoLogo.count.mockResolvedValueOnce(12);
    const r = await POST(post(valido), ctx());
    expect(r.status).toBe(429);
    expect((await r.json()).restantes).toBe(0);
    expect(gemini.gerarImagemGemini).not.toHaveBeenCalled();
  });

  it("o teto do dia no site todo vale: 503 sem chamar o Gemini", async () => {
    vi.stubEnv("LOGO_IA_LIMITE_DIA", "5");
    db.geracaoLogo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    expect((await POST(post(valido), ctx())).status).toBe(503);
    expect(gemini.gerarImagemGemini).not.toHaveBeenCalled();
  });

  it.each([
    ["limite", 503],
    ["recusou", 422],
    ["sem-imagem", 502],
    ["demorou", 502],
    ["erro", 502],
  ])("se o Gemini falha (%s), responde %i e devolve a cota", async (motivo, status) => {
    gemini.gerarImagemGemini.mockImplementation(() => Promise.resolve({ ok: false, motivo }));
    const r = await POST(post(valido), ctx());
    expect(r.status).toBe(status);
    expect(db.geracaoLogo.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
    expect(JSON.stringify(await r.json())).not.toContain("chave-de-teste");
  });

  it("imagem estragada que o Gemini devolveu: 502 e a cota volta", async () => {
    gemini.gerarImagemGemini.mockImplementation(() => Promise.resolve({ ok: true, mime: "image/png", base64: "bGl4byBlbSB2ZXogZGUgaW1hZ2Vt".repeat(10) }));
    expect((await POST(post(valido), ctx())).status).toBe(502);
    expect(db.geracaoLogo.delete).toHaveBeenCalled();
  });

  it("freia a rajada de um mesmo IP (429)", async () => {
    const codigos: number[] = [];
    for (let i = 0; i < 12; i++) codigos.push((await POST(post(valido, "9.9.9.9"), ctx())).status);
    expect(codigos).toContain(429);
    expect(codigos[0]).toBe(200);
  });
});
