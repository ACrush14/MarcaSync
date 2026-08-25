import type {
  BuscaMarcasResposta,
  RespostaBruta,
  ResultadoBruto,
  ResultadoBusca,
} from "./busca-types";

/**
 * Cliente para a busca em tempo real de marcas do INPI.
 *
 * ATENÇÃO — API não documentada publicamente. O contrato abaixo foi obtido
 * por engenharia reversa (reprodução da chamada que o próprio portal
 * `servicos.busca.inpi.gov.br/marcas` dispara), não por documentação
 * oficial. Riscos herdados e ainda não mitigados:
 *
 *   - O banner "Ambiente de homologação — versão de avaliação" foi
 *     observado no portal na data da descoberta original — não há
 *     confirmação de que este é o ambiente de produção estável.
 *   - Não há termos de uso publicamente conhecidos para consumo por
 *     terceiros.
 *   - Sem SLA conhecido — por isso o timeout curto (6s) e a ausência
 *     deliberada de retry automático: um retry esconderia sinal de
 *     instabilidade de uma API sem contrato formal.
 *
 * Reconfirmado ao vivo nesta sessão (25/08/2026, rede local sem bloqueio):
 * busca por "Nubank" devolveu 113 resultados reais, incluindo o processo
 * 907206794 (titular "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
 * status "Registro de marca em vigor"). A resposta chega com
 * `Access-Control-Allow-Origin: *` — ou seja, o próprio INPI permite
 * chamada direta do navegador. Mesmo assim, mantemos a chamada no servidor
 * (mesma decisão arquitetural da RPI, ver `fetch-rpi.ts`) para poder
 * cachear aqui o `Cache-Control: max-age=86400` que o upstream já declara e
 * que, até agora, ninguém reaproveitava — era uma lacuna real, não uma
 * escolha (martelar uma API de terceiro sem SLA a cada clique é arriscado).
 */

const SEARCH_URL = "https://api-servicos.busca.inpi.gov.br/api/trademarks/search";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 86_400_000; // 24h — mesmo valor do Cache-Control observado no upstream.

function buildPayload(termo: string, pagina: number, resultsPerPage: number) {
  return {
    state: {
      current: pagina,
      filters: [],
      resultsPerPage,
      searchTerm: termo,
      sortDirection: "",
      sortField: "",
      sortList: [],
    },
    queryConfig: {
      search_fields: {
        mark_name: { weight: 3 },
        process_number: {},
        "holders.name": {},
      },
      result_fields: {
        mark_name: { raw: {} },
        process_number: { raw: {} },
        status: { raw: {} },
        classification_code: { raw: {} },
        filing_date: { raw: {} },
        nature_text: { raw: {} },
        presentation_text: { raw: {} },
        holders: { raw: {} },
      },
    },
  };
}

function mapResultado(r: ResultadoBruto): ResultadoBusca {
  const titulares = (r.holders?.raw ?? []).map((t) => ({
    nome: t.name ?? "",
    cnpj: t.cnpj ?? null,
    tipoPessoa: t.person_type ?? null,
  }));

  return {
    id: r.id?.raw ?? "",
    marca: r.mark_name?.raw ?? "",
    numeroProcesso: r.process_number?.raw ?? "",
    status: r.status?.raw ?? "",
    classificacao: r.classification_code?.raw ?? null,
    dataDeposito: r.filing_date?.raw ?? null,
    natureza: r.nature_text?.raw ?? null,
    apresentacao: r.presentation_text?.raw ?? null,
    titulares,
  };
}

// Cache em memória, chaveado por "termo::página". Mesma ressalva da RPI: só
// ajuda dentro de uma instância "quente" do servidor — não sobrevive a cold
// start serverless, não é compartilhado entre instâncias. Produção precisa
// de Redis/S3 com o mesmo TTL de 24h que o upstream já sugere.
const respostaCache = new Map<string, { at: number; resposta: BuscaMarcasResposta }>();

function cacheKey(termo: string, pagina: number): string {
  return `${termo.trim().toLowerCase()}::${pagina}`;
}

export class BuscaInpiError extends Error {}

/**
 * Busca marcas em tempo real na base do INPI.
 *
 * @param termo nome, número de processo ou razão social do titular.
 * @param pagina página de resultados (1-indexed).
 * @param resultsPerPage itens por página (o portal oficial usa 5).
 */
export async function buscarMarcas(
  termo: string,
  pagina = 1,
  resultsPerPage = 10
): Promise<BuscaMarcasResposta> {
  const termoLimpo = termo.trim();
  if (!termoLimpo) {
    throw new BuscaInpiError("Informe um termo de busca.");
  }

  const key = cacheKey(termoLimpo, pagina);
  const cached = respostaCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.resposta;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(termoLimpo, pagina, resultsPerPage)),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new BuscaInpiError(
        `A busca no INPI não respondeu em ${TIMEOUT_MS / 1000}s. Tente novamente.`
      );
    }
    throw new BuscaInpiError(
      `Falha de rede ao consultar a busca do INPI: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new BuscaInpiError(`A busca do INPI respondeu com status ${res.status}.`);
  }

  const body = (await res.json()) as RespostaBruta;
  const resposta: BuscaMarcasResposta = {
    termo: termoLimpo,
    pagina,
    totalPaginas: body.totalPages ?? 0,
    totalResultados: body.totalResults ?? 0,
    resultados: (body.results ?? []).map(mapResultado),
  };

  respostaCache.set(key, { at: Date.now(), resposta });
  return resposta;
}
