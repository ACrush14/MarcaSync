/**
 * Rotas que dependem de segredo (webhook e cron) e as públicas que chamam serviços de fora
 * (busca e saúde): o que recusam, e que o freio e o cache funcionam.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmarPorProvedor: vi.fn(),
  verificarSituacoes: vi.fn(),
  avisarPrazos: vi.fn(),
  rodarMonitoramento: vi.fn(),
  calcularColidencia: vi.fn(),
  verificarRpi: vi.fn(),
  verificarBusca: vi.fn(),
}));
vi.mock("@/lib/cobranca", () => ({ confirmarPorProvedor: mocks.confirmarPorProvedor }));
vi.mock("@/lib/monitor-situacoes", () => ({ verificarSituacoes: mocks.verificarSituacoes }));
vi.mock("@/lib/avisos", () => ({ avisarPrazos: mocks.avisarPrazos }));
vi.mock("@/lib/monitor-rpi", () => ({ rodarMonitoramento: mocks.rodarMonitoramento }));
vi.mock("@/lib/colidencia", () => ({ calcularColidencia: mocks.calcularColidencia }));
vi.mock("@/lib/inpi/health", () => ({
  verificarRpi: mocks.verificarRpi,
  verificarBusca: mocks.verificarBusca,
}));

import { zerarLimites } from "@/lib/limite-publico";
import { POST as webhook } from "./webhooks/abacatepay/route";
import { GET as cron } from "./cron/rpi/route";
import { GET as colidencia } from "./colidencia/route";

beforeEach(() => {
  vi.clearAllMocks();
  zerarLimites();
  vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", "segredo-do-webhook");
  vi.stubEnv("CRON_SECRET", "segredo-do-cron");
});

const hook = (query: string, corpo = '{"data":{"id":"pix_char_abc123"}}', extra: Record<string, string> = {}) =>
  webhook(
    new Request(`http://x/api/webhooks/abacatepay${query}`, {
      method: "POST",
      headers: extra,
      body: corpo,
    })
  );

describe("webhook do AbacatePay", () => {
  it("segredo certo: confirma a cobrança pelo id (que depois é conferido na API)", async () => {
    const r = await hook("?webhookSecret=segredo-do-webhook");
    expect(r.status).toBe(200);
    expect(mocks.confirmarPorProvedor).toHaveBeenCalledWith("pix_char_abc123");
  });

  it.each([
    ["sem segredo", ""],
    ["segredo errado", "?webhookSecret=errado"],
    ["segredo vazio", "?webhookSecret="],
    ["segredo parecido", "?webhookSecret=segredo-do-webhoo"],
  ])("%s é recusado e não confirma nada", async (_n, query) => {
    const r = await hook(query);
    expect(r.status).toBe(401);
    expect(mocks.confirmarPorProvedor).not.toHaveBeenCalled();
  });

  it("sem segredo configurado no servidor, ninguém entra (nem com segredo vazio)", async () => {
    vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", "");
    expect((await hook("?webhookSecret=")).status).toBe(401);
    expect((await hook("")).status).toBe(401);
  });

  it("corpo sem id de cobrança conhecido não confirma nada, mas responde 200 (o AbacatePay não reenvia)", async () => {
    const r = await hook("?webhookSecret=segredo-do-webhook", '{"event":"outra-coisa"}');
    expect(r.status).toBe(200);
    expect(mocks.confirmarPorProvedor).not.toHaveBeenCalled();
  });

  it("corpo enorme é recusado (413)", async () => {
    const r = await hook("?webhookSecret=segredo-do-webhook", "{}", { "content-length": String(200_000) });
    expect(r.status).toBe(413);
  });
});

const chamarCron = (auth?: string) =>
  cron(new Request("http://x/api/cron/rpi", { headers: auth ? { authorization: auth } : {} }));

describe("cron diário", () => {
  beforeEach(() => {
    mocks.verificarSituacoes.mockResolvedValue({ ok: true });
    mocks.avisarPrazos.mockResolvedValue({ ok: true });
    mocks.rodarMonitoramento.mockResolvedValue({ ok: true });
  });

  it("com o segredo certo roda as três tarefas", async () => {
    const r = await chamarCron("Bearer segredo-do-cron");
    expect(r.status).toBe(200);
    expect(mocks.verificarSituacoes).toHaveBeenCalled();
    expect(mocks.avisarPrazos).toHaveBeenCalled();
    expect(mocks.rodarMonitoramento).toHaveBeenCalled();
  });

  it.each([
    ["sem cabeçalho", undefined],
    ["segredo errado", "Bearer errado"],
    ["esquema errado", "Basic segredo-do-cron"],
    ["só o segredo, sem Bearer", "segredo-do-cron-x"],
  ])("%s é recusado e não roda nada", async (_n, auth) => {
    const r = await chamarCron(auth);
    expect(r.status).toBe(401);
    expect(mocks.verificarSituacoes).not.toHaveBeenCalled();
    expect(mocks.rodarMonitoramento).not.toHaveBeenCalled();
  });

  it("sem CRON_SECRET configurado a rota se recusa a rodar (500), em vez de ficar aberta", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = await chamarCron("Bearer ");
    expect(r.status).toBe(500);
    expect(mocks.verificarSituacoes).not.toHaveBeenCalled();
  });
});

const buscar = (query: string, ip = "4.4.4.4") =>
  colidencia(new Request(`http://x/api/colidencia${query}`, { headers: { "x-forwarded-for": ip } }));

describe("GET /api/colidencia", () => {
  beforeEach(() => mocks.calcularColidencia.mockResolvedValue({ ok: true }));

  it("exige a marca", async () => {
    expect((await buscar("")).status).toBe(400);
    expect((await buscar("?marca=%20%20")).status).toBe(400);
  });

  it("recusa marca e descrição grandes demais, sem chamar a busca", async () => {
    expect((await buscar(`?marca=${"a".repeat(121)}`)).status).toBe(400);
    expect((await buscar(`?marca=x&descricao=${"d".repeat(2001)}`)).status).toBe(400);
    expect(mocks.calcularColidencia).not.toHaveBeenCalled();
  });

  it("busca normal funciona", async () => {
    expect((await buscar("?marca=Kaza%20Doce&descricao=bolos")).status).toBe(200);
    expect(mocks.calcularColidencia).toHaveBeenCalledWith("Kaza Doce", "bolos");
  });

  it("freia o excesso de buscas do mesmo IP (30 por minuto)", async () => {
    const codigos: number[] = [];
    for (let i = 0; i < 40; i++) codigos.push((await buscar("?marca=x", "6.6.6.6")).status);
    expect(codigos.slice(0, 30).every((c) => c === 200)).toBe(true);
    expect(codigos.slice(30).every((c) => c === 429)).toBe(true);
    expect((await buscar("?marca=x", "6.6.6.7")).status).toBe(200);
  });
});

describe("GET /api/health", () => {
  it("guarda o resultado por um minuto: várias visitas viram uma ida ao INPI", async () => {
    vi.resetModules();
    mocks.verificarRpi.mockResolvedValue({ ok: true });
    mocks.verificarBusca.mockResolvedValue({ ok: true });
    const { GET } = await import("./health/route");
    expect((await GET()).status).toBe(200);
    await GET();
    await GET();
    expect(mocks.verificarRpi).toHaveBeenCalledTimes(1);
    expect(mocks.verificarBusca).toHaveBeenCalledTimes(1);
  });

  it("responde 503 quando uma das integrações falha", async () => {
    vi.resetModules();
    mocks.verificarRpi.mockResolvedValue({ ok: false });
    mocks.verificarBusca.mockResolvedValue({ ok: true });
    const { GET } = await import("./health/route");
    const r = await GET();
    expect(r.status).toBe(503);
    expect((await r.json()).status).toBe("degraded");
  });
});
