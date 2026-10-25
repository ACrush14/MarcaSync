import { segredoConfere } from "./segredo";

export { segredoConfere };

/**
 * Cliente mínimo da API v2 do AbacatePay para cobrar por Pix e estornar.
 * Documentação: https://docs.abacatepay.com (Checkout Transparente > PIX).
 *
 * A chave da API fica só no servidor (variável ABACATEPAY_API_KEY) e nunca é registrada em log.
 * Em modo de teste (chave "abc_dev_...") nenhuma cobrança move dinheiro de verdade.
 */

const BASE = "https://api.abacatepay.com/v2";
const TEMPO_LIMITE_MS = 15_000;

export class ErroAbacatePay extends Error {
  constructor(
    mensagem: string,
    readonly status?: number
  ) {
    super(mensagem);
    this.name = "ErroAbacatePay";
  }
}

/** Status que o AbacatePay devolve para uma cobrança Pix. */
export type StatusProvedor =
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "CANCELLED"
  | "UNDER_DISPUTE"
  | "REFUNDED"
  | "REDEEMED"
  | "APPROVED"
  | "FAILED";

/** Status de um `Pagamento` no nosso banco. */
export type StatusPagamento = "pendente" | "confirmado" | "estornado" | "expirado";

/**
 * Traduz o status do AbacatePay para o nosso. Como ler: PAID vira confirmado; REFUNDED vira
 * estornado; EXPIRED, CANCELLED e FAILED viram expirado (o QR code não vale mais); o resto
 * (inclusive uma disputa) continua pendente para ninguém ser tratado como pago por engano.
 */
export function statusDoPagamento(status: string): StatusPagamento {
  if (status === "PAID") return "confirmado";
  if (status === "REFUNDED") return "estornado";
  if (status === "EXPIRED" || status === "CANCELLED" || status === "FAILED") return "expirado";
  return "pendente";
}

/**
 * Acha os ids de cobrança (checkout "bill_..." ou Pix "pix_char_...") em qualquer texto, como o
 * corpo de um webhook, sem repetir, na ordem em que aparecem.
 */
export function extrairIdsCobranca(texto: string): string[] {
  const ids = texto.match(/(?:bill|pix_char)_[A-Za-z0-9]+/g) ?? [];
  return [...new Set(ids)];
}

/** O primeiro id de cobrança do texto, ou null. */
export function extrairIdCobranca(texto: string): string | null {
  return extrairIdsCobranca(texto)[0] ?? null;
}

/** O id é de um checkout (a página de pagamento do AbacatePay)? */
export function ehCheckout(id: string): boolean {
  return id.startsWith("bill_");
}

function chave(): string {
  const k = process.env.ABACATEPAY_API_KEY;
  if (!k) throw new ErroAbacatePay("ABACATEPAY_API_KEY não configurada.");
  return k;
}

interface Resposta<T> {
  success?: boolean;
  data?: T;
  error?: string | null;
}

async function chamar<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<T> {
  const token = chave(); // falta de chave deve aparecer como tal, não como erro de rede
  let res: Response;
  try {
    res = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      cache: "no-store",
    });
  } catch {
    throw new ErroAbacatePay("Não consegui falar com o AbacatePay (rede ou tempo esgotado).");
  }

  let json: Resposta<T> = {};
  try {
    json = (await res.json()) as Resposta<T>;
  } catch {
    // corpo vazio ou não JSON: o status HTTP abaixo explica
  }
  if (!res.ok || json.success === false || json.data === undefined) {
    throw new ErroAbacatePay(
      typeof json.error === "string" && json.error
        ? json.error
        : `AbacatePay respondeu ${res.status}.`,
      res.status
    );
  }
  return json.data;
}

export interface CobrancaPix {
  id: string;
  status: StatusProvedor;
  valorCentavos: number;
  /** Pix copia e cola. */
  brCode: string;
  expiraEm: Date | null;
}

interface DadosCobranca {
  id: string;
  amount: number;
  status: StatusProvedor;
  brCode: string;
  expiresAt?: string | null;
}

