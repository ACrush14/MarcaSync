//Se não houver classes, devolver uma lista vazia
//O .split(",") quebra o texto em virgulas
//Em cada pedaço, tire os espaços das pontas (Que função exatamente faz isso?)
//Em cada pedaço, converta para numero inteiro de base 10 (tem necessidade disso?)
//O que não é numero, ele vira NaN
//Descarte os pedaços vazios (Que função exatamente faz isso? Quais caracteres fazem isso?)

export function listarClasses(classe: string | null): string[] {
  if (!classe) return [];
  return classe
    .split(",")
    .map((c) => String(parseInt(c.trim(), 10)))
    .filter((c) => c !== "NaN")
    .filter(Boolean);
}

export function mesmaArea(
  classeDaMarca: string | null,
  classeSugerida: string,
  confianca: "alta" | "baixa"
): boolean | null {
  if (confianca === "baixa") return null;
  const classes = listarClasses(classeDaMarca);
  if (classes.length === 0) return null;
  return classes.includes(classeSugerida);
}

export interface GruposPorArea<T> {
  /** Marcas da mesma classe que o cliente quer registrar (`mesmaArea === true`). */
  mesmaArea: T[];
  /** Marcas de outra classe (`mesmaArea === false`). */
  outrasAreas: T[];
  /** Marcas sem classe informada, ou sem sugestão confiável (`mesmaArea` null/ausente). */
  semClasse: T[];
  /** Vale mostrar a separação? Só quando pelo menos uma marca tem resposta sim ou não. */
  separavel: boolean;
}

/**
 * Separa as marcas encontradas em três grupos, pelo campo `mesmaArea`, mantendo a
 * ordem em que vieram (o servidor já as entrega da mais parecida para a menos).
 *
 * Como ler a assinatura:
 * `<T extends { mesmaArea?: boolean | null }>` diz que a função aceita lista de
 * qualquer tipo de marca, desde que ela possa ter o campo `mesmaArea`. Assim a mesma
 * função serve para a marca do INPI e para a de demonstração, e devolve o mesmo tipo
 * que recebeu.
 *
 * Como ler o corpo:
 * `=== true` e `=== false` separam os três casos sem confundir `false` com `null`:
 * "é de outro ramo" é diferente de "não sei", e o segundo vai para `semClasse`.
 */
export function agruparPorArea<T extends { mesmaArea?: boolean | null }>(
  matches: T[]
): GruposPorArea<T> {
  const mesmaArea: T[] = [];
  const outrasAreas: T[] = [];
  const semClasse: T[] = [];
  for (const m of matches) {
    if (m.mesmaArea === true) mesmaArea.push(m);
    else if (m.mesmaArea === false) outrasAreas.push(m);
    else semClasse.push(m);
  }
  return {
    mesmaArea,
    outrasAreas,
    semClasse,
    separavel: mesmaArea.length + outrasAreas.length > 0,
  };
}
