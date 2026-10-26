/**
 * Logos criadas por IA (Gemini) para a marca figurativa ou mista: o que se pede ao modelo, como
 * ler a resposta e quanto cada pedido pode gerar. A parte que fala com o Gemini fica em
 * `gemini-imagem.ts`; a rota, em `api/processos/[id]/logo-ia`.
 */

/** Quantas opções aparecem por rodada (uma chamada ao Gemini por opção, cada uma num estilo). */
export const LOGOS_POR_RODADA = 4;

/** Até 3 rodadas de 4 logos por pedido. O limite protege o custo: cada imagem custa centavos. */
export const RODADAS_POR_PEDIDO = 3;
export const MAX_GERACOES_POR_PEDIDO = LOGOS_POR_RODADA * RODADAS_POR_PEDIDO;

/** Teto de imagens geradas por dia no site todo (muda com LOGO_IA_LIMITE_DIA). */
export const MAX_GERACOES_POR_DIA_PADRAO = 200;

export const APRESENTACOES_COM_IA = ["figurativa", "mista"] as const;
export type ApresentacaoComIa = (typeof APRESENTACOES_COM_IA)[number];

/** Um estilo por opção, para as 4 logos virem diferentes entre si. */
export const ESTILOS = [
  {
    id: "minimalista",
    pedido: "minimalist flat geometric symbol, clean shapes, two or three solid colors",
  },
  {
    id: "ilustrado",
    pedido: "friendly hand-drawn illustrated emblem, simple bold lines, warm palette",
  },
  {
    id: "emblema",
    pedido: "classic badge or seal style emblem, balanced and symmetric, limited palette",
  },
  {
    id: "moderno",
    pedido: "modern bold abstract mark, confident shapes, vibrant but limited palette",
  },
] as const;

export type EstiloId = (typeof ESTILOS)[number]["id"];

/** O estilo da opção `variacao` (0 a 3); fora disso, null. */
export function estiloDaVariacao(variacao: unknown): (typeof ESTILOS)[number] | null {
  if (typeof variacao !== "number" || !Number.isInteger(variacao)) return null;
  return ESTILOS[variacao] ?? null;
}

/** Tira caracteres de controle e espaços repetidos e corta no tamanho: é o que vai para o modelo. */
export function limparEntrada(texto: unknown, max: number): string {
  if (typeof texto !== "string") return "";
  return texto.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export interface EntradaLogo {
  marca: string;
  atividade: string;
  apresentacao: ApresentacaoComIa;
}

/** A atividade precisa dizer alguma coisa: com menos que isso o modelo inventa. */
export const ATIVIDADE_MINIMA = 10;
export const MARCA_MAXIMA = 120;
export const ATIVIDADE_MAXIMA = 500;

export type EntradaValidada =
  | { ok: true; dados: EntradaLogo }
  | { ok: false; erro: string };

export function validarEntradaLogo(entrada: {
  marca?: unknown;
  atividade?: unknown;
  apresentacao?: unknown;
}): EntradaValidada {
  const marca = limparEntrada(entrada.marca, MARCA_MAXIMA);
  const atividade = limparEntrada(entrada.atividade, ATIVIDADE_MAXIMA);
  const apresentacao = APRESENTACOES_COM_IA.find((a) => a === entrada.apresentacao);
  if (!apresentacao) {
    return { ok: false, erro: "A criação com IA vale para marca figurativa ou mista." };
  }
  if (!marca) return { ok: false, erro: "Informe o nome da marca." };
  if (atividade.length < ATIVIDADE_MINIMA) {
    return { ok: false, erro: "Descreva a atividade com um pouco mais de detalhe." };
  }
  return { ok: true, dados: { marca, atividade, apresentacao } };
}

/**
 * O pedido ao modelo (em inglês, que ele segue melhor). O nome e a atividade vão entre aspas, como
 * dado. Marca figurativa: só símbolo, sem nenhuma letra. Marca mista: símbolo mais o nome escrito.
 */
export function montarPrompt(entrada: EntradaLogo, estilo: (typeof ESTILOS)[number]): string {
  const texto =
    entrada.apresentacao === "mista"
      ? `Include the brand name "${entrada.marca}" as clear, legible text next to or below the symbol, spelled exactly like that and with no other words.`
      : "Symbol only: absolutely no letters, words or numbers anywhere in the image.";
  return [
    "Design a professional trademark logo.",
    `Brand name: "${entrada.marca}".`,
    `What the business does: "${entrada.atividade}".`,
    `Style: ${estilo.pedido}.`,
    texto,
    "Show a single centered logo on a plain pure white background, square image, flat vector look.",
    "No mockups, no photos, no frames, no shadows, no watermark, no trademark symbols (TM or R).",
    "Do not copy or imitate any existing brand or logo.",
  ].join(" ");
}

export interface ImagemGerada {
  mime: string;
  base64: string;
}

const MIME_IMAGEM = /^image\/(png|jpeg|webp)$/;

/**
 * Procura a imagem na resposta do Gemini, em qualquer parte do JSON: o formato novo
 * (`{ type: "image", data, mime_type }`) e o antigo (`inlineData` / `inline_data`). Pega a
 * primeira que achar. Devolve null se não houver imagem (o modelo pode ter respondido só texto).
 */
export function extrairImagem(resposta: unknown, profundidade = 0): ImagemGerada | null {
  if (resposta === null || typeof resposta !== "object" || profundidade > 8) return null;
  if (Array.isArray(resposta)) {
    for (const item of resposta) {
      const achada = extrairImagem(item, profundidade + 1);
      if (achada) return achada;
    }
    return null;
  }
  const o = resposta as Record<string, unknown>;

  const direto = (dados: unknown, mime: unknown) =>
    typeof dados === "string" && dados.length > 100
      ? { mime: typeof mime === "string" && MIME_IMAGEM.test(mime) ? mime : "image/png", base64: dados }
      : null;

  if (o.type === "image") {
    const achada = direto(o.data, o.mime_type ?? o.mimeType);
    if (achada) return achada;
  }
  for (const chave of ["inlineData", "inline_data"]) {
    const inline = o[chave];
    if (inline && typeof inline === "object") {
      const i = inline as Record<string, unknown>;
      const achada = direto(i.data, i.mimeType ?? i.mime_type);
      if (achada) return achada;
    }
  }
  for (const valor of Object.values(o)) {
    const achada = extrairImagem(valor, profundidade + 1);
    if (achada) return achada;
  }
  return null;
}

/** Quantas imagens o site gera por dia, no máximo (LOGO_IA_LIMITE_DIA, ou o padrão). */
export function limiteDoDia(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.LOGO_IA_LIMITE_DIA);
  return Number.isInteger(n) && n > 0 ? n : MAX_GERACOES_POR_DIA_PADRAO;
}
