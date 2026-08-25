/**
 * Tipos do XML oficial da RPI — Seção V (Marcas).
 *
 * Validado contra um arquivo real (edição 2903, 25/08/2026) lido byte a byte:
 * o schema abaixo reflete o que foi observado na prática, não apenas o que o
 * "Manual do Usuário — layout .xml da RPI Marcas" descreve (há divergências
 * pontuais entre os dois — ver README, seção "Fonte de dados").
 */

export interface RpiDespacho {
  /** Código IPAS do despacho, ex.: "IPAS161". */
  codigo: string;
  /** Descrição textual oficial do despacho. */
  nome: string;
}

export interface RpiTitular {
  nomeRazaoSocial: string;
  pais: string | null;
  uf: string | null;
}

export interface RpiProcesso {
  /** Número do processo administrativo (9 dígitos). */
  numero: string;
  despachos: RpiDespacho[];
  titulares: RpiTitular[];
}

export interface RpiEdicao {
  numero: number;
  dataPublicacao: string | null;
  totalProcessos: number;
  processos: RpiProcesso[];
}
