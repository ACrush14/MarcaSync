/**
 * As 45 classes da Classificação de Nice, que o INPI usa para dizer o que a marca assina.
 * Os títulos são resumos curtos dos títulos oficiais, para a pessoa se achar na lista; quem
 * decide o que cabe em cada classe é a lista de produtos e serviços do INPI.
 *
 * 1 a 34 são produtos; 35 a 45 são serviços.
 */
export const CLASSES_NICE: Record<string, string> = {
  "1": "Produtos químicos",
  "2": "Tintas, vernizes e lacas",
  "3": "Cosméticos e produtos de limpeza",
  "4": "Óleos e graxas industriais, combustíveis e velas",
  "5": "Produtos farmacêuticos e veterinários",
  "6": "Metais comuns e suas ligas",
  "7": "Máquinas e máquinas-ferramenta",
  "8": "Ferramentas manuais",
  "9": "Aparelhos científicos e eletrônicos, software",
  "10": "Aparelhos médicos",
  "11": "Iluminação, aquecimento e refrigeração",
  "12": "Veículos",
  "13": "Armas de fogo e pirotecnia",
  "14": "Joalheria, bijuterias e relógios",
  "15": "Instrumentos musicais",
  "16": "Papel, papelaria e material de escritório",
  "17": "Borracha, plásticos e isolantes",
  "18": "Couro, bolsas, malas e guarda-chuvas",
  "19": "Materiais de construção não metálicos",
  "20": "Móveis e decoração",
  "21": "Utensílios domésticos e de cozinha",
  "22": "Cordas, redes, tendas e lonas",
  "23": "Fios para uso têxtil",
  "24": "Tecidos e roupa de cama e mesa",
  "25": "Vestuário, calçados e chapelaria",
  "26": "Rendas, bordados, fitas e botões",
  "27": "Tapetes e revestimentos de piso",
  "28": "Jogos, brinquedos e artigos esportivos",
  "29": "Carnes, laticínios e alimentos processados",
  "30": "Café, padaria, confeitaria e condimentos",
  "31": "Produtos agrícolas, plantas e animais vivos",
  "32": "Cervejas e bebidas não alcoólicas",
  "33": "Bebidas alcoólicas (exceto cervejas)",
  "34": "Tabaco e artigos para fumantes",
  "35": "Publicidade e gestão de negócios",
  "36": "Seguros, finanças e serviços imobiliários",
  "37": "Construção, reparos e instalação",
  "38": "Telecomunicações",
  "39": "Transporte, armazenagem e viagens",
  "40": "Tratamento de materiais",
  "41": "Educação, entretenimento e esporte",
  "42": "Serviços científicos e tecnológicos (TI)",
  "43": "Alimentação e hospedagem (restaurantes, hotéis)",
  "44": "Serviços médicos, veterinários e de beleza",
  "45": "Serviços jurídicos e de segurança",
};

/** "30 — Café, padaria, confeitaria e condimentos". */
export function rotuloDaClasse(classe: string): string {
  const titulo = CLASSES_NICE[classe];
  return titulo ? `${classe} — ${titulo}` : classe;
}

/** As classes de produtos (1 a 34) e de serviços (35 a 45), na ordem, para a lista de escolha. */
export const CLASSES_DE_PRODUTOS = Array.from({ length: 34 }, (_, i) => String(i + 1));
export const CLASSES_DE_SERVICOS = Array.from({ length: 11 }, (_, i) => String(i + 35));
