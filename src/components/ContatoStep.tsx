"use client";

import TrackView from "./TrackView";
import { track } from "@/lib/track";
import { fmtReais } from "@/lib/planos";
import type { ResumoPedido } from "./PedidoStep";

interface ContatoStepProps {
  nomeCliente: string;
  /** WhatsApp que o próprio cliente informou na consulta. */
  whatsappCliente: string;
  marca: string;
  /** Link wa.me pro WhatsApp do MarcaSync; null se o número não estiver configurado. */
  whatsappHref: string | null;
  /** Valores do pedido, quando o cliente preencheu o formulário de dados; senão null. */
  resumo: ResumoPedido | null;
  onNovaConsulta: () => void;
}

/**
 * Último passo: depois da consulta, a conversa continua no WhatsApp. O link
 * abre sozinho quando o cliente clica no passo anterior (Resultado ou
 * Plano); este botão é a segunda chance caso o navegador tenha bloqueado a
 * nova aba. Sem número configurado, o caminho é inverso: eu chamo o cliente
 * no número que ele informou.
 */
export default function ContatoStep({
  nomeCliente,
  whatsappCliente,
  marca,
  whatsappHref,
  resumo,
  onNovaConsulta,
}: ContatoStepProps) {
  const primeiroNome = nomeCliente.trim().split(" ")[0] || "";

  return (
    <>
      <TrackView nome="contato_visto" />
      <div className="panel-head">
        <h2>
          {resumo ? "Recebi os dados do seu pedido" : "Falta só a nossa conversa"}
          {primeiroNome ? `, ${primeiroNome}` : ""}
        </h2>
        <p className="help">
          {resumo
            ? `Os dados da marca "${marca}" ficaram guardados. Agora é comigo: confiro tudo, falo com você pelo WhatsApp para combinar o pagamento e sigo com o registro. Nada é pago nem protocolado antes da nossa conversa.`
            : `Sua consulta da marca "${marca}" foi registrada. Agora é comigo: falo com você pelo WhatsApp para revisar o resultado, combinar o pagamento e seguir com o registro.`}
        </p>
      </div>

      {whatsappHref ? (
        <div className="contato-cta">
          <a
            className="btn"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_clicado", { onde: "contato" })}
          >
            Abrir conversa no WhatsApp →
          </a>
          <p className="sim-note">
            Se o WhatsApp não abriu sozinho, é só clicar acima — a mensagem já vai escrita, é só
            enviar.
          </p>
        </div>
      ) : (
        <div className="helpbox contato-cta">
          <h3>Eu te chamo</h3>
          <p style={{ fontSize: 13.5, color: "var(--ink-dim)" }}>
            Vou entrar em contato pelo número que você informou: <b>{whatsappCliente}</b>.
          </p>
        </div>
      )}

      {resumo && (
        <div className="helpbox" style={{ marginTop: 24 }}>
          <h3>O que você vai pagar</h3>
          <table style={{ width: "100%", fontSize: 14 }}>
            <tbody>
              <tr>
                <td>Serviço MarcaSync</td>
                <td className="tab-nums" style={{ textAlign: "right" }}>
                  {fmtReais(resumo.servicoCentavos)}
                </td>
              </tr>
              <tr>
                <td>Taxa do INPI (GRU){resumo.gruComDesconto ? " — com 50% de desconto" : ""}</td>
                <td className="tab-nums" style={{ textAlign: "right" }}>
                  {fmtReais(resumo.gruCentavos)}
                </td>
              </tr>
              <tr style={{ fontWeight: 600 }}>
                <td>Total para registrar</td>
                <td className="tab-nums" style={{ textAlign: "right" }}>
                  {fmtReais(resumo.totalCentavos)}
                </td>
              </tr>
              {resumo.monitoramento && (
                <tr style={{ color: "var(--ink-dim)" }}>
                  <td>Monitoramento, depois da publicação</td>
                  <td className="tab-nums" style={{ textAlign: "right" }}>
                    {fmtReais(resumo.monitoramentoCentavos)}/mês
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="helpbox" style={{ marginTop: 24 }}>
        <h3>O que acontece agora</h3>
        {resumo ? (
          <ol>
            <li>
              <b>Eu confiro os dados</b> e falo com você no WhatsApp para tirar qualquer dúvida.
            </li>
            <li>
              <b>Combinamos o pagamento</b> do total acima por PIX — eu confirmo à mão, assim que
              você avisar.
            </li>
            <li>
              <b>Você cria o seu cadastro no e-INPI</b> (opção &quot;Cliente&quot;, com os mesmos
              dados do formulário e a natureza jurídica escolhida) em{" "}
              <a href="https://meu.inpi.gov.br/pag/cliente/form" target="_blank" rel="noreferrer">
                meu.inpi.gov.br
              </a>
              . É ele que dá o desconto na taxa. <b>Nunca me passe a senha:</b> eu não preciso dela
              para emitir a guia.
            </li>
            <li>
              <b>Você assina a procuração</b> que eu envio. Ela precisa estar no processo em até 60
              dias do protocolo.
            </li>
            <li>
              <b>Eu emito e pago a taxa do INPI</b> com o valor oficial e <b>protocolo o pedido</b>{" "}
              no e-Marcas. Você recebe o número do pedido.
            </li>
            <li>
              <b>Te aviso de cada novidade</b> do processo, até a marca sair.
            </li>
          </ol>
        ) : (
          <ol>
            <li>
              <b>Eu respondo no WhatsApp</b> e reviso o resultado da busca com você.
            </li>
            <li>
              <b>Combinamos o pagamento</b> por PIX — eu confirmo à mão, assim que você avisar.
            </li>
            <li>
              <b>Confiro a checklist do pedido</b> (dados, imagem e especificação) e protocolo no
              INPI.
            </li>
            <li>
              <b>Te aviso de cada novidade</b> do processo, até a marca sair.
            </li>
          </ol>
        )}
      </div>

      <div className="cta-row">
        <button className="btn secondary" onClick={onNovaConsulta}>
          Consultar outra marca
        </button>
      </div>
    </>
  );
}