/** Cria uma cobrança Pix. `externalId` identifica o pagamento no nosso banco. */
export async function criarCobrancaPix(entrada: {
  valorCentavos: number;
  descricao: string;
  externalId: string;
  expiraEmSegundos?: number;
  metadata?: Record<string, string>;
}): Promise<CobrancaPix> {
  const d = await chamar<DadosCobranca>("POST", "/transparents/create", {
    method: "PIX",
    data: {
      amount: entrada.valorCentavos,
      description: entrada.descricao.slice(0, 500),
      externalId: entrada.externalId,
      expiresIn: entrada.expiraEmSegundos ?? 24 * 60 * 60,
      metadata: entrada.metadata,
    },
  });
  return {
    id: d.id,
    status: d.status,
    valorCentavos: d.amount,
    brCode: d.brCode,
    expiraEm: d.expiresAt ? new Date(d.expiresAt) : null,
  };
}

/** Pergunta ao AbacatePay em que pé está uma cobrança Pix. */
export async function consultarCobranca(
  id: string
): Promise<{ id: string; status: StatusProvedor; expiraEm: Date | null }> {
  const d = await chamar<{ id: string; status: StatusProvedor; expiresAt?: string | null }>(
    "GET",
    `/transparents/check?id=${encodeURIComponent(id)}`
  );
  return { id: d.id, status: d.status, expiraEm: d.expiresAt ? new Date(d.expiresAt) : null };
}

/**
 * Estorna uma cobrança Pix PAGA, sempre pelo valor inteiro (a API não tem estorno parcial; por
 * isso serviço e GRU são cobranças separadas). O valor sai do saldo da loja.
 */
export async function estornarCobranca(
  id: string,
  motivo?: string
): Promise<{ estornoId: string; status: string }> {
  const d = await chamar<{ id: string; status: string }>("POST", "/transparents/refund", {
    id,
    ...(motivo ? { reason: motivo.slice(0, 500) } : {}),
  });
  return { estornoId: d.id, status: d.status };
}

