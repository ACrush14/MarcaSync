import { calcularGru, type Regime } from "./gru";
import { cnpjValido, cpfValido, ROTULO_APRESENTACAO, type Apresentacao } from "./pedido";

/**
 * "Pronto para protocolar?": confere se os dados guardados bastam para preencher o e-Marcas
 * (Manual de Marcas do INPI, itens 3.1, 3.3, 3.4 e 3.5.2; resumo em docs/inpi-processo-de-registro.md)
 * e lista o que ainda falta, de quem é a vez e se a falta trava o protocolo.
 *
 * Tudo aqui é função pura: não fala com o banco nem com o INPI, só lê o que já foi salvo.
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
  atividade: string;
  gruCentavos: number;
  gruComDesconto: boolean;
  aceitoEm: string | Date | null;
}

export interface PagamentoSalvo {
  tipo: string;
  status: string;
}

export type EstadoItem = "ok" | "pendente" | "atencao";

export interface ItemProntidao {
  id: string;
  titulo: string;
  estado: EstadoItem;
  /** Quem precisa agir: o cliente, você (operador) ou ninguém. */
  quem: "cliente" | "voce" | "ninguem";
  detalhe: string;
}

export interface Prontidao {
  itens: ItemProntidao[];
  /** true só quando todos os itens estão "ok". */
  pronto: boolean;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Os campos na ordem em que o e-Marcas os pede. Serve para a tela do admin e para provar,
 * em teste, que nenhum campo obrigatório ficou vazio. `null` no valor significa "não se
 * aplica a este pedido" (por exemplo, nome da marca numa marca figurativa).
 */
export function camposEmarcas(d: PedidoSalvo): Array<[string, string | null]> {
  return [
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
    ["Classe de Nice", d.classeNice],
    ["Especificação", d.especificacao],
    ["Declaração de atividade", d.atividade],
  ];
}

/**
 * Monta a checklist. Como ler: cada item é uma pergunta do tipo "isso está resolvido?".
 * `ok` = sim; `pendente` = não, e trava o protocolo; `atencao` = o sistema não consegue
 * saber, então alguém precisa olhar. `pronto` só é verdadeiro se tudo estiver `ok`.
 *
 * Os itens manuais (cadastro no e-INPI, emitir e pagar a GRU, procuração assinada, imagem da
 * marca) começam sempre `pendente`: o site ainda não os automatiza, e fingir que estão
 * resolvidos faria você protocolar errado.
 */
export function checarProntidao(
  d: PedidoSalvo,
  pagamentos: PagamentoSalvo[],
  marcaDoProcesso: string
): Prontidao {
  const itens: ItemProntidao[] = [];
  const add = (i: ItemProntidao) => itens.push(i);

  // 1) Dados completos e documento válido
  const vazios = camposEmarcas(d)
    .filter(([, v]) => v !== null && v.trim() === "")
    .map(([rotulo]) => rotulo);
  const docOk = d.tipoRequerente === "pj" ? cnpjValido(d.documento) : cpfValido(d.documento);
  if (vazios.length > 0 || !docOk) {
    add({
      id: "dados",
      titulo: "Dados do titular e da marca",
      estado: "pendente",
      quem: "cliente",
      detalhe:
        vazios.length > 0
          ? `Faltam: ${vazios.join(", ")}.`
          : "O CPF/CNPJ guardado não passa na conferência dos dígitos.",
    });
  } else {
    add({
      id: "dados",
      titulo: "Dados do titular e da marca",
      estado: "ok",
      quem: "ninguem",
      detalhe: "Todos os campos do e-Marcas estão preenchidos.",
    });
  }

  // 2) Nome digitado confere com o nome pesquisado
  if (d.apresentacao !== "figurativa" && d.elementoNominativo) {
    const igual = semAcento(d.elementoNominativo) === semAcento(marcaDoProcesso);
    add({
      id: "nome-confere",
      titulo: "Nome da marca igual ao pesquisado",
      estado: igual ? "ok" : "atencao",
      quem: igual ? "ninguem" : "voce",
      detalhe: igual
        ? "O nome do pedido é o mesmo que passou pela busca de anterioridade."
        : `A busca foi feita com "${marcaDoProcesso}", mas o pedido diz "${d.elementoNominativo}". Se for outra grafia, refaça a busca antes de protocolar.`,
    });
  }

  // 3) Valor da GRU bate com a regra de desconto
  const esperado = calcularGru(d.regime as Regime, d.participaEmpresaDoRamo);
  const gruBate = esperado.centavos === d.gruCentavos && esperado.comDesconto === d.gruComDesconto;
  add({
    id: "gru-valor",
    titulo: "Valor da GRU conforme o desconto",
    estado: gruBate ? "ok" : "pendente",
    quem: gruBate ? "ninguem" : "voce",
    detalhe: gruBate
      ? "O valor guardado segue a regra de desconto do porte informado."
      : "O valor guardado não bate com a regra atual. Recalcule antes de emitir a GRU: o desconto errado vira exigência.",
  });

  // 4) Especificação: só o 389 exige item pré-aprovado, e o sistema não tem essa lista ainda
  add({
    id: "especificacao",
    titulo: "Especificação dentro da lista do INPI",
    estado: "atencao",
    quem: "voce",
    detalhe:
      "Confira se os itens estão na lista pré-aprovada da classe (GRU 389). Se não estiverem, use a GRU 394, que aceita texto livre. A especificação não muda depois do protocolo.",
  });

  // 5) Palavra estrangeira exige tradução; o site não sabe detectar
  if (d.apresentacao !== "figurativa") {
    add({
      id: "traducao",
      titulo: "Tradução de palavra estrangeira",
      estado: "atencao",
      quem: "voce",
      detalhe: "Se o nome tiver palavra em outro idioma, o e-Marcas pede a tradução.",
    });
  }

  // 6) Imagem: só para marca figurativa ou mista, e o site ainda não recebe o arquivo
  if (d.apresentacao !== "nominativa") {
    add({
      id: "imagem",
      titulo: "Imagem da marca em JPG",
      estado: "pendente",
      quem: "cliente",
      detalhe:
        "Peça o logo e converta para JPG, no mínimo 945 x 945 px, 300 dpi, RGB, até 2 MB, com uma única imagem do sinal. Colorida equivale a reivindicar as cores.",
    });
  }

  // 7) Aceites
  add({
    id: "aceites",
    titulo: "Declarações e consentimento",
    estado: d.aceitoEm ? "ok" : "pendente",
    quem: d.aceitoEm ? "ninguem" : "cliente",
    detalhe: d.aceitoEm
      ? "Atividade (art. 128), veracidade, procuração e LGPD aceitas no formulário."
      : "Não há registro dos aceites.",
  });

  // 8) Cliente pagou o combinado (serviço e GRU), confirmado à mão
  for (const [tipo, titulo] of [
    ["setup", "Serviço MarcaSync pago"],
    ["gru", "Valor da GRU pago pelo cliente"],
  ] as const) {
    const pg = pagamentos.find((p) => p.tipo === tipo);
    const pago = pg?.status === "confirmado";
    add({
      id: `pagamento-${tipo}`,
      titulo,
      estado: pago ? "ok" : "pendente",
      quem: pago ? "ninguem" : "cliente",
      detalhe: pago
        ? "Pagamento confirmado."
        : pg
          ? "Cobrança criada, ainda não confirmada."
          : "Não há cobrança registrada.",
    });
  }

  // 9) Etapas que só uma pessoa logada pode fazer
  add({
    id: "procuracao",
    titulo: "Procuração assinada",
    estado: "pendente",
    quem: "cliente",
    detalhe:
      "Entra no primeiro ato ou em até 60 dias do protocolo; sem ela o pedido é arquivado (art. 216, §2º).",
  });
  add({
    id: "einpi",
    titulo: "Cadastro do titular no e-INPI",
    estado: "pendente",
    quem: "voce",
    detalhe: "Cada requerente tem o seu cadastro (um por CPF/CNPJ). O cliente não passa senha.",
  });
  add({
    id: "gru-inpi",
    titulo: "GRU emitida e paga no e-INPI (conciliada)",
    estado: "pendente",
    quem: "voce",
    detalhe:
      "Só o requerente ou o procurador logado emite. Confira o valor na tela; o pagamento precisa estar conciliado antes de enviar o formulário.",
  });

  return { itens, pronto: itens.every((i) => i.estado === "ok") };
}
