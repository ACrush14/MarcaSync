import { prisma } from "./db";
import { tentativasPara, type Aviso } from "./canais";

/**
 * Avisos do sistema, para você (operador) e para o cliente. Cada aviso vira uma linha em
 * `Notificacao`, enviada ou não, para nada se perder e o /admin mostrar o histórico.
 *
 * Canais, ligados por variáveis de ambiente (nenhum é obrigatório):
 *  - e-mail pela Resend:  RESEND_API_KEY e EMAIL_REMETENTE (ex.: "MarcaSync <avisos@marcasync.com.br>",
 *    um domínio verificado na Resend). Para avisar você por e-mail, defina também EMAIL_OPERADOR.
 *  - Telegram (só para você): TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.
 * Sem nenhum canal, o aviso fica só no painel (canal "painel", sem data de envio).
 */

/**
 * Envia o aviso por todos os canais configurados e grava o resultado. Nunca lança erro: um aviso
 * que falha não pode derrubar o pagamento ou o protocolo que o gerou.
 */
export async function notificar(aviso: Aviso): Promise<void> {
  const base = {
    processoId: aviso.processoId ?? null,
    destino: aviso.para,
    assunto: aviso.assunto,
    texto: aviso.texto,
  };
  try {
    const tentativas = tentativasPara(aviso);
    if (tentativas.length === 0) {
      await prisma.notificacao.create({ data: { ...base, canal: "painel" } });
      return;
    }
    for (const t of tentativas) {
      try {
        await t.enviar();
        await prisma.notificacao.create({
          data: { ...base, canal: t.canal, enviadaEm: new Date() },
        });
      } catch (e) {
        await prisma.notificacao.create({
          data: {
            ...base,
            canal: t.canal,
            erro: e instanceof Error ? e.message.slice(0, 300) : "falha",
          },
        });
      }
    }
  } catch (e) {
    console.error("[notificar] não consegui registrar o aviso", e instanceof Error ? e.message : e);
  }
}
