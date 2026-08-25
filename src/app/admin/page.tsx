"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Pagamento {
  id: string;
  tipo: string;
  valorCentavos: number;
  status: string;
  confirmadoEm: string | null;
  confirmadoVia: string | null;
}

interface Processo {
  id: string;
  marca: string;
  status: string;
  riscoPct: number | null;
  nclCode: string | null;
  monitoramento: boolean;
  protocolo: string | null;
  createdAt: string;
  cliente: { nome: string; whatsapp: string };
  pagamentos: Pagamento[];
}

function fmtReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  consulta: "Em consulta",
  resultado: "Resultado visto",
  plano: "Vendo plano",
  protocolado: "Protocolado",
};

/**
 * /admin — o "caderno de anotações": todo processo que já passou pela
 * análise, com os pagamentos ligados a ele. Sem login ainda (ver README,
 * item de persistência/contas) — não exponha esta rota publicamente antes
 * de colocar autenticação.
 */
export default function AdminPage() {
  const [processos, setProcessos] = useState<Processo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/processos");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha ao carregar.");
      setProcessos(body.processos);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
    }
  }

  // Carrega ao montar. Não chama `carregar()` direto — o lint do React
  // (set-state-in-effect) pede uma função assíncrona local, com uma flag de
  // cancelamento pra não atualizar o estado se o componente já tiver
  // desmontado quando a resposta chegar.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch("/api/processos");
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Falha ao carregar.");
        if (!cancelado) {
          setProcessos(body.processos);
          setErro(null);
        }
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Falha de rede.");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function confirmarPagamento(id: string) {
    setConfirmando(id);
    try {
      const res = await fetch(`/api/pagamentos/${id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ via: "whatsapp" }),
      });
      if (!res.ok) throw new Error("Falha ao confirmar.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao confirmar pagamento.");
    } finally {
      setConfirmando(null);
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="mark">MarcaSync</span>
          <span className="tag">caderno de anotações · interno</span>
        </div>
        <Link href="/" className="btn secondary">
          ← Voltar ao protótipo
        </Link>
      </div>

      <main className="panel">
        <div className="panel-head">
          <h2>Processos</h2>
          <p className="help">
            Sem tela pública, sem login — só pra você acompanhar quem consultou, em que
            passo está, e marcar pagamento como confirmado depois que o cliente avisar
            por WhatsApp.
          </p>
        </div>

        {erro && (
          <div className="helpbox" style={{ borderColor: "var(--risk)", marginBottom: 16 }}>
            <h3 style={{ color: "var(--risk)" }}>Erro</h3>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{erro}</p>
          </div>
        )}

        {processos === null && !erro && (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Carregando…</p>
        )}

        {processos?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Nenhum processo ainda — assim que alguém terminar uma análise no protótipo,
            aparece aqui.
          </p>
        )}

        {processos && processos.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Marca</th>
                  <th>Etapa</th>
                  <th>Risco</th>
                  <th>Pagamentos</th>
                </tr>
              </thead>
              <tbody>
                {processos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.cliente.nome}
                      <br />
                      <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                        {p.cliente.whatsapp}
                      </span>
                    </td>
                    <td>
                      {p.marca}
                      {p.protocolo && (
                        <>
                          <br />
                          <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                            protocolo {p.protocolo}
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      <span className="pill accent">{STATUS_LABEL[p.status] ?? p.status}</span>
                    </td>
                    <td className="tab-nums">{p.riscoPct != null ? `${p.riscoPct}%` : "—"}</td>
                    <td>
                      {p.pagamentos.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>—</span>
                      )}
                      {p.pagamentos.map((pg) => (
                        <div
                          key={pg.id}
                          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                        >
                          <span style={{ fontSize: 12.5 }}>
                            {pg.tipo === "setup" ? "Setup" : "Monitoramento"} — {fmtReais(pg.valorCentavos)}
                          </span>
                          {pg.status === "confirmado" ? (
                            <span className="pill safe">confirmado</span>
                          ) : (
                            <button
                              className="btn ghost"
                              style={{ padding: "3px 10px", fontSize: 11.5 }}
                              disabled={confirmando === pg.id}
                              onClick={() => confirmarPagamento(pg.id)}
                            >
                              {confirmando === pg.id ? "Confirmando…" : "Marcar como pago"}
                            </button>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
