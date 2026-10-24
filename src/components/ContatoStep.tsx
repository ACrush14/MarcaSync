"use client";

import TrackView from "./TrackView";
import { track } from "@/lib/track";
import { fmtReais } from "@/lib/planos";
import type { ResumoPedido } from "./PedidoStep";
import { useState } from "react";
import PagamentoPix from "./PagamentoPix";

interface ContatoStepProps {
  nomeCliente: string;
  /** Id do processo, para consultar o pagamento; null se a gravação falhou. */
  processoId: string | null;
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
  processoId,
  whatsappCliente,
  marca,
  whatsappHref,
  resumo,
  onNovaConsulta,
}: ContatoStepProps) {
  const primeiroNome = nomeCliente.trim().split(" ")[0] || "";
  const [pago, setPago] = useState(false);

  return (
    <>
      <TrackView nome="contato_visto" />
      <div className="panel-head">
        <h2>
          {resumo
            ? pago
              ? "Pagamento recebido"
              : "Falta só o pagamento"
            : "Falta só a nossa conversa"}
          {primeiroNome ? `, ${primeiroNome}` : ""}
        </h2>
        <p className="help">
          {resumo
            ? pago
              ? `O pagamento da marca "${marca}" foi confirmado. Agora seguimos com o registro e te avisamos a cada passo.`
              : `Os dados da marca "${marca}" ficaram guardados. Pague os dois Pix abaixo e eu sigo com o registro: o pagamento é conferido sozinho e nada é protocolado antes dele.`
            : `Sua consulta da marca "${marca}" foi registrada. Agora é comigo: falo com você pelo WhatsApp para revisar o resultado, combinar o pagamento e seguir com o registro.`}
        </p>
      </div>

      {resumo && processoId && (
        <PagamentoPix processoId={processoId} onTudoPago={() => setPago(true)} />
      )}

      {whatsappHref ? (
        <div className="contato-cta" style={resumo ? { marginTop: 24 } : undefined}>
          <a
            className="btn"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_clicado", { onde: "contato" })}
          >
            {resumo ? "Prefere falar antes? Abrir o WhatsApp →" : "Abrir conversa no WhatsApp →"}
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
              <b>Você paga os dois Pix</b> desta tela. A confirmação é automática e a taxa do INPI
              só é paga depois que o seu pagamento entra.
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
              <b>Emitimos e pagamos a taxa do INPI</b> com o valor oficial e{" "}
              <b>protocolamos o pedido</b> no e-Marcas. Você recebe o número do pedido.
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
