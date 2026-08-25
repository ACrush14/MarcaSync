"use client";

import { useState } from "react";
import type { BuscaMarcasResposta } from "@/lib/inpi/busca-types";

interface ErrorResponse {
  error: string;
}

interface BuscaRealPanelProps {
  termoInicial: string;
}

/**
 * Busca ao vivo na base real de marcas do INPI (via /api/inpi/busca).
 *
 * Deliberadamente separado da tabela de colidência fonética logo acima: a
 * tabela usa BASE_MARCAS (14 marcas fictícias, ver src/lib/data.ts) para
 * demonstrar o algoritmo de fonética; este painel bate na base real do INPI
 * por nome, número de processo ou titular. Fundir os dois numa única
 * pontuação de risco é dívida de UX em aberto — ver README.
 */
export default function BuscaRealPanel({ termoInicial }: BuscaRealPanelProps) {
  const [termo, setTermo] = useState(termoInicial);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<BuscaMarcasResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(pagina = 1) {
    if (!termo.trim()) return;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ termo: termo.trim(), pagina: String(pagina) });
      const res = await fetch(`/api/inpi/busca?${params.toString()}`);
      const body: BuscaMarcasResposta | ErrorResponse = await res.json();
      if (!res.ok) {
        setErro((body as ErrorResponse).error ?? "Erro desconhecido.");
        setResultado(null);
      } else {
        setResultado(body as BuscaMarcasResposta);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wave-section">
      <h3>Busca ao vivo na base real do INPI</h3>
      <p className="sub">
        Isto não é a base de exemplo acima — bate direto na base de marcas depositadas de
        verdade no INPI, por nome, número de processo ou titular.
      </p>

      <div className="field" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="busca-real-termo">Termo de busca</label>
          <input
            type="text"
            id="busca-real-termo"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar(1)}
            placeholder="Ex.: Nubank, 907206794..."
          />
        </div>
        <button className="btn" onClick={() => buscar(1)} disabled={loading}>
          {loading ? "Buscando…" : "Buscar →"}
        </button>
      </div>

      {erro && (
        <div className="helpbox" style={{ borderColor: "var(--risk)", marginTop: 12 }}>
          <h3 style={{ color: "var(--risk)" }}>Erro</h3>
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{erro}</p>
        </div>
      )}

      {resultado && (
        <>
          <p className="sim-note" style={{ marginTop: 12 }}>
            {resultado.totalResultados} resultado(s) para &quot;{resultado.termo}&quot; — página{" "}
            {resultado.pagina} de {Math.max(1, resultado.totalPaginas)}.
          </p>

          {resultado.resultados.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>
              Nenhuma marca encontrada para esse termo na base real.
            </p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Marca</th>
                    <th>Processo</th>
                    <th>Status</th>
                    <th>Titular</th>
                    <th>Depósito</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.resultados.map((r) => (
                    <tr key={r.id || r.numeroProcesso}>
                      <td>{r.marca}</td>
                      <td className="mono">{r.numeroProcesso}</td>
                      <td>{r.status}</td>
                      <td>{r.titulares.map((t) => t.nome).join("; ") || "—"}</td>
                      <td className="tab-nums">
                        {r.dataDeposito ? new Date(r.dataDeposito).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="btn ghost"
              disabled={loading || resultado.pagina <= 1}
              onClick={() => buscar(resultado.pagina - 1)}
            >
              ← Anterior
            </button>
            <button
              className="btn ghost"
              disabled={loading || resultado.pagina >= resultado.totalPaginas}
              onClick={() => buscar(resultado.pagina + 1)}
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
