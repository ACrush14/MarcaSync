import { NATUREZA_INPI, type Regime } from "./gru";
import { ROTULO_APRESENTACAO, type Apresentacao } from "./pedido";

/**
 * Os campos do pedido de registro na ordem em que o e-Marcas os pede (Manual de Marcas do
 * INPI, itens 3.1 e 3.5.2). Fica separado da checklist para a tela do admin usar sem trazer
 * o catálogo de termos do INPI (que é grande) para o navegador.
 */

/** Os dados do pedido como ficam no banco (só o que a checagem usa). */
export interface PedidoSalvo {
  tipoRequerente: string;
  regime: string;
  participaEmpresaDoRamo: boolean;
  nome: string;
  documento: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  apresentacao: string;
  elementoNominativo: string | null;
  classeNice: string;
  especificacao: string;
  especificacaoItens: string[];
  especificacaoLivre: boolean;
  palavraEstrangeira: boolean;
  traducao: string | null;
  cienteAnterioridade: boolean;
  atividade: string;
  gruCentavos: number;
  gruComDesconto: boolean;
  aceitoEm: string | Date | null;
}

/**
 * Os campos na ordem em que o e-Marcas os pede. Serve para a tela do admin e para provar,
 * em teste, que nenhum campo obrigatório ficou vazio. `null` no valor significa "não se
 * aplica a este pedido" (por exemplo, nome da marca numa marca figurativa).
 */
export function camposEmarcas(d: PedidoSalvo): Array<[string, string | null]> {
  return [
    ["Natureza jurídica (e-INPI)", NATUREZA_INPI[d.regime as Regime] ?? d.regime],
    ["Titular (nome ou razão social)", d.nome],
    ["CPF/CNPJ", d.documento],
    ["E-mail", d.email],
    ["CEP", d.cep],
    ["Logradouro", d.logradouro],
    ["Número", d.numero],
    ["Bairro", d.bairro],
    ["Cidade", d.cidade],
    ["UF", d.uf],
    ["Apresentação", ROTULO_APRESENTACAO[d.apresentacao as Apresentacao] ?? d.apresentacao],
    ["Natureza", "Produto ou serviço"],
    ["Elemento nominativo", d.apresentacao === "figurativa" ? null : d.elementoNominativo],
    [
      "Tradução da palavra estrangeira",
      d.apresentacao === "figurativa"
        ? null
        : d.palavraEstrangeira
          ? (d.traducao ?? "")
          : "Não há palavra estrangeira",
    ],
    ["Classe de Nice", d.classeNice],
    ["Especificação", d.especificacao],
    ["Declaração de atividade", d.atividade],
  ];
}
