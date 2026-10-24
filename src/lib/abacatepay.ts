import { createHash, timingSafeEqual } from "node:crypto";

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

/** Acha o id de uma cobrança Pix (pix_char_...) em qualquer texto, como o corpo de um webhook. */
export function extrairIdCobranca(texto: string): string | null {
  return /pix_char_[A-Za-z0-9]+/.exec(texto)?.[0] ?? null;
}

/**
 * Compara o segredo recebido com o esperado sem vazar nada pelo tempo de resposta. As duas
 * pontas viram um hash do mesmo tamanho antes de comparar, para a comparação ser sempre segura.
 */
export function segredoConfere(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
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
