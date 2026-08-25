/**
 * Tipos da busca em tempo real de marcas do INPI.
 *
 * Contrato confirmado ao vivo em 25/08/2026 batendo diretamente em
 * `POST https://api-servicos.busca.inpi.gov.br/api/trademarks/search` — ver
 * `busca-client.ts` para o payload exato e as ressalvas de risco. Formato de
 * resposta é o padrão Elastic App Search / Search UI: cada campo devolvido
 * vem embrulhado em `{ raw: valor }`.
 */

export interface TitularBusca {
  nome: string;
  cnpj: string | null;
  tipoPessoa: string | null;
}

export interface ResultadoBusca {
  id: string;
  marca: string;
  numeroProcesso: string;
  status: string;
  classificacao: string | null;
  dataDeposito: string | null;
  natureza: string | null;
  apresentacao: string | null;
  titulares: TitularBusca[];
}

export interface BuscaMarcasResposta {
  termo: string;
  pagina: number;
  totalPaginas: number;
  totalResultados: number;
  resultados: ResultadoBusca[];
}

/** Formato bruto de cada campo na resposta do upstream: sempre `{ raw: valor }`. */
export interface CampoBruto<T> {
  raw: T | null;
}

export interface TitularBruto {
  name?: string;
  cnpj?: string;
  person_type?: string;
}

export interface ResultadoBruto {
  id?: CampoBruto<string>;
  mark_name?: CampoBruto<string>;
  process_number?: CampoBruto<string>;
  status?: CampoBruto<string>;
  classification_code?: CampoBruto<string>;
  filing_date?: CampoBruto<string>;
  nature_text?: CampoBruto<string>;
  presentation_text?: CampoBruto<string>;
  holders?: CampoBruto<TitularBruto[]>;
}

export interface RespostaBruta {
  facets?: unknown;
  results?: ResultadoBruto[];
  totalPages?: number;
  totalResults?: number;
}
