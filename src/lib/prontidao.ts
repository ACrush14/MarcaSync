import { analisarEspecificacao } from "./catalogo";
import { calcularGru, type Regime } from "./gru";
import { detectarPalavraEstrangeira } from "./idioma";
import { camposEmarcas, type PedidoSalvo } from "./campos-emarcas";
import { cnpjValido, cpfValido } from "./pedido";

export type { PedidoSalvo };

/**
 * "Pronto para protocolar?": confere se os dados guardados bastam para preencher o e-Marcas
 * (Manual de Marcas do INPI, itens 3.1, 3.3, 3.4 e 3.5.2; resumo em docs/inpi-processo-de-registro.md)
 * e lista o que ainda falta, de quem é a vez e se a falta trava o protocolo.
 *
 * Tudo aqui é função pura: não fala com o banco nem com o INPI, só lê o que já foi salvo.
 */

/** O que a checagem precisa saber além do pedido. */
export interface ContextoProntidao {
  /** O nome que foi pesquisado na busca de anterioridade. */
  marca: string;
  /** Risco (0 a 100) da marca mais parecida do ramo, guardado na busca. */
  riscoPct: number | null;
  /** A imagem guardada no banco, se houver. */
  imagem: { ampliada: boolean; largura: number; altura: number } | null;
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
  contexto: ContextoProntidao
): Prontidao {
  const marcaDoProcesso = contexto.marca;
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

  // 3) Marca parecida e viva no ramo: a tendência é o INPI indeferir
  if ((contexto.riscoPct ?? 0) >= 60) {
    add({
      id: "anterioridade",
      titulo: "Marca anterior parecida no ramo",
      estado: "atencao",
      quem: "voce",
      detalhe: `A busca achou marca parecida no ramo (risco ${contexto.riscoPct}%). ${
        d.cienteAnterioridade
          ? "O cliente viu o aviso."
          : "O cliente NÃO registrou ter visto o aviso."
      } Antes de emitir a GRU, confirme a situação da marca anterior e se há caminho (outro nome, precedência do art. 129 § 1º, caducidade): a taxa em regra não é devolvida.`,
    });
  }

  // 4) Especificação: itens da lista pré-aprovada (GRU 389) ou texto livre (GRU 394)
  const analise = analisarEspecificacao(d.classeNice, d.especificacaoItens);
  add({
    id: "especificacao",
    titulo: analise.todosPreAprovados
      ? "Especificação 100% na lista pré-aprovada (GRU 389)"
      : "Especificação com itens fora da lista (GRU 394)",
    estado: analise.todosPreAprovados ? "ok" : "atencao",
    quem: analise.todosPreAprovados ? "ninguem" : "voce",
    detalhe: analise.todosPreAprovados
      ? "Todos os itens constam da lista oficial da classe. Na tela do e-Marcas, selecione os mesmos itens."
      : `Fora da lista: ${analise.livres.join("; ")}. Com itens livres o pedido vai pelo serviço 394 (mais caro). Se o cliente trocar por termos da lista, volta ao 389. A especificação não muda depois do protocolo.`,
  });

  // 5) Valor da GRU bate com a regra de desconto e com o tipo de especificação
  const esperado = calcularGru(
    d.regime as Regime,
    d.participaEmpresaDoRamo,
    !analise.todosPreAprovados
  );
  const gruBate = esperado.centavos === d.gruCentavos && esperado.comDesconto === d.gruComDesconto;
  add({
    id: "gru-valor",
    titulo: "Valor da GRU conforme o desconto e o tipo de especificação",
    estado: gruBate ? "ok" : "pendente",
    quem: gruBate ? "ninguem" : "voce",
    detalhe: gruBate
      ? "O valor guardado segue a regra de desconto do porte e o serviço (389 ou 394)."
      : "O valor guardado não bate com a regra atual. Recalcule antes de emitir a GRU: valor errado vira exigência.",
  });

  // 6) Palavra estrangeira: o cliente respondeu; a heurística confere
  if (d.apresentacao !== "figurativa") {
    const suspeita = detectarPalavraEstrangeira(d.elementoNominativo ?? "");
    if (d.palavraEstrangeira) {
      const tem = !!d.traducao && d.traducao.trim() !== "";
      add({
        id: "traducao",
        titulo: "Tradução de palavra estrangeira",
        estado: tem ? "ok" : "pendente",
        quem: tem ? "ninguem" : "cliente",
        detalhe: tem
          ? `Tradução informada: ${d.traducao}.`
          : "O cliente disse que há palavra estrangeira, mas não informou a tradução.",
      });
    } else if (suspeita.suspeita) {
      add({
        id: "traducao",
        titulo: "Tradução de palavra estrangeira",
        estado: "atencao",
        quem: "voce",
        detalhe: `O cliente disse que não há palavra estrangeira, mas "${suspeita.palavras.join('", "')}" parece ser de outro idioma. Confirme com ele; se for, o e-Marcas exige a tradução.`,
      });
    } else {
      add({
        id: "traducao",
        titulo: "Tradução de palavra estrangeira",
        estado: "ok",
        quem: "ninguem",
        detalhe: "Sem palavra estrangeira declarada nem suspeita.",
      });
    }
  }

  // 7) Imagem: só para marca figurativa ou mista; fica guardada no banco já em JPG do INPI
  if (d.apresentacao !== "nominativa") {
    if (!contexto.imagem) {
      add({
        id: "imagem",
        titulo: "Imagem da marca em JPG",
        estado: "pendente",
        quem: "cliente",
        detalhe:
          "O cliente ainda não enviou a imagem. Ela precisa ser JPG, RGB, 300 dpi, no mínimo 945 x 945 px, até 2 MB, com uma única imagem do sinal. Colorida equivale a reivindicar as cores.",
      });
    } else if (contexto.imagem.ampliada) {
      add({
        id: "imagem",
        titulo: "Imagem da marca em JPG",
        estado: "atencao",
        quem: "voce",
        detalhe: `Guardada em ${contexto.imagem.largura} x ${contexto.imagem.altura} px, mas o original era menor e foi ampliado. Veja se está nítida; se não, peça uma imagem maior.`,
      });
    } else {
      add({
        id: "imagem",
        titulo: "Imagem da marca em JPG",
        estado: "ok",
        quem: "ninguem",
        detalhe: `Guardada em ${contexto.imagem.largura} x ${contexto.imagem.altura} px, no formato do INPI.`,
      });
    }
  }

  // 8) Aceites
  add({
    id: "aceites",
    titulo: "Declarações e consentimento",
    estado: d.aceitoEm ? "ok" : "pendente",
    quem: d.aceitoEm ? "ninguem" : "cliente",
    detalhe: d.aceitoEm
      ? "Termos, documentos do INPI, atividade (art. 128), veracidade, procuração e LGPD aceitos no formulário."
      : "Não há registro dos aceites.",
  });

  // 9) Cliente pagou o combinado (serviço e GRU), confirmado à mão
  for (const [tipo, titulo] of [
    ["setup", "Serviço MarcaSync pago"],
    ["gru", "Valor da GRU pago pelo cliente"],
  ] as const) {
    // O pagamento único (pacote) quita o serviço e a taxa de uma vez.
    const pg = pagamentos.find((p) => p.tipo === tipo || p.tipo === "pacote");
    const pago = pagamentos.some(
      (p) => (p.tipo === tipo || p.tipo === "pacote") && p.status === "confirmado"
    );
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

  // 10) Etapas que só uma pessoa logada pode fazer
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
