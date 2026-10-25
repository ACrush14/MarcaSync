import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  processo: { findUnique: vi.fn() },
  notificacao: { count: vi.fn() },
}));
const notificar = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ prisma: db }));
vi.mock("./notificar", () => ({ notificar }));

import { MAX_AVISOS_INTERESSE_POR_HORA, avisarNovoInteresse } from "./avisos";

const agora = new Date("2026-10-25T15:00:00Z");
const processo = {
  marca: "Kaza Doce",
  riscoPct: 12,
  nclCode: "30",
  createdAt: agora,
  cliente: { nome: "Ana Maria Ramos", whatsapp: "(85) 99999-1234" },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.processo.findUnique.mockResolvedValue(processo);
  db.notificacao.count.mockResolvedValue(0);
});

describe("avisarNovoInteresse", () => {
  it("avisa o operador com nome, WhatsApp, marca, risco e classe", async () => {
    expect(await avisarNovoInteresse("p1", agora)).toEqual({ avisou: true });
    const aviso = notificar.mock.calls[0]?.[0];
    expect(aviso.para).toBe("operador");
    expect(aviso.processoId).toBe("p1");
    expect(aviso.assunto).toBe("Novo interesse: Ana (Kaza Doce)");
    expect(aviso.texto).toContain("Ana Maria Ramos deixou o contato");
    expect(aviso.texto).toContain("(85) 99999-1234");
    expect(aviso.texto).toContain("Risco de colisão: 12%");
    expect(aviso.texto).toContain("Classe sugerida: 30");
    expect(aviso.texto).toContain("/admin");
  });

  it("funciona sem risco e sem classe", async () => {
    db.processo.findUnique.mockResolvedValue({ ...processo, riscoPct: null, nclCode: null });
    await avisarNovoInteresse("p1", agora);
    const texto = notificar.mock.calls[0]?.[0].texto as string;
    expect(texto).not.toContain("Risco");
    expect(texto).not.toContain("Classe");
  });

  it("processo que não existe: não avisa", async () => {
    db.processo.findUnique.mockResolvedValue(null);
    expect(await avisarNovoInteresse("x", agora)).toEqual({ avisou: false });
    expect(notificar).not.toHaveBeenCalled();
  });

  it("limita a quantidade por hora: cadastro em massa não enche o seu WhatsApp", async () => {
    db.notificacao.count.mockResolvedValue(MAX_AVISOS_INTERESSE_POR_HORA);
    expect(await avisarNovoInteresse("p1", agora)).toEqual({ avisou: false });
    expect(notificar).not.toHaveBeenCalled();
    db.notificacao.count.mockResolvedValue(MAX_AVISOS_INTERESSE_POR_HORA - 1);
    expect(await avisarNovoInteresse("p1", agora)).toEqual({ avisou: true });
  });

  it("o limite conta só a última hora e só os avisos de interesse para o operador", async () => {
    await avisarNovoInteresse("p1", agora);
    const where = db.notificacao.count.mock.calls[0]?.[0].where;
    expect(where.destino).toBe("operador");
    expect(where.assunto).toEqual({ startsWith: "Novo interesse" });
    expect(where.createdAt.gte.getTime()).toBe(agora.getTime() - 3_600_000);
  });
});
