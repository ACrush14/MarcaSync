import type { InferenciaNCL } from "./types";

/**
 * Inferência de Classificação de Nice (NCL) por palavra-chave.
 *
 * Cobertura deliberadamente pequena (11 classes de exemplo, de 45 reais) —
 * o objetivo é provar a mecânica ("descrição em linguagem natural → classe
 * sugerida"), não substituir a tabela oficial do INPI. Uma versão de
 * produção trocaria isto por busca vetorial/embedding contra o texto
 * completo das 45 classes e suas notas explicativas.
 */
const NCL_MAP: Array<[string[], string, string]> = [
  [["software", "sistema", "app", "aplicativo", "tecnologia", "plataforma"], "42", "Programas de computador e serviços de tecnologia"],
  [["doce", "confeitaria", "bolo", "padaria", "sobremesa", "chocolate", "doceria"], "30", "Café, cacau e produtos de padaria e confeitaria"],
  [["bebida", "suco", "refrigerante", "cerveja", "drink"], "32", "Cervejas e bebidas não alcoólicas"],
  [["roupa", "vestuario", "moda", "camiseta", "calca"], "25", "Vestuário, calçados e acessórios"],
  [["consultoria", "assessoria", "gestao", "negocios"], "35", "Publicidade e gestão de negócios"],
  [["cosmetico", "beleza", "perfume", "maquiagem"], "3", "Cosméticos e produtos de perfumaria"],
  [["academia", "fitness", "esporte", "treino"], "41", "Educação, treinamento e atividades esportivas"],
  [["movel", "moveis", "decoracao"], "20", "Móveis e produtos de decoração"],
  [["tinta", "pintura", "verniz"], "2", "Tintas e vernizes"],
  [["transporte", "logistica", "entrega"], "39", "Transporte, embalagem e armazenagem"],
  [["alimento", "comida", "organico", "alimenticio"], "29", "Carnes, alimentos processados e conservas"],
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function inferNCL(descricao: string): InferenciaNCL {
  const text = stripAccents((descricao ?? "").toLowerCase());
  for (const [keys, code, label] of NCL_MAP) {
    if (keys.some((k) => text.includes(k))) {
      return { code, label, confidence: "alta" };
    }
  }
  return {
    code: "35",
    label: "Publicidade e gestão de negócios — classe genérica, refine a descrição para maior precisão",
    confidence: "baixa",
  };
}

export const CLASS_LABELS: Record<string, string> = {
  "2": "Tintas e vernizes",
  "3": "Cosméticos e perfumaria",
  "20": "Móveis e decoração",
  "25": "Vestuário",
  "29": "Alimentos processados",
  "30": "Padaria e confeitaria",
  "32": "Bebidas não alcoólicas",
  "35": "Publicidade e gestão",
  "39": "Transporte e logística",
  "41": "Educação e esporte",
  "42": "Tecnologia e software",
};
