import { riskTier } from "./fonetica";
import type { RiscoPorArea } from "./risco-area";

/**
 * Aviso de "pedido anterior": no INPI vale quem deposita primeiro (a data e a hora do envio
 * é a data de prioridade) e o INPI indefere pedido igual ou parecido com marca já registrada
 * ou já pedida por outra pessoa para o mesmo ramo. Então, se a busca acha uma marca parecida
 * no ramo do cliente que ainda está viva, a tendência é o pedido NÃO dar certo, a não ser que
 * exista um caminho para contornar. Este arquivo decide quando avisar e o que dizer.
 *
 * Os caminhos citados vêm do Manual de Marcas do INPI (28/11/2025): direito de precedência do
 * usuário anterior (art. 129, § 1º), caducidade (item 6.5) e a análise de afinidade
 * entre classes. Não é aconselhamento jurídico: confirme com um agente da propriedade industrial.
 */

export type NivelAnterioridade = "provavel-bloqueio" | "anterior-encerrado" | "nenhum";

export interface MarcaAnterior {
  nome: string;
  pct: number;
  numeroProcesso?: string;
  status?: string;
  titular?: string;
}

export interface AvisoAnterioridade {
  nivel: NivelAnterioridade;
  anterior: MarcaAnterior | null;
  titulo: string;
  texto: string;
  /** Caminhos para tentar mesmo assim (vazio quando não há aviso). */
  alternativas: string[];
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** O pedido ou registro anterior já acabou (arquivado, extinto, indeferido, anulado, caduco)? */
export function anteriorEncerrado(status: string | undefined): boolean {
  if (!status) return false;
  return /arquivad|extint|indefer|nulo|nula|nulidade|caduc|renunci|inexistente/.test(
    semAcento(status)
  );
}

const ALTERNATIVAS = [
  "Mudar o nome ou o elemento que distingue a marca, e refazer a busca.",
  "Se você já usava a marca de boa-fé no Brasil há pelo menos 6 meses antes do depósito dela, existe o direito de precedência (art. 129, § 1º): é feito por oposição ou pedido de nulidade, com provas do uso. Pode funcionar, mas é um processo à parte.",
  "Se a marca anterior não é usada há 5 anos ou mais, dá para pedir a caducidade dela (Manual de Marcas, item 6.5). Leva tempo e precisa de prova.",
  "Se as atividades forem de fato diferentes, restringir a especificação a produtos ou serviços que não sejam afins ao da marca anterior. O INPI avalia a afinidade entre classes, então só ajuda quando o ramo é mesmo outro.",
];

/**
 * Lê o risco da busca e devolve o aviso. Como ler: olha só a marca mais parecida DO RAMO do
 * cliente (ou a mais parecida de todas, quando a busca não separou por ramo). Se for
 * "risco alto" (60% ou mais, a mesma régua da tela de resultado):
 *  - e ainda viva (ou sem situação conhecida) → "provavel-bloqueio";
 *  - e já encerrada → "anterior-encerrado" (o caminho está livre, mas vale conferir);
 * senão → "nenhum".
 */
export function avaliarAnterioridade(risco: RiscoPorArea<MarcaAnterior>): AvisoAnterioridade {
  const candidata = risco.modo === "por-ramo" ? risco.noRamo : risco.principal;
  if (!candidata || riskTier(candidata.pct).tier !== "alto") {
    return { nivel: "nenhum", anterior: null, titulo: "", texto: "", alternativas: [] };
  }

  const detalhe = [
    candidata.numeroProcesso ? `processo ${candidata.numeroProcesso}` : null,
    candidata.status ?? null,
    candidata.titular ? `titular ${candidata.titular}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const quem = `"${candidata.nome}"${detalhe ? ` (${detalhe})` : ""}`;

  if (anteriorEncerrado(candidata.status)) {
    return {
      nivel: "anterior-encerrado",
      anterior: candidata,
      titulo: "Há uma marca parecida, mas ela parece encerrada",
      texto: `A busca achou ${quem}. Pela situação, ela não está mais em vigor, então tende a não impedir o seu pedido. Confirme a situação no INPI antes de protocolar.`,
      alternativas: [],
    };
  }

  return {
    nivel: "provavel-bloqueio",
    anterior: candidata,
    titulo: "Já existe um pedido ou registro parecido no seu ramo",
    texto: `A busca achou ${quem}. No INPI vale quem deposita primeiro, e esse pedido foi feito antes do seu. A tendência é o INPI indeferir o seu pedido, e a taxa do INPI (GRU), em regra, não é devolvida (o manual só prevê devolução de taxa paga sem necessidade). Só vale seguir se houver um caminho para contornar isso.`,
    alternativas: ALTERNATIVAS,
  };
}
