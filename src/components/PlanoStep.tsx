"use client";

import LogoUpload from "./LogoUpload";

interface PlanoStepProps {
  monitoramento: boolean;
  onToggleMonitoramento: () => void;
  onConfirmar: () => void;
  processoId: string | null;
  /** Link wa.me já com o plano escolhido; null se o número não estiver configurado. */
  whatsappHref: string | null;
}

export default function PlanoStep({
  monitoramento,
  onToggleMonitoramento,
  onConfirmar,
  processoId,
  whatsappHref,
}: PlanoStepProps) {
  return (
    <>
      <div className="panel-head">
        <h2>Plano de registro</h2>
        <p className="help">
          Sem &quot;fale com um consultor&quot; — o valor abaixo é o valor final, sem
          orçamento por telefone. Setup cobre a análise já feita, a petição e o
          protocolo. O monitoramento é opcional e recorrente — desligue para conduzir
          o acompanhamento manualmente.
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
            <li>Geração da petição e da guia (GRU)</li>
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

      <LogoUpload processoId={processoId} />

      <div className="summary-strip">
        <div className="total">
          <div className="lbl">Total hoje</div>
          <div className="amt tab-nums">
            R$ 499,00
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
        {whatsappHref ? (
          <a
            className="btn"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onConfirmar}
          >
            Quero seguir — falar no WhatsApp →
          </a>
        ) : (
          <button className="btn" onClick={onConfirmar}>
            Quero seguir — me chamem →
          </button>
        )}
      </div>
      <p className="sim-note">
        Preço fechado desde a Consulta — sem taxa extra depois, sem &quot;isso não
        estava incluso&quot;.
      </p>
    </>
  );
}
