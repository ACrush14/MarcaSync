/**
 * Os documentos que o cliente precisa ter visto antes de pagar: os do MarcaSync e os oficiais do
 * INPI. Os endereços do INPI são os dos arquivos oficiais que usamos para montar o serviço
 * (docs/inpi-referencias.md); se o INPI mudar um link, é aqui que se corrige.
 */
export interface Documento {
  rotulo: string;
  url: string;
  externo: boolean;
}

export const DOCUMENTOS_MARCASYNC: Documento[] = [
  { rotulo: "Termos de uso", url: "/termos", externo: false },
  { rotulo: "Política de privacidade", url: "/privacidade", externo: false },
];

export const DOCUMENTOS_INPI: Documento[] = [
  {
    rotulo: "Manual de Marcas do INPI",
    url: "https://manualdemarcas.inpi.gov.br/",
    externo: true,
  },
  {
    rotulo: "Tabela de Retribuições (as taxas do INPI)",
    url: "https://www.gov.br/inpi/pt-br/servicos/precificacao-dos-servicos/tabela-de-retribuicoes-inpi_portaria-mdic-no110_2025-e-portaria-inpi-no-10_2025.pdf",
    externo: true,
  },
  {
    rotulo: "Classificação de produtos e serviços (listas de Nice)",
    url: "https://www.gov.br/inpi/pt-br/servicos/marcas/classificacao-marcas",
    externo: true,
  },
  {
    rotulo: "Lei da Propriedade Industrial (Lei 9.279/96)",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l9279.htm",
    externo: true,
  },
];
