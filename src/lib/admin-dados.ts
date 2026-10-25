/**
 * Funções puras do painel /admin: formatar datas, procurar, ordenar e montar as linhas de dados que
 * cada cartão mostra. Ficam fora do componente para serem testadas.
 */
import { NATUREZA_INPI, ROTULO_REGIME, type Regime } from "./gru";
import { precisaContatar } from "./acompanhamento";

const FUSO = "America/Fortaleza";

function comoData(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "24/10/2026 15:30", no horário do Brasil (Fortaleza). "—" quando não há data. */
export function fmtDataHora(v: Date | string | null | undefined): string {
  const d = comoData(v);
  if (!d) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "24/10/2026" de uma data guardada ao meio-dia UTC (como "próximo contato"). */
export function fmtDia(v: Date | string | null | undefined): string {
  const d = comoData(v);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** O dia do calendário no Brasil (UTC-3), em milissegundos, para contar dias de calendário. */
function diaNoBrasil(d: Date): number {
  const br = new Date(d.getTime() - 3 * 3_600_000);
  return Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate());
}

/** "há 3 dias", "hoje", "ontem": para bater o olho. Conta dias de calendário no Brasil. */
export function haQuanto(v: Date | string | null | undefined, agora: Date = new Date()): string {
  const d = comoData(v);
  if (!d) return "";
  const dias = Math.round((diaNoBrasil(agora) - diaNoBrasil(d)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

export interface ItemDeBusca {
  id: string;
  marca: string;
  numeroProcesso: string | null;
  anotacoes?: string | null;
  cliente: { nome: string; whatsapp: string; email?: string | null };
  pedidoRegistro: { nome: string; documento: string; email: string } | null;
}

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * O processo combina com o que foi digitado? Procura no nome, na marca, no WhatsApp, no e-mail, no
 * CPF/CNPJ, no número do INPI, nas anotações e no final do código. Sem acento e sem diferença entre
 * maiúsculas e minúsculas; números ignoram máscara. Todas as palavras digitadas precisam aparecer.
 */
export function buscaCombina(p: ItemDeBusca, termo: string): boolean {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const texto = semAcento(
    [
      p.cliente.nome,
      p.marca,
      p.cliente.email ?? "",
      p.pedidoRegistro?.nome ?? "",
      p.pedidoRegistro?.email ?? "",
      p.anotacoes ?? "",
      p.id.slice(-6),
    ].join(" ")
  );
  const campos = [p.cliente.whatsapp, p.numeroProcesso ?? "", p.pedidoRegistro?.documento ?? ""].map(
    (c) => c.replace(/\D/g, "")
  );
  return palavras.every((w) => {
    if (texto.includes(w)) return true;
    // Número digitado com ou sem máscara: compara só os dígitos (a partir de 3, para não casar à toa).
    // Com parênteses, como em "(85)", é o DDD: aceita 2 dígitos.
    const so = w.replace(/\D/g, "");
    const minimo = /[()]/.test(w) ? 2 : 3;
    return so.length >= minimo && campos.some((c) => c.includes(so));
  });
}

export type Ordem = "recentes" | "atividade" | "proximo_contato" | "marca";

export const ROTULO_ORDEM: Record<Ordem, string> = {
  recentes: "Mais recentes (quando deixou o contato)",
  atividade: "Atividade mais recente",
  proximo_contato: "Próximo contato (mais urgente primeiro)",
  marca: "Marca (A a Z)",
};

export interface ItemDeOrdem {
  marca: string;
  createdAt: string;
  updatedAt?: string;
  proximoContatoEm: string | null;
}

/** Devolve uma cópia ordenada; nunca altera a lista original. */
export function ordenar<T extends ItemDeOrdem>(lista: readonly T[], ordem: Ordem): T[] {
  const tempo = (v: string | null | undefined, vazio: number) => {
    const d = comoData(v);
    return d ? d.getTime() : vazio;
  };
  const copia = [...lista];
  switch (ordem) {
    case "recentes":
      return copia.sort((a, b) => tempo(b.createdAt, 0) - tempo(a.createdAt, 0));
    case "atividade":
      return copia.sort(
        (a, b) => tempo(b.updatedAt ?? b.createdAt, 0) - tempo(a.updatedAt ?? a.createdAt, 0)
      );
    case "proximo_contato":
      // Sem data vai para o fim; com data, a mais antiga (mais atrasada) primeiro.
      return copia.sort(
        (a, b) =>
          tempo(a.proximoContatoEm, Number.MAX_SAFE_INTEGER) -
          tempo(b.proximoContatoEm, Number.MAX_SAFE_INTEGER)
      );
    case "marca":
      return copia.sort((a, b) => a.marca.localeCompare(b.marca, "pt-BR", { sensitivity: "base" }));
  }
}

export interface PagamentoResumo {
  tipo: string;
  status: string;
  confirmadoEm: string | null;
}

export type SituacaoDoPagamento = "pago" | "aguardando" | "estornado" | "sem_cobranca";

/** Um rótulo só para o estado do pagamento do pedido (o pacote, ou o serviço e a taxa do modelo antigo). */
export function situacaoDoPagamento(pagamentos: readonly PagamentoResumo[]): SituacaoDoPagamento {
  const principais = pagamentos.filter((p) => ["pacote", "setup", "gru"].includes(p.tipo));
  if (principais.length === 0) return "sem_cobranca";
  if (principais.some((p) => p.status === "estornado")) return "estornado";
  if (principais.every((p) => p.status === "confirmado")) return "pago";
  return "aguardando";
}

export const ROTULO_PAGAMENTO_RESUMO: Record<SituacaoDoPagamento, string> = {
  pago: "pago",
  aguardando: "aguardando pagamento",
  estornado: "estornado",
  sem_cobranca: "sem cobrança",
};

export interface DadosDeData {
  createdAt: string;
  updatedAt?: string;
  cliente: { createdAt?: string };
  pedidoRegistro: { aceitoEm: string; updatedAt?: string } | null;
  pagamentos: readonly PagamentoResumo[];
  gruPagaInpiEm?: string | null;
  protocoladoEm: string | null;
  ultimoContatoEm: string | null;
  proximoContatoEm: string | null;
  situacaoVerificadaEm?: string | null;
  rpiVerificadaEm?: string | null;
}

/** Todas as datas que existem sobre a pessoa, na ordem em que as coisas acontecem. */
export function linhasDeDatas(p: DadosDeData, agora: Date = new Date()): Array<[string, string]> {
  const primeiroPagamento = p.pagamentos
    .map((g) => comoData(g.confirmadoEm))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const comTempo = (v: string | null | undefined) => {
    const t = fmtDataHora(v);
    return t === "—" ? t : `${t} (${haQuanto(v, agora)})`;
  };
  return [
    ["Deixou o contato", comTempo(p.createdAt)],
    ["Cliente no cadastro desde", comTempo(p.cliente.createdAt)],
    ["Última atividade", comTempo(p.updatedAt ?? p.createdAt)],
    ["Enviou os dados do pedido (aceites)", comTempo(p.pedidoRegistro?.aceitoEm)],
    ["Pagamento confirmado", primeiroPagamento ? comTempo(primeiroPagamento.toISOString()) : "—"],
    ["Taxa paga ao INPI", comTempo(p.gruPagaInpiEm)],
    ["Pedido protocolado", comTempo(p.protocoladoEm)],
    ["Seu último contato", comTempo(p.ultimoContatoEm)],
    ["Próximo contato combinado", fmtDia(p.proximoContatoEm)],
    ["Situação no INPI vista em", comTempo(p.situacaoVerificadaEm)],
    ["RPI lida (por este processo) em", comTempo(p.rpiVerificadaEm)],
  ];
}

export interface DadosDoTitular {
  tipoRequerente: string;
  regime: string;
  participaEmpresaDoRamo: boolean;
}

const REGIMES_CONHECIDOS = Object.keys(ROTULO_REGIME);

/**
 * O que o e-INPI precisa saber do titular antes da GRU: se é pessoa física ou jurídica, em que
 * enquadramento (que define o desconto) e qual opção escolher em "Natureza Jurídica" no cadastro.
 */
export function linhasDoTitular(d: DadosDoTitular): Array<[string, string]> {
  const conhecido = REGIMES_CONHECIDOS.includes(d.regime);
  const regime = d.regime as Regime;
  return [
    ["Tipo de requerente", d.tipoRequerente === "pj" ? "Pessoa jurídica (CNPJ)" : "Pessoa física (CPF)"],
    ["Enquadramento (define o desconto da GRU)", conhecido ? ROTULO_REGIME[regime] : d.regime],
    [
      "Natureza Jurídica a escolher no cadastro do e-INPI",
      conhecido ? NATUREZA_INPI[regime] : "— (enquadramento desconhecido)",
    ],
    [
      "Tem sociedade em empresa do ramo",
      d.tipoRequerente === "pj" ? "— (só vale para pessoa física)" : d.participaEmpresaDoRamo ? "Sim (sem desconto)" : "Não",
    ],
  ];
}

/** O processo precisa de contato hoje? Mesma regra do filtro "Falar hoje". */
export function precisaDeContatoHoje(
  p: { interesse: string; proximoContatoEm: string | null; ultimoContatoEm: string | null; anotacoes: string | null },
  jaPagou: boolean,
  agora: Date = new Date()
): boolean {
  return precisaContatar(p, agora, jaPagou);
}

/** CPF (11 dígitos) ou CNPJ (14) com máscara, só para ler na tela. */
export function fmtDocumento(d: string): string {
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return d;
}

/** O endereço do titular numa linha só, como se escreve numa carta. */
export function fmtEndereco(d: {
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}): string {
  const rua = [d.logradouro, d.numero].filter(Boolean).join(", ");
  const compl = d.complemento ? ` (${d.complemento})` : "";
  const cep = d.cep.length === 8 ? `${d.cep.slice(0, 5)}-${d.cep.slice(5)}` : d.cep;
  return `${rua}${compl}, ${d.bairro}, ${d.cidade}/${d.uf}, CEP ${cep}`;
}
