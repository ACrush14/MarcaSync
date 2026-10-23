/**
 * Detecta indícios de palavra estrangeira no nome da marca. O e-Marcas pede a tradução de
 * qualquer palavra em outro idioma (Manual de Marcas, item 3.5.2).
 *
 * Isto é uma HEURÍSTICA, não um dicionário: acha sinais (letras e grupos de letras que quase
 * não existem em palavras portuguesas e algumas palavras comuns de outros idiomas). Pode errar
 * nos dois sentidos, por isso o formulário sempre pergunta ao cliente e o resultado só serve
 * para sugerir a resposta e para pedir conferência quando o cliente disser "não".
 * Palavra inventada (como "Kaza") não precisa de tradução: o cliente decide.
 */

export interface DeteccaoIdioma {
  suspeita: boolean;
  /** As palavras do nome que levantaram suspeita, como o cliente digitou. */
  palavras: string[];
}

/** Palavras muito usadas em marcas, em inglês, espanhol, italiano e francês (sem acento). */
const PALAVRAS_COMUNS = new Set([
  "shop",
  "store",
  "house",
  "home",
  "food",
  "foods",
  "coffee",
  "club",
  "studio",
  "design",
  "beauty",
  "fashion",
  "kids",
  "baby",
  "pet",
  "pets",
  "fit",
  "gym",
  "tech",
  "soft",
  "online",
  "group",
  "line",
  "style",
  "sweet",
  "love",
  "king",
  "queen",
  "burger",
  "burguer",
  "market",
  "express",
  "gold",
  "black",
  "white",
  "blue",
  "green",
  "red",
  "dream",
  "life",
  "smart",
  "pro",
  "plus",
  "the",
  "and",
  "of",
  "by",
  "for",
  "with",
  "dulce",
  "amore",
  "bella",
  "bello",
  "mia",
  "mio",
  "maison",
  "petit",
  "petite",
  "chez",
]);

// Grupos de letras raros em português: th, sh, ck, ph, wh, ght, dd, bb, gg, ff, tt, pp, zz. ("oo" e "ee" ficaram de fora: existem em voo, coordenar, veem.)
const GRUPOS_ESTRANGEIROS = /(th|sh|ck|ph|wh|ght|kk|ww|yy|dd|bb|gg|ff|tt|pp|zz|ough)/;
// Letras fora do uso comum em palavras nativas (k, w, y) e acentos que o português não usa.
const LETRAS_ESTRANGEIRAS = /[kwy]/;
const ACENTOS_ESTRANGEIROS = /[ñüöäëïåøæœß]/;
// Terminações típicas de inglês em palavra de marca.
const TERMINACOES_INGLES = /(ing|ers|ness|tion|ship|ful|less|ly)$/;

function semAcentoPortugues(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Dá os motivos (vazio se a palavra parece portuguesa ou inventada neutra). */
function motivos(palavra: string): string[] {
  const m: string[] = [];
  const sem = semAcentoPortugues(palavra);
  if (sem.length < 2) return m;
  if (PALAVRAS_COMUNS.has(sem)) m.push("palavra comum de outro idioma");
  if (ACENTOS_ESTRANGEIROS.test(palavra.toLowerCase())) m.push("letra de outro idioma");
  if (LETRAS_ESTRANGEIRAS.test(sem)) m.push("letra k, w ou y");
  if (GRUPOS_ESTRANGEIROS.test(sem)) m.push("grupo de letras raro em português");
  if (sem.length > 4 && TERMINACOES_INGLES.test(sem)) m.push("terminação típica de inglês");
  return m;
}

/**
 * Como ler: o nome é quebrado em palavras (só letras e acentos); cada palavra é conferida e
 * `palavras` traz só as suspeitas. `suspeita` é verdadeiro se houver pelo menos uma.
 */
export function detectarPalavraEstrangeira(nome: string): DeteccaoIdioma {
  const palavras = nome.match(/[\p{L}]+/gu) ?? [];
  const suspeitas = palavras.filter((p) => motivos(p).length > 0);
  return { suspeita: suspeitas.length > 0, palavras: suspeitas };
}
