import type { MarcaBase } from "./types";

/**
 * Base de exemplo. Em produção isto é substituído pela leitura oficial dos
 * Dados Abertos do INPI (dadosabertos.inpi.gov.br) — ver README para o
 * plano de substituição. Os 14 nomes abaixo são fictícios.
 */
export const BASE_MARCAS: MarcaBase[] = [
  { name: "Casa do Doce", cls: "30" },
  { name: "Doce Sabor Nordestino", cls: "30" },
  { name: "Vita Fresca", cls: "32" },
  { name: "Nortech Sistemas", cls: "42" },
  { name: "Bella Pelle", cls: "25" },
  { name: "Flux Studio", cls: "42" },
  { name: "Selo Verde Orgânicos", cls: "29" },
  { name: "Rota Norte Transportes", cls: "39" },
  { name: "Prisma Consultoria", cls: "35" },
  { name: "Aura Cosméticos", cls: "3" },
  { name: "Zenith Fit", cls: "41" },
  { name: "Cores Vivas Tintas", cls: "2" },
  { name: "Ponto Certo Assessoria", cls: "35" },
  { name: "Raiz Nordeste Alimentos", cls: "29" },
];
