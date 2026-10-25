/**
 * GET /api/processos alimenta o /admin: precisa trazer tudo o que o painel mostra (datas, situações
 * do INPI, avisos do pedido) e não pode ficar aberta sem senha.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  processo: { findMany: vi.fn() },
  notificacao: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { GET } from "./route";

const proc = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  marca: `Marca ${id}`,
  riscoPct: 10,
  nclCode: "30",
  createdAt: new Date("2026-10-24T18:00:00Z"),
  updatedAt: new Date("2026-10-25T12:00:00Z"),
  cliente: { nome: "Ana", whatsapp: "85999991234", email: "a@x.com", createdAt: new Date() },
  pagamentos: [],
  pedidoRegistro: null,
  prazos: [],
  reciboProtocolo: null,
  imagemMarca: null,
  situacoes: [],
  _count: { alertas: 0 },
  ...extra,
});
const aviso = (n: number, processoId: string) => ({
  id: `n${n}`,
  processoId,
  destino: "operador",
  canal: "telegram",
  assunto: `Aviso ${n}`,
  enviadaEm: new Date(),
  erro: null,
  createdAt: new Date(Date.UTC(2026, 9, 24, 12, n)),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.notificacao.findMany.mockResolvedValue([]);
});

describe("GET /api/processos", () => {
  it("pede ao banco as datas, as situações do INPI e a contagem de alertas", async () => {
    db.processo.findMany.mockResolvedValue([proc("p1")]);
    await GET();
    const args = db.processo.findMany.mock.calls[0]?.[0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.include.cliente).toBe(true);
    expect(args.include.situacoes).toEqual({ orderBy: { vistaEm: "desc" }, take: 5 });
    expect(args.include._count).toEqual({ select: { alertas: true } });
  });

  it("devolve o processo com as datas e os avisos dele (no máximo 5, os mais recentes)", async () => {
    db.processo.findMany.mockResolvedValue([proc("p1"), proc("p2")]);
    db.notificacao.findMany.mockResolvedValue([
      ...Array.from({ length: 8 }, (_, i) => aviso(i, "p1")),
      aviso(99, "p2"),
      aviso(100, "outro-processo"),
    ]);
    const corpo = await (await GET()).json();
    const p1 = corpo.processos.find((p: { id: string }) => p.id === "p1");
    const p2 = corpo.processos.find((p: { id: string }) => p.id === "p2");
    expect(p1.createdAt).toBeTruthy();
    expect(p1.updatedAt).toBeTruthy();
    expect(p1.avisos).toHaveLength(5);
    expect(p1.avisos[0].assunto).toBe("Aviso 0");
    expect(p2.avisos.map((v: { assunto: string }) => v.assunto)).toEqual(["Aviso 99"]);
  });

  it("não traz o texto dos avisos (só o assunto), para a lista não pesar", async () => {
    db.processo.findMany.mockResolvedValue([proc("p1")]);
    await GET();
    const select = db.notificacao.findMany.mock.calls[0]?.[0].select;
    expect(select.assunto).toBe(true);
    expect("texto" in select).toBe(false);
  });

  it("sem processos, nem consulta os avisos", async () => {
    db.processo.findMany.mockResolvedValue([]);
    const corpo = await (await GET()).json();
    expect(corpo.processos).toEqual([]);
    expect(db.notificacao.findMany).not.toHaveBeenCalled();
  });

  it("processo sem avisos fica com lista vazia, não undefined", async () => {
    db.processo.findMany.mockResolvedValue([proc("p1")]);
    const corpo = await (await GET()).json();
    expect(corpo.processos[0].avisos).toEqual([]);
  });
});
