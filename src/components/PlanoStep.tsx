"use client";

import TrackView from "./TrackView";
import { track } from "@/lib/track";

interface PlanoStepProps {
  monitoramento: boolean;
  onToggleMonitoramento: () => void;
  /** Cliente quer registrar: abre o formulário com os dados do pedido. */
  onConfirmar: () => void;
  /** Cliente prefere conversar antes de preencher os dados. */
  onFalarPrimeiro: () => void;
  /** Link wa.me já com o plano escolhido; null se o número não estiver configurado. */
  whatsappHref: string | null;
}

export default function PlanoStep({
  monitoramento,
  onToggleMonitoramento,
  onConfirmar,
  onFalarPrimeiro,
  whatsappHref,
}: PlanoStepProps) {
  return (
    <>
      <TrackView nome="plano_visto" />
      <div className="panel-head">
        <h2>Plano de registro</h2>
        <p className="help">
          Sem &quot;fale com um consultor&quot; — o valor do serviço abaixo é fechado, sem orçamento
          por telefone. Setup cobre a análise já feita, a petição e o protocolo. A taxa oficial do
          INPI (GRU) é cobrada à parte, e o valor exato aparece antes de você confirmar. O
          monitoramento é opcional e recorrente — desligue para conduzir o acompanhamento
          manualmente.
        </p>
      </div>

      <div className="plans">
        <div className="plan-card">
          <h3>Setup — Análise e Protocolo</h3>
          <div className="price">
            R$ 499 <small>pagamento único</small>
          </div>
          <ul>
            <li>Busca de anterioridade fonética</li>
            <li>Inferência e conferência da classe NCL</li>
            <li>Petição, guia (GRU) e procuração prontas</li>
            <li>Protocolo do pedido no INPI</li>
          </ul>
        </div>
        <div className="plan-card">
          <h3>Monitoramento RPI</h3>
          <div className="price">
            R$ 29 <small>por mês</small>
          </div>
          <ul>
            <li>Leitura semanal da RPI, automática, do seu processo</li>
            <li>Aviso de qualquer despacho publicado, inclusive oposição de terceiros</li>
            <li>Prazo estimado de manifestação quando houver oposição</li>
            <li>Aviso por WhatsApp, com explicação do que fazer</li>
          </ul>
          <div className="toggle-row">
            <label className="t" htmlFor="sw-monitoramento">
              Contratar monitoramento
            </label>
            <button
              id="sw-monitoramento"
              type="button"
              className={`switch ${monitoramento ? "on" : ""}`}
              role="switch"
              aria-checked={monitoramento}
              onClick={onToggleMonitoramento}
            />
          </div>
        </div>
      </div>

      <div className="summary-strip">
        <div className="total">
          <div className="lbl">Serviço hoje</div>
          <div className="amt tab-nums">
            R$ 499,00
            <span
              style={{
                fontSize: 12.5,
                color: "var(--ink-dim)",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
              }}
            >
              {" "}
              + taxa do INPI (GRU)
            </span>
            {monitoramento && (
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                }}
              >
                {" "}
                + R$ 29/mês a partir da publicação
              </span>
            )}
          </div>
        </div>
        <button className="btn" onClick={onConfirmar}>
          Quero registrar — informar os dados →
        </button>
      </div>
      <p className="sim-note">
        Preço do serviço fechado desde a Consulta. A taxa do INPI (GRU) é oficial, vai direto para o
        INPI e é mostrada antes de você confirmar — sem surpresa depois.{" "}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              track("whatsapp_clicado", { onde: "plano" });
              onFalarPrimeiro();
            }}
          >
            Prefere conversar antes? Fale comigo no WhatsApp.
          </a>
        ) : (
          <button type="button" className="btn ghost" onClick={onFalarPrimeiro}>
            Prefere conversar antes? Me chamem.
          </button>
        )}
      </p>
    </>
  );
}