/** Só no modo de teste: finge que o cliente pagou. Em produção a API recusa. */
export async function simularPagamento(id: string): Promise<void> {
  await chamar("POST", `/transparents/simulate-payment?id=${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------------------------
// Checkout: a página de pagamento do AbacatePay, com Pix e cartão. É assim que o pedido é pago.
// ---------------------------------------------------------------------------------------------

export interface Checkout {
  id: string;
  status: StatusProvedor;
  valorCentavos: number;
  /** Quanto já foi pago (null enquanto não foi). */
  pagoCentavos: number | null;
  /** A página para onde o cliente vai pagar. */
  url: string;
}

interface DadosCheckout {
  id: string;
  url: string;
  amount: number;
  paidAmount?: number | null;
  status: StatusProvedor;
}

const produtosPorExternalId = new Map<string, string>();

/** Procura, no AbacatePay, o id público do produto que tem este `externalId` (com cache). */
async function idDoProduto(externalId: string): Promise<string> {
  const achado = produtosPorExternalId.get(externalId);
  if (achado) return achado;
  const lista = await chamar<Array<{ id: string; externalId?: string | null; status?: string }>>(
    "GET",
    "/products/list"
  );
  for (const p of lista) {
    if (p.externalId && p.id && p.status !== "ARCHIVED") produtosPorExternalId.set(p.externalId, p.id);
  }
  const id = produtosPorExternalId.get(externalId);
  if (!id) {
    throw new ErroAbacatePay(
      `O produto ${externalId} não existe no AbacatePay. Rode scripts/criar-produtos-abacatepay.mjs com a chave deste ambiente.`
    );
  }
  return id;
}

/** Só para os testes. */
export function esquecerProdutos(): void {
  produtosPorExternalId.clear();
}

/** Os dados que o cliente já preencheu no pedido e que o AbacatePay pede na página de pagamento. */
export interface DadosDoPagador {
  nome: string;
  email: string;
  /** CPF ou CNPJ, só dígitos. */
  documento: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  /** Sigla do estado, com 2 letras. */
  uf: string;
}

/**
 * Cadastra o pagador no AbacatePay (a mesma pessoa devolve sempre o mesmo id) para que ele NÃO
 * precise digitar de novo, na página de pagamento, o que já preencheu no pedido.
 */
export async function criarPagador(d: DadosDoPagador, metadata?: Record<string, string>): Promise<string> {
  const r = await chamar<{ id: string }>("POST", "/customers/create", {
    name: d.nome,
    email: d.email,
    taxId: d.documento,
    cellphone: d.celular,
    zipCode: d.cep,
    address: {
      zipCode: d.cep,
      street: d.logradouro,
      number: d.numero,
      neighborhood: d.bairro,
      city: d.cidade,
      state: d.uf,
      ...(d.complemento ? { complement: d.complemento } : {}),
    },
    ...(metadata ? { metadata } : {}),
  });
  return r.id;
}

/**
 * Cria o checkout de um produto (o pacote serviço + taxa do INPI). O cliente paga por Pix ou
 * cartão na página que o AbacatePay devolve. O valor é o do produto: não vem do navegador.
 */
export async function criarCheckout(entrada: {
  produtoExternalId: string;
  externalId: string;
  metadata?: Record<string, string>;
  urlDeRetorno: string;
  parcelasMax: number;
  /** O pagador já cadastrado no AbacatePay (ver `criarPagador`): ele não digita os dados de novo. */
  pagadorId?: string;
}): Promise<Checkout> {
  const produto = await idDoProduto(entrada.produtoExternalId);
  const d = await chamar<DadosCheckout>("POST", "/checkouts/create", {
    items: [{ id: produto, quantity: 1 }],
    methods: ["PIX", "CARD"],
    card: { maxInstallments: entrada.parcelasMax, passFeesToCustomer: false },
    ...(entrada.pagadorId ? { customerId: entrada.pagadorId } : {}),
    externalId: entrada.externalId,
    metadata: entrada.metadata,
    returnUrl: entrada.urlDeRetorno,
    completionUrl: entrada.urlDeRetorno,
  });
  return {
    id: d.id,
    status: d.status,
    valorCentavos: d.amount,
    pagoCentavos: d.paidAmount ?? null,
    url: d.url,
  };
}

/** Pergunta ao AbacatePay em que pé está um checkout. */
export async function consultarCheckout(id: string): Promise<Checkout> {
  const d = await chamar<DadosCheckout>("GET", `/checkouts/get?id=${encodeURIComponent(id)}`);
  return {
    id: d.id,
    status: d.status,
    valorCentavos: d.amount,
    pagoCentavos: d.paidAmount ?? null,
    url: d.url,
  };
}

/** Estorna um checkout PAGO, sempre pelo valor inteiro (a API não tem estorno parcial). */
export async function estornarCheckout(
  id: string,
  motivo?: string
): Promise<{ estornoId: string; status: string }> {
  const d = await chamar<{ id: string; status: string }>("POST", "/checkouts/refund", {
    id,
    ...(motivo ? { reason: motivo.slice(0, 500) } : {}),
  });
  return { estornoId: d.id, status: d.status };
}

/** Consulta qualquer cobrança pelo id: checkout (bill_...) ou Pix do modelo antigo (pix_char_...). */
export async function consultarPagamento(
  id: string
): Promise<{ status: StatusProvedor; valorCentavos: number | null; pagoCentavos: number | null }> {
  if (ehCheckout(id)) {
    const c = await consultarCheckout(id);
    return { status: c.status, valorCentavos: c.valorCentavos, pagoCentavos: c.pagoCentavos };
  }
  const c = await consultarCobranca(id);
  return { status: c.status, valorCentavos: null, pagoCentavos: null };
}

/** Estorna qualquer cobrança paga pelo id, sempre pelo valor inteiro. */
export function estornarPorId(
  id: string,
  motivo?: string
): Promise<{ estornoId: string; status: string }> {
  return ehCheckout(id) ? estornarCheckout(id, motivo) : estornarCobranca(id, motivo);
}
