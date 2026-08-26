"use client";

import { useState } from "react";
import { riskTier } from "@/lib/fonetica";
import type { ColidenciaResultado } from "@/lib/colidencia";

interface ResultadoStepProps {
  descricao: string;
  colidencia: ColidenciaResultado;
  onColidenciaAtualizada: (c: ColidenciaResultado) => void;
  onRefazer: () => void;
  onVerPlano: () => void;
}

export default function ResultadoStep({
  descricao,
  colidencia,
  onColidenciaAtualizada,
  onRefazer,
  onVerPlano,
}: ResultadoStepProps) {
  const { matches, ncl, top, fonte, avisoFonteReal, termo } = colidencia;
  const tier = top ? riskTier(top.pct) : null;

  const [termoBusca, setTermoBusca] = useState(termo);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  async function refazerBusca() {
    const alvo = termoBusca.trim();
    if (!alvo) return;
    setBuscando(true);
    setErroBusca(null);
    try {
      const params = new URLSearchParams({ marca: alvo, descricao });
      const res = await fetch(`/api/colidencia?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha na busca.");
      onColidenciaAtualizada(body as ColidenciaResultado);
    } catch (e) {
      setErroBusca(e instanceof Error ? e.message : "Falha de rede.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <div className="panel-head">
        <h2>Resultado da análise</h2>
        <p className="help">
          Busca de anterioridade de &quot;{termo}&quot; contra a{" "}
          {fonte === "real" ? "base real do INPI" : "base de demonstração"} e inferência de
          classe a partir da descrição informada.
        </p>
      </div>

      {fonte === "demo" && avisoFonteReal && (
        <div className="helpbox" style={{ borderColor: "var(--warm)", marginBottom: 20 }}>
          <h3 style={{ color: "var(--warm)" }}>Modo demonstração</h3>
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{avisoFonteReal}</p>
        </div>
      )}

      <div className="risk-summary">
        {top ? (
          <>
            <div className="metric">
              <div className="lbl">Nível de colisão</div>
              <div className="val">{top.pct}%</div>
              <div className="sub">
                <span className={`pill ${tier!.cls}`}>{tier!.label}</span>{" "}
                <span className="pill accent">{fonte === "real" ? "INPI" : "exemplo"}</span>
              </div>
            </div>
            <div className="metric">
              <div className="lbl">Marca mais próxima</div>
              <div className="val" style={{ fontSize: 18 }}>
                {top.nome}
              </div>
              <div className="sub">
                {top.classe ? `NCL ${top.classe}` : "Classe não informada"}
                {top.status ? ` · ${top.status}` : ""}
              </div>
            </div>
          </>
        ) : (
          <div className="metric">
            <div className="lbl">Nível de colisão</div>
            <div className="val" style={{ fontSize: 19 }}>
              Nenhuma marca parecida
            </div>
            <div className="sub">
              <span className="pill safe">Risco baixo</span>{" "}
              <span className="pill accent">INPI</span>
            </div>
          </div>
        )}
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

      {matches.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Marca {fonte === "real" ? "encontrada" : "na base"}</th>
                <th>Classe</th>
                <th>Similaridade fonética</th>
                <th>Risco</th>
                {fonte === "real" && <th>Status</th>}
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, 8).map((m) => {
                const t = riskTier(m.pct);
                return (
                  <tr key={`${m.nome}-${m.numeroProcesso ?? ""}`}>
                    <td>
                      {m.nome}
                      {m.numeroProcesso && (
                        <>
                          <br />
                          <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                            processo {m.numeroProcesso}
                          </span>
                        </>
                      )}
                    </td>
                    <td>{m.classe ? `NCL ${m.classe}` : "—"}</td>
                    <td className="tab-nums">{m.pct}%</td>
                    <td>
                      <span className={`pill ${t.cls}`}>{t.label}</span>
                    </td>
                    {fonte === "real" && <td style={{ fontSize: 12 }}>{m.status ?? "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="wave-section">
        <h3>Buscar outro termo</h3>
        <p className="sub">
          Quer comparar com uma variação de grafia ou outra marca? Busca de novo — o resultado
          acima é atualizado, sem perder o restante da análise.
        </p>
        <div className="field busca-row">
          <div>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refazerBusca()}
              placeholder="Ex.: Kaza Doce, Casa do Doce..."
            />
          </div>
          <button className="btn secondary" onClick={refazerBusca} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar de novo →"}
          </button>
        </div>
        {erroBusca && (
          <p style={{ fontSize: 12, color: "var(--risk)", marginTop: 8 }}>{erroBusca}</p>
        )}
      </div>

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
