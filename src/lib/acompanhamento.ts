/**
 * Acompanhamento dos contatos: para cada processo você guarda se a pessoa está interessada, quando
 * é o próximo contato e as suas anotações. É só para você (fica no /admin); o cliente nunca vê.
 *
 * Funções puras, usadas pelo /admin, pela rota que grava e pelo aviso diário.
 */

export const INTERESSES = ["novo", "interessado", "acompanhar", "sem_interesse"] as const;
export type Interesse = (typeof INTERESSES)[number];

export const ROTULO_INTERESSE: Record<Interesse, string> = {
  novo: "Novo",
  interessado: "Interessado",
  acompanhar: "Acompanhar",
  sem_interesse: "Sem interesse",
};

/** O que cada opção quer dizer, para o texto de ajuda do painel. */
export const AJUDA_INTERESSE: Record<Interesse, string> = {
  novo: "Ainda não avaliei.",
  interessado: "Quer seguir; falta eu dar o próximo passo.",
  acompanhar: "Talvez; preciso voltar a falar com a pessoa.",
  sem_interesse: "Disse que não quer, ou sumiu. Não preciso mais falar.",
};

export const MAX_ANOTACOES = 2000;

export interface AcompanhamentoGravado {
  interesse: string;
  proximoContatoEm: Date | string | null;
  ultimoContatoEm: Date | string | null;
  anotacoes: string | null;
}

export interface EntradaAcompanhamento {
  interesse?: unknown;
  /** "AAAA-MM-DD", ou null/"" para limpar a data. */
  proximoContatoEm?: unknown;
  anotacoes?: unknown;
  /** true = "falei com a pessoa agora": grava a data do último contato. */
  contatei?: unknown;
}

export type ResultadoAcompanhamento =
  | {
      ok: true;
      dados: {
        interesse?: Interesse;
        proximoContatoEm?: Date | null;
        anotacoes?: string | null;
        ultimoContatoEm?: Date;
      };
    }
  | { ok: false; erro: string };

/**
 * Texto livre das anotações: mantém as quebras de linha (é um bloco de notas), tira caracteres
 * de controle e invisíveis, apara o excesso de linhas em branco e limita o tamanho.
 */
