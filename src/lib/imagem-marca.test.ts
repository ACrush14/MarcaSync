/**
 * Testes de src/lib/imagem-marca.ts: o logo vira o JPG que o e-Marcas pede (RGB, 300 dpi,
 * lado menor de pelo menos 945 px, até 2 MB). As imagens de teste são geradas aqui mesmo.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dimensoesAlvo, LADO_MINIMO_PX, MAX_JPG_BYTES, prepararImagemMarca } from "./imagem-marca";

async function png(largura: number, altura: number, transparente = false): Promise<Buffer> {
  return sharp({
    create: {
      width: largura,
      height: altura,
      channels: 4,
      background: transparente
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 200, g: 30, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("dimensoesAlvo", () => {
  it("imagem pequena é ampliada até o menor lado chegar a 945, mantendo a proporção", () => {
    expect(dimensoesAlvo(500, 500)).toEqual({ largura: 945, altura: 945, ampliada: true });
    const r = dimensoesAlvo(400, 800);
    expect(r.largura).toBe(945);
    expect(r.altura).toBe(1890);
    expect(r.ampliada).toBe(true);
  });

  it("imagem de tamanho bom não muda", () => {
    expect(dimensoesAlvo(1200, 1000)).toEqual({ largura: 1200, altura: 1000, ampliada: false });
    expect(dimensoesAlvo(945, 945)).toEqual({ largura: 945, altura: 945, ampliada: false });
  });

  it("imagem enorme é reduzida até 3000, sem passar do mínimo", () => {
    expect(dimensoesAlvo(6000, 6000)).toEqual({ largura: 3000, altura: 3000, ampliada: false });
    // muito comprida: reduzir deixaria o lado menor abaixo de 945, então fica como está
    expect(dimensoesAlvo(9000, 1000)).toEqual({ largura: 9000, altura: 1000, ampliada: false });
  });
});

describe("prepararImagemMarca", () => {
  it("converte PNG em JPG RGB de 300 dpi e acima de 945 px", async () => {
    const r = await prepararImagemMarca(await png(1200, 1200));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.imagem.ampliada).toBe(false);
    const meta = await sharp(r.imagem.jpg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.space).toBe("srgb");
    expect(meta.density).toBe(300);
    expect(meta.width).toBe(1200);
    expect(r.imagem.jpg.length).toBeLessThanOrEqual(MAX_JPG_BYTES);
  });

  it("amplia imagem pequena e avisa que foi ampliada", async () => {
    const r = await prepararImagemMarca(await png(300, 300));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.imagem.ampliada).toBe(true);
    expect(r.imagem.larguraOriginal).toBe(300);
    expect(Math.min(r.imagem.largura, r.imagem.altura)).toBeGreaterThanOrEqual(LADO_MINIMO_PX);
  });

  it("PNG transparente vira fundo branco", async () => {
    const r = await prepararImagemMarca(await png(1000, 1000, true));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { data } = await sharp(r.imagem.jpg).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(250);
    expect(data[1]).toBeGreaterThan(250);
    expect(data[2]).toBeGreaterThan(250);
  });

  it("aceita JPG de entrada", async () => {
    const jpg = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: { r: 10, g: 80, b: 200 } },
    })
      .jpeg()
      .toBuffer();
    expect((await prepararImagemMarca(jpg)).ok).toBe(true);
  });

  it("recusa o que não é imagem e formatos fora de PNG/JPG", async () => {
    const lixo = await prepararImagemMarca(Buffer.from("isto não é uma imagem"));
    expect(lixo.ok).toBe(false);
    const gif = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .gif()
      .toBuffer();
    const r = await prepararImagemMarca(gif);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("PNG ou JPG");
  });

  it("recusa arquivo acima de 5 MB", async () => {
    const r = await prepararImagemMarca(Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("5 MB");
  });
});
