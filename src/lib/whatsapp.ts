import type { ColidenciaResultado } from "./colidencia";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS, fmtReais } from "./planos";

/**
 * Link de conversa (wa.me) com o WhatsApp do MarcaSync, com a mensagem já
 * escrita a partir da consulta — o cliente só aperta "enviar".
 *
 * O número vem de NEXT_PUBLIC_WHATSAPP_NUMBER (só dígitos, com DDI: ex.
 * 5585912345678). É NEXT_PUBLIC_ porque o link é montado no navegador, e o
 * Next só embute a variável no bundle se ela for lida *literalmente* como
 * `process.env.NEXT_PUBLIC_...` — não desestruture nem leia por chave
 * dinâmica. Mudou o número? Atualize a variável e faça um novo deploy (ela é
 * embutida em tempo de build, não lida em runtime).
 *
 * Sem número configurado `linkWhatsapp` devolve null e a interface cai pro
 * caminho "eu te chamo no número que você informou" — nunca um link quebrado.
 */
const NUMERO = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

/** DDI (2) + DDD (2) + número (8–9) = 12 a 13 dígitos. */
export const whatsappConfigurado = NUMERO.length >= 12 && NUMERO.length <= 13;

/** Link simples para falar com o MarcaSync (sem mensagem pronta), para o rodapé; null se não houver número. */
export const linkContatoWhatsapp: string | null = whatsappConfigurado
  ? `https://wa.me/${NUMERO}`
  : null;

export interface DadosContato {
  nomeCliente: string;
  marca: string;
  colidencia: ColidenciaResultado | null;
  processoId: string | null;
  /** Só presente depois que o cliente passou pelo passo "Plano". */
  plano?: { monitoramento: boolean } | null;
  /** O cliente já preencheu o formulário de dados do pedido de registro. */
  pedidoEnviado?: boolean;
}

function linhaRisco(c: ColidenciaResultado | null): string | null {
  if (!c) return null;
  if (c.fonte === "demo") return "A busca real no INPI estava indisponível na hora da consulta.";
  if (!c.top) return "Nenhuma marca parecida encontrada na base do INPI.";
  const r = c.risco;
  if (r.modo === "por-ramo") {
    if (!r.principal) {
      return `Nenhuma marca parecida no meu ramo (NCL ${c.ncl.code}); há parecidas em outros ramos: até ${r.outrosRamos?.pct ?? 0}%.`;
    }
    return `Risco de colisão no meu ramo (NCL ${c.ncl.code}): ${r.principal.pct}% (base do INPI) — mais próxima: ${r.principal.nome}.`;
  }
  return `Risco de colisão: ${c.top.pct}% (base do INPI) — mais próxima: ${c.top.nome}.`;
}

export function mensagemWhatsapp(d: DadosContato): string {
  const linhas = [
    `${d.nomeCliente.trim() ? `Olá! Aqui é ${d.nomeCliente.trim()}.` : "Olá!"} Acabei de consultar a marca "${d.marca}" no MarcaSync.`,
    linhaRisco(d.colidencia),
    d.colidencia ? `Classe sugerida: NCL ${d.colidencia.ncl.code}.` : null,
    d.plano
      ? `Plano: setup ${fmtReais(SETUP_CENTAVOS)}${
          d.plano.monitoramento ? ` + monitoramento ${fmtReais(MONITORAMENTO_CENTAVOS)}/mês` : ""
        }.`
      : null,
    d.pedidoEnviado ? "Já preenchi os dados do pedido de registro no site." : null,
    "Quero conversar sobre o registro.",
    // referência curta pra achar o pedido no /admin
    d.processoId ? `Ref.: ${d.processoId.slice(-6)}` : null,
  ];
  return linhas.filter((l): l is string => l !== null).join("\n");
}

export function linkWhatsapp(d: DadosContato): string | null {
  if (!whatsappConfigurado) return null;
  return `https://wa.me/${NUMERO}?text=${encodeURIComponent(mensagemWhatsapp(d))}`;
}

/** DDDs que existem no Brasil (11 a 99, com lacunas). */
const DDDS_VALIDOS = new Set(
  (
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 " +
    "51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99"
  ).split(" ")
);

/**
 * O WhatsApp digitado no formulário é aceitável? Só vale UM número de celular brasileiro: DDD que
 * existe + 9 + 8 dígitos, com ou sem o 55 na frente e com ou sem máscara. Telefone fixo não tem
 * WhatsApp, então é recusado; letras, dois números colados e números de outros países também.
 * "(85) 91234-5678" vale.
 */
export function whatsappValido(v: string): boolean {
  if (typeof v !== "string") return false;
  // Só dígitos e a pontuação comum de telefone ("+" apenas na frente): letras não passam.
  if (!/^\+?[\d\s().-]+$/.test(v.trim())) return false;
  const m = /^(?:55)?(\d{2})(9\d{8})$/.exec(v.replace(/\D/g, ""));
  const ddd = m?.[1];
  const numero = m?.[2];
  if (!ddd || !numero) return false;
  if (!DDDS_VALIDOS.has(ddd)) return false;
  // 99999-9999, 91111-1111 e afins são número inventado.
  return !/^(\d)\1{7}$/.test(numero.slice(1));
}

/**
 * Máscara enquanto a pessoa digita: só dígitos, no máximo 11 (DDD + celular), no formato
 * "(85) 91234-5678". Se colar com o 55 do país na frente, ele é tirado.
 */
export function formatarWhatsapp(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link wa.me para falar com o CLIENTE (usado no /admin). Aceita número com máscara, com ou sem DDI. */
export function linkParaCliente(whatsappCliente: string, texto: string): string | null {
  let digitos = whatsappCliente.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  if (digitos.length < 12 || digitos.length > 13) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
