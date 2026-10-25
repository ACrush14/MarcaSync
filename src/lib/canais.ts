/**
 * Os canais de aviso (e-mail pela Resend, Telegram e WhatsApp pelo CallMeBot) e a escolha de quais usar. Fica separado de
 * `notificar.ts` para não depender do banco e poder ser testado sozinho.
 */

const TEMPO_LIMITE_MS = 15_000;

export interface Aviso {
  processoId?: string;
  para: "operador" | "cliente";
  assunto: string;
  texto: string;
  /** E-mail do cliente (obrigatório para avisar o cliente por e-mail). */
  email?: string;
}

/** Envia um e-mail pela API da Resend. Lança erro se a Resend recusar. */
export async function enviarEmail(entrada: {
  chave: string;
  de: string;
  para: string;
  assunto: string;
  texto: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${entrada.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: entrada.de,
      to: [entrada.para],
      subject: entrada.assunto,
      text: entrada.texto,
    }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!res.ok) {
    throw new Error(`Resend respondeu ${res.status}.`);
  }
}

/** Manda uma mensagem pelo bot do Telegram. Lança erro se o Telegram recusar. */
export async function enviarTelegram(entrada: {
  token: string;
  chatId: string;
  texto: string;
}): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${entrada.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: entrada.chatId, text: entrada.texto }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!res.ok) {
    // Não repetimos o corpo da resposta nem a URL: ela contém o token do bot.
    throw new Error(`Telegram respondeu ${res.status}.`);
  }
}

/**
 * Manda uma mensagem de WhatsApp para o SEU número pelo CallMeBot (serviço gratuito e não oficial:
 * só serve para avisar o dono da chave). Lança erro se o serviço recusar. A chave vai na URL, então
 * a mensagem de erro nunca repete a URL.
 */
export async function enviarWhatsapp(entrada: {
  telefone: string;
  chave: string;
  texto: string;
}): Promise<void> {
  const telefone = entrada.telefone.replace(/\D/g, "");
  const params = new URLSearchParams({
    phone: `+${telefone}`,
    text: entrada.texto.slice(0, 1500),
    apikey: entrada.chave,
  });
  const res = await fetch(`https://api.callmebot.com/whatsapp.php?${params.toString()}`, {
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!res.ok) {
    throw new Error(`CallMeBot respondeu ${res.status}.`);
  }
}

/** As variáveis de ambiente que interessam (aceita `process.env` ou um objeto de teste). */
export type Ambiente = Record<string, string | undefined>;

type Tentativa = { canal: "email" | "telegram" | "whatsapp"; enviar: () => Promise<void> };

/** Quais envios existem para este aviso, conforme as variáveis de ambiente. */
export function tentativasPara(aviso: Aviso, env: Ambiente = process.env): Tentativa[] {
  const lista: Tentativa[] = [];
  const chave = env.RESEND_API_KEY;
  const de = env.EMAIL_REMETENTE;
  const texto = `${aviso.assunto}\n\n${aviso.texto}`;

  if (aviso.para === "cliente") {
    if (chave && de && aviso.email) {
      lista.push({
        canal: "email",
        enviar: () =>
          enviarEmail({
            chave,
            de,
            para: aviso.email as string,
            assunto: aviso.assunto,
            texto: aviso.texto,
          }),
      });
    }
    return lista;
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    lista.push({ canal: "telegram", enviar: () => enviarTelegram({ token, chatId, texto }) });
  }
  if (env.CALLMEBOT_TELEFONE && env.CALLMEBOT_APIKEY) {
    const telefone = env.CALLMEBOT_TELEFONE;
    const chaveWhatsapp = env.CALLMEBOT_APIKEY;
    lista.push({
      canal: "whatsapp",
      enviar: () => enviarWhatsapp({ telefone, chave: chaveWhatsapp, texto }),
    });
  }
  if (chave && de && env.EMAIL_OPERADOR) {
    const para = env.EMAIL_OPERADOR;
    lista.push({
      canal: "email",
      enviar: () => enviarEmail({ chave, de, para, assunto: aviso.assunto, texto: aviso.texto }),
    });
  }
  return lista;
}
