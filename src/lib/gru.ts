/**
 * Taxa do INPI (a GRU) para o pedido de registro de marca.
 *
 * Fonte: Tabela de Retribuições do INPI (Portaria GM/MDIC nº 110/2025 e Portaria
 * INPI/PR nº 10/2025), serviço 389 ("pedido de registro de marca com especificação
 * pré-aprovada, valor por classe"). A tabela mostra "360,00 / 880,00" e a nota diz que o
 * serviço mudou em 20/09/2025; a leitura adotada é "valor anterior / valor vigente".
 * Isso NÃO foi confirmado na tela de emissão da GRU: antes de usar este valor para cobrar,
 * confira lá e ajuste a constante se for preciso.
 *
 * O desconto de 50% (nota "*" da tabela) vale para pessoa natural (só se não tiver
 * participação em empresa do ramo a que pertence o item a ser registrado), microempresa,
 * microempreendedor individual, empresa de pequeno porte e entidades sem fins lucrativos.
 * (Há também desconto de 100% para pessoa física hipossuficiente ou com deficiência, que
 * este cálculo não cobre: nesses casos o valor é combinado à mão.)
 */
export const GRU_PEDIDO_CENTAVOS = 88_000;
/**
 * Serviço 394 (especificação de livre preenchimento): a mesma tabela mostra "420,00 / 1.720,00",
 * lido do mesmo jeito (valor anterior / valor vigente). Vale quando algum item da especificação
 * NÃO está na lista pré-aprovada do INPI. Também não confirmado na tela de emissão da GRU.
 */
export const GRU_PEDIDO_LIVRE_CENTAVOS = 172_000;
export const GRU_DESCONTO_PCT = 50;

export const REGIMES = [
  "pessoa_natural",
  "mei",
  "microempresa",
  "empresa_pequeno_porte",
  "empresa_simples_inovacao",
  "ict",
  "sem_fins_lucrativos",
  "orgao_publico",
  "cooperativa",
  "outra_empresa",
] as const;

export type Regime = (typeof REGIMES)[number];

export const ROTULO_REGIME: Record<Regime, string> = {
  pessoa_natural: "Pessoa física",
  mei: "MEI (microempreendedor individual)",
  microempresa: "Microempresa (ME)",
  empresa_pequeno_porte: "Empresa de pequeno porte (EPP)",
  empresa_simples_inovacao: "Empresa simples de inovação",
  ict: "Instituição científica, tecnológica e de inovação (ICT)",
  sem_fins_lucrativos: "Associação ou sociedade sem fins lucrativos",
  orgao_publico: "Órgão público",
  cooperativa: "Cooperativa",
  outra_empresa: "Outra pessoa jurídica (sem desconto)",
};

/**
 * Como a opção se chama no campo "Natureza Jurídica" do cadastro de cliente do e-INPI
 * (https://meu.inpi.gov.br/pag/cliente/form, lista lida em 23/10/2026). É esse campo que faz
 * o INPI aplicar o desconto sozinho na emissão da GRU, por isso o cadastro do cliente precisa
 * escolher exatamente esta opção.
 */
export const NATUREZA_INPI: Record<Regime, string> = {
  pessoa_natural: "Pessoa Física",
  mei: "Microempreendedor Individual - MEI",
  microempresa: "Microempresa assim definida em lei",
  empresa_pequeno_porte: "Empresa de Pequeno Porte assim definidas em lei",
  empresa_simples_inovacao: "Empresa Simples de Inovação",
  ict: "Instituições Científicas, Tecnológicas e de Inovação - ICT",
  sem_fins_lucrativos:
    "Associação com intuito não econômico (ou Sociedade com intuito não econômico)",
  orgao_publico: "Órgão Público",
  cooperativa: "Cooperativa assim definida em lei",
  outra_empresa: "Pessoa Jurídica",
};

/** Regimes de pessoa jurídica (têm CNPJ). Pessoa física é só `pessoa_natural`. */
export const REGIMES_PJ: Regime[] = REGIMES.filter((r) => r !== "pessoa_natural");

/**
 * Regimes que não têm desconto de 50%. A lista de quem tem desconto (Manual de Marcas,
 * item 1.7) não cita cooperativas nem pessoas jurídicas em geral; para cooperativa vale
 * confirmar na tela de emissão da GRU.
 */
const SEM_DESCONTO: Regime[] = ["outra_empresa", "cooperativa"];

export interface ResultadoGru {
  centavos: number;
  comDesconto: boolean;
}

/**
 * Quanto o cliente paga de GRU por um pedido (uma classe).
 *
 * Como ler a regra: pessoa natural só tem desconto se NÃO tiver participação em empresa
 * do ramo (`participaEmpresaDoRamo` falso). Os regimes de empresa com desconto (MEI, ME,
 * EPP, empresa simples de inovação, ICT, sem fins lucrativos e órgão público) o têm sempre;
 * "outra empresa" e cooperativa nunca. O desconto é arredondado
 * para baixo em centavos inteiros, para nunca cobrar a mais por arredondamento. Com
 * `especificacaoLivre` verdadeiro (algum item fora da lista do INPI) vale o serviço 394, bem mais caro.
 */
export function calcularGru(
  regime: Regime,
  participaEmpresaDoRamo: boolean,
  especificacaoLivre = false
): ResultadoGru {
  const cheio = especificacaoLivre ? GRU_PEDIDO_LIVRE_CENTAVOS : GRU_PEDIDO_CENTAVOS;
  const comDesconto =
    regime === "pessoa_natural" ? !participaEmpresaDoRamo : !SEM_DESCONTO.includes(regime);
  const centavos = comDesconto ? Math.floor((cheio * (100 - GRU_DESCONTO_PCT)) / 100) : cheio;
  return { centavos, comDesconto };
}
