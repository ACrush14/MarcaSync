"use client";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

interface PainelStepProps {
  protocolo: string;
  monitoramento: boolean;
  opposed: boolean;
  onSimularOposicao: () => void;
}

export default function PainelStep({
  protocolo,
  monitoramento,
  opposed,
  onSimularOposicao,
}: PainelStepProps) {
  const hoje = new Date();
  const deposito = addDays(hoje, -41);
  const exameFormal = addDays(hoje, -34);
  const publicacao = addDays(hoje, -13);
  const fimOposicao = addDays(publicacao, 60);
  const diasRestantes = Math.max(0, Math.ceil((fimOposicao.getTime() - hoje.getTime()) / 86400000));

  const phases: Array<{ t: string; d: string; status: "done" | "current" | "risk" | "pending"; code?: string }> = [
    { t: "Depósito do pedido", d: fmtDate(deposito), status: "done" },
    { t: "Exame Formal", d: fmtDate(exameFormal), status: "done" },
    { t: "Publicação na RPI", d: fmtDate(publicacao), status: "done", code: "389" },
    {
      t: "Prazo de Oposição (60 dias)",
      d: `até ${fmtDate(fimOposicao)} · faltam ${diasRestantes} dias`,
      status: opposed ? "risk" : "current",
      ...(opposed ? { code: "394" } : {}),
    },
    { t: "Exame de Mérito", d: "pendente", status: "pending" },
    { t: "Deferimento", d: "pendente", status: "pending" },
    { t: "Pagamento do Decênio", d: "pendente", status: "pending" },
  ];

  const logBase: Array<{ date: string; text: string; warn: boolean }> = [
    { date: fmtDate(addDays(hoje, -6)), text: "Nenhuma alteração encontrada na RPI desta semana.", warn: false },
    { date: fmtDate(publicacao), text: "Despacho 389 publicado — pedido em fase de oposição (60 dias).", warn: false },
    { date: fmtDate(addDays(publicacao, -7)), text: "Nenhuma alteração encontrada.", warn: false },
    { date: fmtDate(addDays(publicacao, -14)), text: "Nenhuma alteração encontrada.", warn: false },
  ];
  if (opposed) {
    logBase.unshift({
      date: "hoje",
      text: "Despacho 394 publicado — oposição de terceiro registrada. Prazo de manifestação: 60 dias (Art. 158, LPI).",
      warn: true,
    });
  }

  return (
    <>
      <div className="panel-head">
        <h2>Painel de acompanhamento</h2>
        <p className="help">
          Estado do pedido ao longo do ciclo de vida no INPI, com o histórico de leituras
          semanais da RPI para esta marca.
        </p>
      </div>

      <div className="proc-head">
        <div className="num">
          <span className="lbl">Protocolo INPI</span>
          {protocolo}
        </div>
        <span className={`pill ${opposed ? "risk" : "accent"}`}>
          {opposed ? "Ação necessária" : monitoramento ? "Monitoramento ativo" : "Monitoramento não contratado"}
        </span>
      </div>

      <div className="timeline">
        <p className="tl-note">
          Datas e despachos ilustrativos — para o processo real, confirme os códigos no
          Manual de Marcas do INPI.
        </p>
        {phases.map((p) => (
          <div key={p.t} className={`tl-item ${p.status}`}>
            <div className="tl-rail">
              <div className="tl-dot" />
              <div className="tl-line" />
            </div>
            <div className="tl-body">
              <div className="tl-top">
                <span className="tl-title">{p.t}</span>
                {p.code && <span className="tl-code">despacho {p.code}</span>}
              </div>
              <div className="tl-date">{p.d}</div>
            </div>
          </div>
        ))}
      </div>

      {monitoramento ? (
        <>
          <div className="rpi-log-head">
            <h3 style={{ fontSize: 13, fontFamily: "var(--font-body)", fontWeight: 600 }}>
              Histórico de leituras da RPI
            </h3>
            <button className="btn ghost" disabled={opposed} onClick={onSimularOposicao}>
              Simular alerta de oposição
            </button>
          </div>
          <div className="rpi-log">
            {logBase.map((l, i) => (
              <div key={i} className={`log-row ${l.warn ? "warn" : ""}`}>
                <span className="date mono">{l.date}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
          <p className="sim-note">
            O botão acima é uma demonstração de como o alerta apareceria aqui — no produto
            real ele é disparado automaticamente pela leitura semanal da RPI.
          </p>
        </>
      ) : (
        <div className="helpbox">
          <h3>Monitoramento não contratado</h3>
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Sem o monitoramento, você precisa consultar a RPI manualmente todas as
            terças-feiras para não perder o prazo de oposição ou de pagamento do decênio.
          </p>
        </div>
      )}
    </>
  );
}
