import { REGIMES, REGIMES_PJ, type Regime } from "./gru";

/**
 * Validação dos dados do formulário "pedido de registro". Tudo aqui é função pura: roda
 * no navegador (para avisar o cliente na hora) e no servidor (que não confia no navegador).
 */

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const APRESENTACOES = ["nominativa", "figurativa", "mista"] as const;
export type Apresentacao = (typeof APRESENTACOES)[number];

export const ROTULO_APRESENTACAO: Record<Apresentacao, string> = {
  nominativa: "Nominativa (só o nome)",
  figurativa: "Figurativa (só o símbolo ou desenho)",
  mista: "Mista (nome e símbolo juntos)",
};

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/** CPF válido: 11 dígitos, não todos iguais, com os dois dígitos verificadores certos. */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tam of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += Number(d[i]) * (tam + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[tam])) return false;
  }
  return true;
}

/** CNPJ válido: 14 dígitos, não todos iguais, com os dois dígitos verificadores certos. */
export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  for (const tam of [12, 13]) {
    const pesos =
      tam === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += Number(d[i]) * (pesos[i] as number);
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    if (dv !== Number(d[tam])) return false;
  }
  return true;
}

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) && v.trim().length <= 120;
}

/** Os dados do formulário, como o navegador manda (tudo opcional até ser validado). */
export interface PedidoEntrada {
  tipoRequerente?: unknown;
  regime?: unknown;
  participaEmpresaDoRamo?: unknown;
  nome?: unknown;
  documento?: unknown;
  email?: unknown;
  cep?: unknown;
  logradouro?: unknown;
  numero?: unknown;
  complemento?: unknown;
  bairro?: unknown;
  cidade?: unknown;
  uf?: unknown;
  apresentacao?: unknown;
  elementoNominativo?: unknown;
  classeNice?: unknown;
  /** Lista de textos: os itens da especificação, um por posição. */
  especificacaoItens?: unknown;
  palavraEstrangeira?: unknown;
  traducao?: unknown;
  atividade?: unknown;
  declaracaoAtividade?: unknown;
  declaracaoVeracidade?: unknown;
  aceiteProcuracao?: unknown;
  aceiteLgpd?: unknown;
  /** Leu e aceita os Termos de uso e a Política de privacidade do MarcaSync. */
  aceiteTermos?: unknown;
  /** Leu os documentos do INPI (manual, taxas, listas) e entende como o INPI decide e cobra. */
  cienciaDocumentosInpi?: unknown;
  /** O cliente viu o aviso de marca anterior parecida (a rota decide se era obrigatório). */
  cienteAnterioridade?: unknown;
  monitoramento?: unknown;
}

export interface PedidoValidado {
  tipoRequerente: "pf" | "pj";
  regime: Regime;
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
  apresentacao: Apresentacao;
  elementoNominativo: string | null;
  classeNice: string;
  /** Os itens unidos por "; ", para mostrar e copiar. */
  especificacao: string;
  especificacaoItens: string[];
  /** true se algum item não está na lista pré-aprovada (vale a GRU 394). */
  especificacaoLivre: boolean;
  palavraEstrangeira: boolean;
  traducao: string | null;
  atividade: string;
  cienteAnterioridade: boolean;
  monitoramento: boolean;
}

export type ResultadoValidacao =
  { ok: true; dados: PedidoValidado } | { ok: false; erros: Record<string, string> };

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

/**
 * Confere o formulário inteiro e devolve os dados limpos ou um erro por campo. Em cada
 * campo a mensagem diz o que corrigir, no tom do formulário.
 *
 * Como ler: `erros` é um objeto `{ campo: mensagem }`; se estiver vazio, tudo passou.
 * `analisar` (opcional) é a conferência com a lista pré-aprovada do INPI; só o servidor a passa.
 * Os três aceites (veracidade, procuração e LGPD) e a declaração de atividade são
 * obrigatórios: sem eles o pedido não pode seguir (art. 128 da Lei 9.279/96 e LGPD).
 */
