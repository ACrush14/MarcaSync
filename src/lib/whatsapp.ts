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

export interface DadosContato {
  nomeCliente: string;
  marca: string;
  colidencia: ColidenciaResultado | null;
  processoId: string | null;
  /** Só presente depois que o cliente passou pelo passo "Plano". */
  plano?: { monitoramento: boolean } | null;
}

function linhaRisco(c: ColidenciaResultado | null): string | null {
  if (!c) return null;
  if (c.fonte === "demo") return "A busca real no INPI estava indisponível na hora da consulta.";
  if (!c.top) return "Nenhuma marca parecida encontrada na base do INPI.";
  return `Risco de colisão: ${c.top.pct}% (base do INPI) — mais próxima: ${c.top.nome}.`;
}

export function mensagemWhatsapp(d: DadosContato): string {
  const linhas = [
    `Olá! Aqui é ${d.nomeCliente}. Acabei de consultar a marca "${d.marca}" no MarcaSync.`,
    linhaRisco(d.colidencia),
    d.colidencia ? `Classe sugerida: NCL ${d.colidencia.ncl.code}.` : null,
    d.plano
      ? `Plano: setup ${fmtReais(SETUP_CENTAVOS)}${
          d.plano.monitoramento ? ` + monitoramento ${fmtReais(MONITORAMENTO_CENTAVOS)}/mês` : ""
        }.`
      : null,
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
