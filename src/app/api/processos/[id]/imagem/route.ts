import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { barrarSeExceder } from "@/lib/limite-publico";
import { MAX_ORIGINAL_BYTES, prepararImagemMarca } from "@/lib/imagem-marca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/processos/:id/imagem   (multipart/form-data, campo "imagem")
 *
 * Recebe a imagem da marca (PNG ou JPG), converte no JPG que o e-Marcas pede (RGB, 300 dpi,
 * mínimo 945 x 945 px, até 2 MB) e guarda no banco: o JPG pronto e o original. Enviar de novo
 * troca a imagem. A validação que vale é a daqui: o navegador só ajuda o cliente.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const barrado = barrarSeExceder(request, "enviarImagem");
  if (barrado) return barrado;

  const { id } = await params;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_ORIGINAL_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande (máximo 5 MB)." }, { status: 413 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie como multipart/form-data." }, { status: 400 });
  }
  const arquivo = formData.get("imagem");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Campo "imagem" ausente.' }, { status: 400 });
  }

  const processo = await prisma.processo.findUnique({ where: { id }, select: { id: true } });
  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const original = Buffer.from(await arquivo.arrayBuffer());
  const resultado = await prepararImagemMarca(original);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.erro }, { status: 400 });
  }
  const img = resultado.imagem;

  const dados = {
    jpg: new Uint8Array(img.jpg),
    original: new Uint8Array(original),
    mimeOriginal: arquivo.type || "application/octet-stream",
    larguraOriginal: img.larguraOriginal,
    alturaOriginal: img.alturaOriginal,
    largura: img.largura,
    altura: img.altura,
    ampliada: img.ampliada,
  };
  await prisma.imagemMarca.upsert({
    where: { processoId: id },
    create: { processoId: id, ...dados },
    update: dados,
  });

  return NextResponse.json(
    {
      largura: img.largura,
      altura: img.altura,
      larguraOriginal: img.larguraOriginal,
      alturaOriginal: img.alturaOriginal,
      ampliada: img.ampliada,
      tamanhoJpg: img.jpg.length,
    },
    { status: 201 }
  );
}

/**
 * GET /api/processos/:id/imagem?tipo=jpg|original
 *
 * Devolve a imagem guardada, para você baixar e anexar no e-Marcas. Protegida por senha em
 * `src/proxy.ts` (a imagem é do cliente e não deve ficar aberta).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tipo = new URL(request.url).searchParams.get("tipo") === "original" ? "original" : "jpg";

  const img = await prisma.imagemMarca.findUnique({ where: { processoId: id } });
  if (!img) return NextResponse.json({ error: "Sem imagem para este processo." }, { status: 404 });

  const corpo = tipo === "original" ? img.original : img.jpg;
  const mime = tipo === "original" ? img.mimeOriginal : "image/jpeg";
  return new Response(new Uint8Array(corpo), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="marca-${id}.${tipo === "original" ? (mime === "image/png" ? "png" : "jpg") : "jpg"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
