"use client";

interface PlanoStepProps {
  monitoramento: boolean;
  onToggleMonitoramento: () => void;
  onConfirmar: () => void;
}

export default function PlanoStep({
  monitoramento,
  onToggleMonitoramento,
  onConfirmar,
}: PlanoStepProps) {
  return (
    <>
      <div className="panel-head">
        <h2>Plano de registro</h2>
        <p className="help">
          Setup cobre a análise já feita, a petição e o protocolo. O monitoramento é
          opcional e recorrente — desligue para conduzir o acompanhamento manualmente.
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
            <li>Leitura semanal automática da RPI</li>
            <li>Alerta de oposição de terceiros</li>
            <li>Alerta de prazos (oposição, decênio)</li>
            <li>Notificação por e-mail e push</li>
          </ul>
          <div className="toggle-row">
            <span className="t">Contratar monitoramento</span>
            <button
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
        <button className="btn" onClick={onConfirmar}>
          Confirmar e iniciar protocolo →
        </button>
      </div>
    </>
  );
}
