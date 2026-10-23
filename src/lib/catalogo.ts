import dados from "../data/termos-preaprovados.json";
import { normalizarTermo } from "./termo";

export { normalizarTermo };

/**
 * Catálogo de termos pré-aprovados do INPI, por classe de Nice. Vem de dois arquivos oficiais
 * baixados do portal do INPI: a Classificação de Nice (NCL 13, 2026), em português, e as
 * Listas Auxiliares de Produtos e de Serviços (janeiro de 2026). O texto foi extraído dos PDFs
 * por script; por isso a lista ajuda, mas quem decide é a tela do e-Marcas: confira lá o
 * item exato antes de protocolar.
 *
 * Por que importa: pedido com TODOS os itens da lista usa o serviço 389 (GRU mais barata e
 * exame mais rápido). Se algum item for de texto livre, o pedido vira serviço 394, que custa
 * quase o dobro (ver `src/lib/gru.ts`).
 */

const CLASSES = dados.classes as Record<string, string[]>;
export const VERSAO_CATALOGO: string = dados.versao;

// Uma tabela de chaves por classe, montada uma vez: consultar vira um acesso direto.
const CHAVES: Record<string, Map<string, string>> = {};
for (const [classe, termos] of Object.entries(CLASSES)) {
  CHAVES[classe] = new Map(termos.map((t) => [normalizarTermo(t), t]));
}

/** O termo (como o INPI escreve) se estiver na lista da classe; senão, null. */
export function termoOficial(classe: string, termo: string): string | null {
  return CHAVES[classe]?.get(normalizarTermo(termo)) ?? null;
}

/**
 * Procura termos da classe que contêm todas as palavras digitadas (em qualquer ordem).
 * Os que começam pela busca vêm primeiro; depois os mais curtos. Devolve no máximo `limite`.
 */
export function buscarTermos(classe: string, consulta: string, limite = 15): string[] {
  const termos = CLASSES[classe];
  if (!termos) return [];
  const palavras = normalizarTermo(consulta).split(" ").filter(Boolean);
  if (palavras.length === 0) return [];
  const achados: Array<{ termo: string; chave: string }> = [];
  for (const termo of termos) {
    const chave = normalizarTermo(termo);
    if (palavras.every((p) => chave.includes(p))) achados.push({ termo, chave });
  }
  const inicio = normalizarTermo(consulta);
  achados.sort((a, b) => {
    const pa = a.chave.startsWith(inicio) ? 0 : 1;
    const pb = b.chave.startsWith(inicio) ? 0 : 1;
    return pa - pb || a.termo.length - b.termo.length;
  });
  return achados.slice(0, limite).map((a) => a.termo);
}

export interface AnaliseEspecificacao {
  /** Itens como o INPI escreve (os que estão na lista). */
  preAprovados: string[];
  /** Itens digitados que NÃO estão na lista (texto livre). */
  livres: string[];
  /** true quando não há nenhum item livre: vale o serviço 389. */
  todosPreAprovados: boolean;
}

/**
 * Separa os itens da especificação em "da lista" e "livres". Itens vazios e repetidos
 * (mesma chave normalizada) são descartados.
 */
export function analisarEspecificacao(classe: string, itens: string[]): AnaliseEspecificacao {
  const vistos = new Set<string>();
  const preAprovados: string[] = [];
  const livres: string[] = [];
  for (const bruto of itens) {
    const item = bruto.replace(/\s+/g, " ").trim();
    const chave = normalizarTermo(item);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    const oficial = termoOficial(classe, item);
    if (oficial) preAprovados.push(oficial);
    else livres.push(item);
  }
  return { preAprovados, livres, todosPreAprovados: livres.length === 0 };
}
