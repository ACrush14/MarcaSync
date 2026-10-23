import sharp from "sharp";

/**
 * Prepara a imagem da marca para o e-Marcas (Manual de Marcas do INPI, item 3.5.2):
 * JPG, cores RGB, 300 dpi, no mínimo 945 x 945 px e no máximo 2 MB, uma imagem só.
 * O cliente pode mandar PNG ou JPG, de qualquer tamanho razoável; aqui viramos o JPG do INPI.
 */

export const LADO_MINIMO_PX = 945;
export const MAX_JPG_BYTES = 2 * 1024 * 1024;
export const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const LADO_MAXIMO_PX = 3000;
const DPI = 300;

export interface ImagemPreparada {
  jpg: Buffer;
  larguraOriginal: number;
  alturaOriginal: number;
  largura: number;
  altura: number;
  /** true se o original era menor que 945 px e foi ampliado (a nitidez pode ficar pior). */
  ampliada: boolean;
}

export type ResultadoImagem = { ok: true; imagem: ImagemPreparada } | { ok: false; erro: string };

/**
 * Tamanho final do JPG. Como ler: se algum lado é menor que 945, multiplica os dois pelo
 * mesmo fator para o menor lado chegar a 945 (a proporção não muda). Se algum lado passar de
 * 3000, reduz os dois pelo mesmo fator, a não ser que isso deixasse o menor lado abaixo
 * de 945 (imagem muito comprida): nesse caso mantém o tamanho.
 */
export function dimensoesAlvo(
  largura: number,
  altura: number
): { largura: number; altura: number; ampliada: boolean } {
  const menor = Math.min(largura, altura);
  if (menor < LADO_MINIMO_PX) {
    const f = LADO_MINIMO_PX / menor;
    return {
      largura: Math.max(LADO_MINIMO_PX, Math.ceil(largura * f)),
      altura: Math.max(LADO_MINIMO_PX, Math.ceil(altura * f)),
      ampliada: true,
    };
  }
  const maior = Math.max(largura, altura);
  if (maior > LADO_MAXIMO_PX) {
    const f = LADO_MAXIMO_PX / maior;
    const l = Math.round(largura * f);
    const a = Math.round(altura * f);
    if (Math.min(l, a) >= LADO_MINIMO_PX) return { largura: l, altura: a, ampliada: false };
  }
  return { largura, altura, ampliada: false };
}

/** Converte o arquivo enviado no JPG do INPI, ou explica por que não deu. */
export async function prepararImagemMarca(entrada: Buffer): Promise<ResultadoImagem> {
  if (entrada.length > MAX_ORIGINAL_BYTES) {
    return { ok: false, erro: "Arquivo muito grande (máximo 5 MB)." };
  }

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(entrada, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    return { ok: false, erro: "Não consegui ler essa imagem. Envie um PNG ou JPG." };
  }
  if ((meta.format !== "png" && meta.format !== "jpeg") || !meta.width || !meta.height) {
    return { ok: false, erro: "Só aceitamos PNG ou JPG." };
  }

  // Foto de celular pode vir deitada (orientação EXIF 5 a 8): largura e altura trocam depois de girar.
  const deitada = (meta.orientation ?? 1) >= 5;
  const larguraReal = deitada ? meta.height : meta.width;
  const alturaReal = deitada ? meta.width : meta.height;
  const alvo = dimensoesAlvo(larguraReal, alturaReal);
  for (const qualidade of [92, 85, 75, 65, 50]) {
    const jpg = await sharp(entrada, { limitInputPixels: 50_000_000 })
      .rotate() // respeita a orientação gravada pela câmera
      .resize(alvo.largura, alvo.altura, { fit: "fill", kernel: "lanczos3" })
      .flatten({ background: "#ffffff" }) // PNG com fundo transparente vira fundo branco
      .toColourspace("srgb")
      .withMetadata({ density: DPI })
      .jpeg({ quality: qualidade })
      .toBuffer();
    if (jpg.length <= MAX_JPG_BYTES) {
      return {
        ok: true,
        imagem: {
          jpg,
          larguraOriginal: larguraReal,
          alturaOriginal: alturaReal,
          largura: alvo.largura,
          altura: alvo.altura,
          ampliada: alvo.ampliada,
        },
      };
    }
  }
  return { ok: false, erro: "A imagem fica maior que 2 MB mesmo comprimida. Envie uma menor." };
}
