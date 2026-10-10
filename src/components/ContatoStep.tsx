"use client";

import TrackView from "./TrackView";
import { track } from "@/lib/track";

interface ContatoStepProps {
  nomeCliente: string;
  /** WhatsApp que o próprio cliente informou na consulta. */
  whatsappCliente: string;
  marca: string;
  /** Link wa.me pro WhatsApp do MarcaSync; null se o número não estiver configurado. */
  whatsappHref: string | null;
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
  onNovaConsulta,
}: ContatoStepProps) {
  const primeiroNome = nomeCliente.trim().split(" ")[0] || "";

  return (
    <>
      <TrackView nome="contato_visto" />
      <div className="panel-head">
        <h2>Falta só a nossa conversa{primeiroNome ? `, ${primeiroNome}` : ""}</h2>
        <p className="help">
          Sua consulta da marca &quot;{marca}&quot; foi registrada. Agora é comigo: falo com você
          pelo WhatsApp para revisar o resultado, combinar o pagamento e seguir com o registro.
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

      <div className="helpbox" style={{ marginTop: 24 }}>
        <h3>O que acontece agora</h3>
        <ol>
          <li>
            <b>Eu respondo no WhatsApp</b> e reviso o resultado da busca com você.
          </li>
          <li>
            <b>Combinamos o pagamento</b> por PIX — eu confirmo à mão, assim que você avisar.
          </li>
          <li>
            <b>Reúno o que falta</b> (dados do titular, logotipo se tiver) e protocolo o pedido no
            INPI.
          </li>
          <li>
            <b>Te aviso de cada novidade</b> do processo, até a marca sair.
          </li>
        </ol>
      </div>

      <div className="cta-row">
        <button className="btn secondary" onClick={onNovaConsulta}>
          Consultar outra marca
        </button>
      </div>
    </>
  );
}
