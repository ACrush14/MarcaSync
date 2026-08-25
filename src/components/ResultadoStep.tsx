"use client";

import { riskTier } from "@/lib/fonetica";
import { CLASS_LABELS } from "@/lib/ncl";
import type { Analise } from "@/lib/types";
import WaveCanvas from "./WaveCanvas";
import BuscaRealPanel from "./BuscaRealPanel";

interface ResultadoStepProps {
  marca: string;
  analise: Analise;
  onRefazer: () => void;
  onVerPlano: () => void;
}

export default function ResultadoStep({
  marca,
  analise,
  onRefazer,
  onVerPlano,
}: ResultadoStepProps) {
  const { matches, ncl, top } = analise;
  const tier = riskTier(top.pct);
  const legendColor = tier.cls === "safe" ? "var(--safe)" : tier.cls === "warm" ? "var(--warm)" : "var(--risk)";

  return (
    <>
      <div className="panel-head">
        <h2>Resultado da análise</h2>
        <p className="help">
          Comparação fonética de &quot;{marca}&quot; contra a base de marcas e inferência
          de classe a partir da descrição informada.
        </p>
      </div>

      <div className="risk-summary">
        <div className="metric">
          <div className="lbl">Nível de colisão</div>
          <div className="val">{top.pct}%</div>
          <div className="sub">
            <span className={`pill ${tier.cls}`}>{tier.label}</span>
          </div>
        </div>
        <div className="metric">
          <div className="lbl">Marca mais próxima</div>
          <div className="val" style={{ fontSize: 18 }}>
            {top.name}
          </div>
          <div className="sub">
            Classe NCL {top.cls} · {CLASS_LABELS[top.cls] ?? ""}
          </div>
        </div>
        <div className="metric">
          <div className="lbl">Classe sugerida</div>
          <div className="val" style={{ fontSize: 18 }}>
            NCL {ncl.code}
          </div>
          <div className="sub">
            {ncl.label}{" "}
            <span className="pill accent" style={{ marginLeft: 4 }}>
              confiança {ncl.confidence}
            </span>
          </div>
        </div>
      </div>

      <div className="wave-section">
        <h3>Assinatura fonética comparada</h3>
        <p className="sub">
          Cada nome é reduzido a um código de som (ex.: &quot;Kaza&quot; e &quot;Casa&quot;
          geram o mesmo código); a proximidade das barras ilustra a proximidade sonora —
          o percentual acima é a métrica exata.
        </p>
        <div className="wave-legend">
          <span>
            <i style={{ background: "var(--accent)" }} />
            {marca}
          </span>
          <span>
            <i style={{ background: legendColor }} />
            {top.name}
          </span>
        </div>
        <WaveCanvas fa={top.fa} fb={top.fb} tier={tier} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Marca na base</th>
              <th>Classe</th>
              <th>Similaridade fonética</th>
              <th>Risco</th>
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, 6).map((m) => {
              const t = riskTier(m.pct);
              return (
                <tr key={m.name}>
                  <td>{m.name}</td>
                  <td>NCL {m.cls}</td>
                  <td className="tab-nums">
                    <span className="simbar">
                      <span className="track">
                        <span className="fill" style={{ width: `${m.pct}%` }} />
                      </span>
                      {m.pct}%
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${t.cls}`}>{t.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BuscaRealPanel termoInicial={marca} />

      <div className="cta-row">
        <button className="btn secondary" onClick={onRefazer}>
          ← Refazer consulta
        </button>
        <button className="btn" onClick={onVerPlano}>
          Ver plano de registro →
        </button>
      </div>
    </>
  );
}
