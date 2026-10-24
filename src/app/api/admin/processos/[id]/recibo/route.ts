import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // o recibo do e-Marcas é bem menor que isso

/**
 * POST /api/admin/processos/:id/recibo   (multipart, campo "recibo", PDF até 2 MB)
 * GET  /api/admin/processos/:id/recibo   (baixa o PDF guardado)
 *
 * O recibo que o e-Marcas devolve ao protocolar fica guardado no banco, junto do pedido. Protegida
 * por senha em src/proxy.ts (rotas /api/admin/).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Arquivo grande demais (máximo 2 MB)." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("recibo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Envie o PDF no campo "recibo".' }, { status: 400 });
  }
  if (arquivo.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo grande demais (máximo 2 MB)." }, { status: 413 });
  }
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  // Um PDF de verdade começa com "%PDF-"; o tipo informado pelo navegador não vale como prova.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Isso não parece um PDF." }, { status: 400 });
  }
  const existe = await prisma.processo.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  const dados = {
    pdf: new Uint8Array(bytes),
    nomeArquivo: arquivo.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "recibo.pdf",
    tamanho: bytes.length,
  };
  await prisma.reciboProtocolo.upsert({
    where: { processoId: id },
    create: { processoId: id, ...dados },
    update: dados,
  });
  return NextResponse.json({ ok: true, tamanho: bytes.length }, { status: 201 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.reciboProtocolo.findUnique({ where: { processoId: id } });
  if (!r) return NextResponse.json({ error: "Sem recibo guardado." }, { status: 404 });
  return new Response(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.nomeArquivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
