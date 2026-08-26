import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DIMENSAO = 1000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — generoso pra um PNG 1000x1000
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Lê largura/altura direto do header IHDR do PNG (bytes 16-23), sem
 * depender de nenhuma lib de imagem. Não confiamos no `naturalWidth` que o
 * navegador já validou no cliente — é fácil de burlar, então a validação
 * que importa de verdade é esta, no servidor.
 */
function lerDimensaoPng(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(ASSINATURA_PNG)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * POST /api/processos/:id/logo
 *
 * Upload do logotipo da marca (multipart/form-data, campo "logo") — só pra
 * marcas mistas (nome + imagem); marca nominativa não precisa disso.
 * Guardado no Vercel Blob (acesso público — URL aleatória e não listável,
 * não requer token pra ler; ver README).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie como multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo \"logo\" ausente ou inválido." }, { status: 400 });
  }
  if (file.type !== "image/png") {
    return NextResponse.json({ error: "Só aceitamos PNG." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máximo 5MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensao = lerDimensaoPng(buffer);
  if (!dimensao) {
    return NextResponse.json({ error: "Arquivo não parece ser um PNG válido." }, { status: 400 });
  }
  if (dimensao.width > MAX_DIMENSAO || dimensao.height > MAX_DIMENSAO) {
    return NextResponse.json(
      { error: `Imagem ${dimensao.width}×${dimensao.height}px — máximo ${MAX_DIMENSAO}×${MAX_DIMENSAO}px.` },
      { status: 400 }
    );
  }

  const processo = await prisma.processo.findUnique({ where: { id } });
  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const blob = await put(`logos/${id}.png`, buffer, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: true,
  });

  await prisma.processo.update({ where: { id }, data: { logoUrl: blob.url } });

  return NextResponse.json({ url: blob.url });
}
