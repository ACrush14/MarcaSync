"use client";

import { useState } from "react";
import Link from "next/link";
import type { RpiProcesso } from "@/lib/inpi/types";

interface LookupResponse {
  edicao: number;
  dataEdicao: string | null;
  fonte: string;
  encontrados: RpiProcesso[];
  naoEncontrados: string[];
}

interface ErrorResponse {
  error: string;
}

export default function RpiTestePage() {
  const [numeros, setNumeros] = useState("905922891");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<LookupResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const lista = numeros
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const params = new URLSearchParams();
      lista.forEach((n) => params.append("numero", n));
      const res = await fetch(`/api/rpi/lookup?${params.toString()}`);
      const body: LookupResponse | ErrorResponse = await res.json();
      if (!res.ok) {
        setErro((body as ErrorResponse).error ?? "Erro desconhecido.");
      } else {
        setResultado(body as LookupResponse);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="mark">MarcaSync</span>
          <span className="tag">verificação técnica · RPI oficial</span>
        </div>
        <Link href="/" className="btn secondary">
          ← Voltar ao protótipo
        </Link>
      </div>

      <main className="panel">
        <div className="panel-head">
          <h2>Consulta real à RPI</h2>
          <p className="help">
            Isto não é o fluxo de demonstração — bate direto em{" "}
            <code className="mono">revistas.inpi.gov.br</code> (a Revista da Propriedade
            Industrial oficial) e devolve os despachos publicados de verdade para o(s)
            número(s) de processo informado(s). Existe porque a integração precisava ser
            provada com dado real, não simulado.
          </p>
        </div>

        <div className="field">
          <label htmlFor="numeros">Número(s) de processo (separados por vírgula)</label>
          <input
            type="text"
            id="numeros"
            value={numeros}
            onChange={(e) => setNumeros(e.target.value)}
            placeholder="Ex.: 905922891, 905922892"
          />
        </div>
        <button className="btn" onClick={buscar} disabled={loading}>
          {loading ? "Consultando RPI…" : "Buscar na edição mais recente →"}
        </button>

        {erro && (
          <div className="helpbox" style={{ marginTop: 20, borderColor: "var(--risk)" }}>
            <h3 style={{ color: "var(--risk)" }}>Erro</h3>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{erro}</p>
          </div>
        )}

        {resultado && (
          <div style={{ marginTop: 24 }}>
            <p className="sim-note" style={{ marginBottom: 16 }}>
              Edição {resultado.edicao}
              {resultado.dataEdicao ? ` · ${resultado.dataEdicao}` : ""} — fonte:{" "}
              <a href={resultado.fonte} target="_blank" rel="noreferrer">
                {resultado.fonte}
              </a>
            </p>

            {resultado.encontrados.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                Nenhum dos números buscados aparece nesta edição — o que é esperado se o
                processo não teve nenhuma mudança de status nesta semana.
              </p>
            )}

            {resultado.encontrados.map((p) => (
              <div key={p.numero} className="helpbox" style={{ marginBottom: 14 }}>
                <h3>Processo {p.numero}</h3>
                {p.titulares.length > 0 && (
                  <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>
                    Titular: {p.titulares.map((t) => t.nomeRazaoSocial).join("; ")}
                  </p>
                )}
                <div className="rpi-log" style={{ marginTop: 8 }}>
                  {p.despachos.map((d, i) => (
                    <div className="log-row" key={i}>
                      <span className="date mono">{d.codigo}</span>
                      <span>{d.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {resultado.naoEncontrados.length > 0 && (
              <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                Não encontrados nesta edição: {resultado.naoEncontrados.join(", ")}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