/** Separa os itens da especificação em "da lista do INPI" e "livres" (ver src/lib/catalogo.ts). */
export type Analisador = (
  classe: string,
  itens: string[]
) => { preAprovados: string[]; livres: string[]; todosPreAprovados: boolean };

export function validarPedido(entrada: PedidoEntrada, analisar?: Analisador): ResultadoValidacao {
  const erros: Record<string, string> = {};

  const tipoRequerente =
    entrada.tipoRequerente === "pj" ? "pj" : entrada.tipoRequerente === "pf" ? "pf" : null;
  if (!tipoRequerente) erros.tipoRequerente = "Escolha pessoa física ou jurídica.";

  const regime = REGIMES.find((r) => r === entrada.regime);
  if (!regime) {
    erros.regime = "Escolha como o titular se enquadra.";
  } else if (tipoRequerente === "pf" && regime !== "pessoa_natural") {
    erros.regime = 'Pessoa física é sempre "pessoa física".';
  } else if (tipoRequerente === "pj" && !REGIMES_PJ.includes(regime)) {
    erros.regime = "Escolha o porte da empresa ou entidade.";
  }

  const nome = texto(entrada.nome);
  if (nome.length < 3 || nome.length > 150) {
    erros.nome = "Informe o nome completo (ou a razão social), sem abreviações.";
  }

  const documento = somenteDigitos(typeof entrada.documento === "string" ? entrada.documento : "");
  if (tipoRequerente === "pf" && !cpfValido(documento)) erros.documento = "CPF inválido.";
  if (tipoRequerente === "pj" && !cnpjValido(documento)) erros.documento = "CNPJ inválido.";

  const email = texto(entrada.email);
  if (!emailValido(email))
    erros.email = "Informe um e-mail válido: o INPI pode entrar em contato por ele.";

  const cep = somenteDigitos(typeof entrada.cep === "string" ? entrada.cep : "");
  if (cep.length !== 8) erros.cep = "CEP com 8 números.";

  const logradouro = texto(entrada.logradouro);
  if (logradouro.length < 2 || logradouro.length > 120)
    erros.logradouro = "Informe a rua ou avenida.";
  const numero = texto(entrada.numero);
  if (numero.length < 1 || numero.length > 12) erros.numero = 'Informe o número (ou "s/n").';
  const complemento = texto(entrada.complemento) || null;
  if (complemento && complemento.length > 60)
    erros.complemento = "Complemento com até 60 caracteres.";
  const bairro = texto(entrada.bairro);
  if (bairro.length < 2 || bairro.length > 80) erros.bairro = "Informe o bairro.";
  const cidade = texto(entrada.cidade);
  if (cidade.length < 2 || cidade.length > 80) erros.cidade = "Informe a cidade.";
  const uf = texto(entrada.uf).toUpperCase();
  if (!(UFS as readonly string[]).includes(uf)) erros.uf = "Escolha o estado.";

  const apresentacao = APRESENTACOES.find((a) => a === entrada.apresentacao);
  if (!apresentacao) erros.apresentacao = "Escolha como a marca se apresenta.";

  let elementoNominativo: string | null = texto(entrada.elementoNominativo) || null;
  if (apresentacao === "figurativa") {
    elementoNominativo = null;
  } else if (apresentacao && (!elementoNominativo || elementoNominativo.length > 120)) {
    erros.elementoNominativo =
      "Informe o nome da marca, como deve ser registrado (até 120 caracteres).";
  }

  const classeBruta = texto(entrada.classeNice);
  const classeNum = /^\d{1,2}$/.test(classeBruta) ? Number(classeBruta) : NaN;
  if (!(classeNum >= 1 && classeNum <= 45)) erros.classeNice = "Escolha uma classe de 1 a 45.";

  // Especificação: uma lista de itens. Os que estão na lista pré-aprovada da classe usam a
  // GRU 389; qualquer item digitado fora da lista vira texto livre (GRU 394, mais cara).
  const itensBrutos = Array.isArray(entrada.especificacaoItens)
    ? entrada.especificacaoItens.filter((i): i is string => typeof i === "string")
    : [];
  let especificacaoItens: string[] = [];
  let especificacaoLivre = false;
  if (itensBrutos.length === 0 || itensBrutos.length > 50) {
    erros.especificacao = "Escolha de 1 a 50 produtos ou serviços.";
  } else if (itensBrutos.some((i) => texto(i).length < 3 || texto(i).length > 300)) {
    erros.especificacao = "Cada item deve ter de 3 a 300 caracteres.";
  } else if (!erros.classeNice) {
    // Sem analisador (navegador) só limpamos os itens; o servidor passa o catálogo e decide.
    const analise = analisar?.(String(classeNum), itensBrutos.map(texto));
    especificacaoItens = analise
      ? [...analise.preAprovados, ...analise.livres]
      : itensBrutos.map(texto).filter((i, n, todos) => todos.indexOf(i) === n);
    especificacaoLivre = analise ? !analise.todosPreAprovados : false;
  }
  const especificacao = especificacaoItens.join("; ");
  if (especificacao.length > 2000)
    erros.especificacao = "Especificação longa demais (até 2000 caracteres).";

  // Palavra estrangeira: o cliente responde sempre; se disser que sim, a tradução é obrigatória.
  let palavraEstrangeira = false;
  let traducao: string | null = null;
  if (typeof entrada.palavraEstrangeira !== "boolean") {
    if (apresentacao !== "figurativa") {
      erros.palavraEstrangeira = "Diga se o nome tem palavra em outro idioma.";
    }
  } else if (apresentacao !== "figurativa") {
    palavraEstrangeira = entrada.palavraEstrangeira;
    if (palavraEstrangeira) {
      traducao = texto(entrada.traducao) || null;
      if (!traducao || traducao.length < 2 || traducao.length > 200) {
        erros.traducao = "Informe a tradução da palavra (até 200 caracteres).";
      }
    }
  }

  const atividade = texto(entrada.atividade);
  if (atividade.length < 10 || atividade.length > 500) {
    erros.atividade = "Descreva a atividade que você exerce (de 10 a 500 caracteres).";
  }

  if (entrada.declaracaoAtividade !== true) {
    erros.declaracaoAtividade = "Sem essa declaração o INPI não aceita o pedido.";
  }
  if (entrada.declaracaoVeracidade !== true)
    erros.declaracaoVeracidade = "Confirme que os dados são verdadeiros.";
  if (entrada.aceiteProcuracao !== true)
    erros.aceiteProcuracao = "Precisamos da sua autorização para protocolar em seu nome.";
  if (entrada.aceiteLgpd !== true)
    erros.aceiteLgpd = "Precisamos do seu consentimento para usar os dados.";
  if (entrada.aceiteTermos !== true)
    erros.aceiteTermos = "Leia e aceite os Termos de uso e a Política de privacidade.";
  if (entrada.cienciaDocumentosInpi !== true)
    erros.cienciaDocumentosInpi = "Confirme que leu os documentos do INPI.";

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  return {
    ok: true,
    dados: {
      tipoRequerente: tipoRequerente as "pf" | "pj",
      regime: regime as Regime,
      participaEmpresaDoRamo: tipoRequerente === "pf" && entrada.participaEmpresaDoRamo === true,
      nome,
      documento,
      email,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      apresentacao: apresentacao as Apresentacao,
      elementoNominativo,
      classeNice: String(classeNum),
      especificacao,
      especificacaoItens,
      especificacaoLivre,
      palavraEstrangeira,
      traducao,
      atividade,
      cienteAnterioridade: entrada.cienteAnterioridade === true,
      monitoramento: entrada.monitoramento === true,
    },
  };
}