export function limparAnotacao(v: string): string {
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n]/gu, " ")
    .replace(/[\p{Cf}\p{Cs}\p{Co}]/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "2026-11-03" -> 03/11/2026 ao meio-dia UTC (nunca vira o dia anterior por fuso). */
export function dataDoDia(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
  const confere = d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  return confere && ano >= 2020 && ano <= 2100 ? d : null;
}

/** Confere o que veio do painel. Só os campos enviados entram em `dados`. */
export function validarAcompanhamento(
  entrada: EntradaAcompanhamento,
  agora: Date = new Date()
): ResultadoAcompanhamento {
  const dados: Extract<ResultadoAcompanhamento, { ok: true }>["dados"] = {};

  if (entrada.interesse !== undefined) {
    const i = INTERESSES.find((x) => x === entrada.interesse);
    if (!i) return { ok: false, erro: "Interesse inválido." };
    dados.interesse = i;
  }

  if (entrada.proximoContatoEm !== undefined) {
    if (entrada.proximoContatoEm === null || entrada.proximoContatoEm === "") {
      dados.proximoContatoEm = null;
    } else if (typeof entrada.proximoContatoEm === "string") {
      const d = dataDoDia(entrada.proximoContatoEm);
      if (!d) return { ok: false, erro: "Data inválida: use o formato AAAA-MM-DD." };
      dados.proximoContatoEm = d;
    } else {
      return { ok: false, erro: "Data inválida." };
    }
  }

  if (entrada.anotacoes !== undefined) {
    if (entrada.anotacoes === null) {
      dados.anotacoes = null;
    } else if (typeof entrada.anotacoes === "string") {
      const nota = limparAnotacao(entrada.anotacoes);
      if (nota.length > MAX_ANOTACOES) {
        return { ok: false, erro: `As anotações passam de ${MAX_ANOTACOES} caracteres.` };
      }
      dados.anotacoes = nota || null;
    } else {
      return { ok: false, erro: "Anotações inválidas." };
    }
  }

  if (entrada.contatei !== undefined) {
    if (typeof entrada.contatei !== "boolean") return { ok: false, erro: "Valor inválido." };
    if (entrada.contatei) dados.ultimoContatoEm = agora;
  }

  if (Object.keys(dados).length === 0) return { ok: false, erro: "Nada para salvar." };
  return { ok: true, dados };
}

function comoData(v: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Início do dia (UTC) de uma data: a data do contato é guardada ao meio-dia UTC. */
function diaUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Fuso do Brasil (Fortaleza, sem horário de verão): UTC-3. */
function hojeNoBrasil(agora: Date): number {
  return diaUtc(new Date(agora.getTime() - 3 * 3600_000));
}

export type SituacaoContato = "atrasado" | "hoje" | "agendado" | "sem_data" | "encerrado";

/**
 * Onde está o contato com essa pessoa:
 *  - "encerrado": sem interesse (ou já virou cliente pagante), não precisa mais de contato;
 *  - "atrasado" / "hoje": a data do próximo contato passou ou é hoje;
 *  - "agendado": tem data futura;
 *  - "sem_data": interessado ou a acompanhar, mas sem data marcada (você está esquecendo dela).
 * "novo" sem data também é "sem_data": ainda não foi avaliado.
 */
export function situacaoDoContato(
  a: AcompanhamentoGravado,
  agora: Date = new Date(),
  jaPagou = false
): SituacaoContato {
  if (a.interesse === "sem_interesse" || jaPagou) return "encerrado";
  const data = comoData(a.proximoContatoEm);
  if (!data) return "sem_data";
  const hoje = hojeNoBrasil(agora);
  const dia = diaUtc(data);
  if (dia < hoje) return "atrasado";
  if (dia === hoje) return "hoje";
  return "agendado";
}

/** Precisa de contato hoje (ou já deveria ter tido). */
export function precisaContatar(
  a: AcompanhamentoGravado,
  agora: Date = new Date(),
  jaPagou = false
): boolean {
  const s = situacaoDoContato(a, agora, jaPagou);
  return s === "atrasado" || s === "hoje";
}

export interface ContagemInteresse {
  total: number;
  porInteresse: Record<Interesse, number>;
  paraContatarHoje: number;
  semData: number;
}

/** Os números do topo do painel. */
export function contar(
  itens: Array<AcompanhamentoGravado & { jaPagou?: boolean }>,
  agora: Date = new Date()
): ContagemInteresse {
  const porInteresse: Record<Interesse, number> = {
    novo: 0,
    interessado: 0,
    acompanhar: 0,
    sem_interesse: 0,
  };
  let paraContatarHoje = 0;
  let semData = 0;
  for (const i of itens) {
    const chave = INTERESSES.find((x) => x === i.interesse) ?? "novo";
    porInteresse[chave]++;
    const s = situacaoDoContato(i, agora, i.jaPagou);
    if (s === "atrasado" || s === "hoje") paraContatarHoje++;
    if (s === "sem_data" && (chave === "interessado" || chave === "acompanhar")) semData++;
  }
  return { total: itens.length, porInteresse, paraContatarHoje, semData };
}

/** "AAAA-MM-DD" para o campo de data do painel. */
export function paraCampoDeData(v: Date | string | null): string {
  const d = comoData(v);
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Sugestão de data: daqui a N dias, no calendário do Brasil. */
export function dataEmDias(dias: number, agora: Date = new Date()): string {
  const base = new Date(hojeNoBrasil(agora) + dias * 86400_000);
  return base.toISOString().slice(0, 10);
}
