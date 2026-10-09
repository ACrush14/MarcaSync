import { RPI_INDEX_URL } from "./fetch-rpi";
import { SEARCH_URL } from "./busca-client";

/**
 * Healthcheck das duas integrações reais com o INPI.
 *
 * Existe porque as duas batem em canais fora do nosso controle — um deles
 * (busca em tempo real) nem é documentado publicamente, ver
 * `busca-client.ts`. Não basta checar "respondeu 200": uma API sem contrato
 * formal pode mudar de schema e continuar respondendo 200 com um corpo
 * diferente do esperado. Por isso cada checagem também valida a forma
 * mínima da resposta, não só o status HTTP — é a diferença entre descobrir
 * que quebrou pelo alerta e descobrir por um cliente reclamando.
 *
 * Uso pretendido: expor via `GET /api/health` e apontar um monitor externo
 * gratuito (UptimeRobot, Better Uptime, etc.) pra chamar essa rota a cada
 * poucos minutos, alertando por e-mail/SMS quando o status não for 200 —
 * mais barato e mais confiável do que construir infraestrutura de alerta
 * própria numa fase sem volume de clientes.
 */

export interface VerificacaoSaude {
  ok: boolean;
  latenciaMs: number;
  detalhe?: string;
}

const TIMEOUT_MS = 5000;

async function fetchComTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function motivoDoErro(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return `sem resposta em ${TIMEOUT_MS / 1000}s`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Verifica o índice público da RPI: alcançável e ainda no formato esperado. */
export async function verificarRpi(): Promise<VerificacaoSaude> {
  const inicio = Date.now();
  try {
    const res = await fetchComTimeout(RPI_INDEX_URL);
    const latenciaMs = Date.now() - inicio;
    if (!res.ok) {
      return { ok: false, latenciaMs, detalhe: `status HTTP ${res.status}` };
    }
    const html = await res.text();
    if (!/RM\d+\.zip/.test(html)) {
      return {
        ok: false,
        latenciaMs,
        detalhe:
          "respondeu 200, mas nenhum link RM<edição>.zip encontrado — schema pode ter mudado",
      };
    }
    return { ok: true, latenciaMs };
  } catch (err) {
    return { ok: false, latenciaMs: Date.now() - inicio, detalhe: motivoDoErro(err) };
  }
}

/** Verifica a busca em tempo real: alcançável e ainda no formato esperado. */
export async function verificarBusca(): Promise<VerificacaoSaude> {
  const inicio = Date.now();
  try {
    const res = await fetchComTimeout(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: {
          current: 1,
          filters: [],
          resultsPerPage: 1,
          searchTerm: "Nubank",
          sortDirection: "",
          sortField: "",
          sortList: [],
        },
        queryConfig: {
          search_fields: { mark_name: { weight: 3 } },
          result_fields: { mark_name: { raw: {} } },
        },
      }),
    });
    const latenciaMs = Date.now() - inicio;
    if (!res.ok) {
      return { ok: false, latenciaMs, detalhe: `status HTTP ${res.status}` };
    }
    const body = (await res.json()) as { results?: unknown; totalResults?: unknown };
    if (!Array.isArray(body.results) || typeof body.totalResults !== "number") {
      return {
        ok: false,
        latenciaMs,
        detalhe:
          "respondeu 200, mas o corpo não tem o formato esperado (results[]/totalResults) — schema pode ter mudado",
      };
    }
    return { ok: true, latenciaMs };
  } catch (err) {
    return { ok: false, latenciaMs: Date.now() - inicio, detalhe: motivoDoErro(err) };
  }
}
