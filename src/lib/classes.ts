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
