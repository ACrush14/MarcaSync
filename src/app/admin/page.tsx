"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { linkParaCliente } from "@/lib/whatsapp";

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
  numeroProcesso: string | null;
  logoUrl: string | null;
  createdAt: string;
  cliente: { nome: string; whatsapp: string };
  pagamentos: Pagamento[];
}

interface Alerta {
  id: string;
  edicao: number;
  despachoCodigo: string;
  despachoNome: string;
  tipo: string;
  prazoAte: string | null;
  avisadoEm: string | null;
  processo: {
    marca: string;
    numeroProcesso: string | null;
    cliente: { nome: string; whatsapp: string };
  };
}

interface UltimaLeitura {
  edicao: number;
  lidaEm: string;
  verificados: number;
  encontrados: number;
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function mensagemAlerta(a: Alerta): string {
  const prazo = a.prazoAte ? ` Prazo estimado: ${fmtData(a.prazoAte)}.` : "";
  return (
    `Olá, ${a.processo.cliente.nome.split(" ")[0]}! Saiu uma movimentação no processo da marca ` +
    `${a.processo.marca} na RPI nº ${a.edicao}: ${a.despachoNome}.${prazo} ` +
    `Posso te explicar o que isso significa e o que fazer?`
  );
}

function fmtReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  consulta: "Em consulta",
  resultado: "Resultado visto",
  plano: "Vendo plano",
  contato: "Pediu contato",
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
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [ultimaLeitura, setUltimaLeitura] = useState<UltimaLeitura | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [numeros, setNumeros] = useState<Record<string, string>>({});
  const [salvandoNumero, setSalvandoNumero] = useState<string | null>(null);

  async function carregar() {
    try {
      const [res, resAlertas] = await Promise.all([
        fetch("/api/processos"),
        fetch("/api/admin/alertas"),
      ]);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha ao carregar.");
      setProcessos(body.processos);
      if (resAlertas.ok) {
        const a = await resAlertas.json();
        setAlertas(a.alertas);
        setUltimaLeitura(a.ultimaLeitura);
      }
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
    }
  }

  async function verificarRpi() {
    setVerificando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/admin/monitor", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha ao ler a RPI.");
      setAviso(
        body.situacao === "sem-processos"
          ? `RPI ${body.edicao}: nenhum processo monitorado ainda (preencha o nº do INPI e ligue o monitoramento).`
          : `RPI ${body.edicao}: ${body.verificados} processo(s) verificado(s), ${body.encontrados} com despacho, ${body.alertasNovos} alerta(s) novo(s).`
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao verificar a RPI.");
    } finally {
      setVerificando(false);
    }
  }

  async function marcarAvisado(id: string) {
    await fetch(`/api/admin/alertas/${id}`, { method: "POST" });
    await carregar();
  }

  async function salvarNumero(id: string) {
    setSalvandoNumero(id);
    try {
      const res = await fetch(`/api/admin/processos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroProcesso: numeros[id] ?? "" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha ao salvar.");
      setNumeros((n) => {
        const { [id]: _, ...resto } = n;
        return resto;
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o número.");
    } finally {
      setSalvandoNumero(null);
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
        const [res, resAlertas] = await Promise.all([
          fetch("/api/processos"),
          fetch("/api/admin/alertas"),
        ]);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Falha ao carregar.");
        const a = resAlertas.ok ? await resAlertas.json() : null;
        if (!cancelado) {
          setProcessos(body.processos);
          if (a) {
            setAlertas(a.alertas);
            setUltimaLeitura(a.ultimaLeitura);
          }
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
        <Link href="/consulta" className="btn secondary">
          ← Voltar ao protótipo
        </Link>
      </div>

      <main className="panel">
        <div className="panel-head">
          <h2>Processos</h2>
          <p className="help">
            Sem tela pública, sem login — só pra você acompanhar quem consultou, em que passo está,
            e marcar pagamento como confirmado depois que o cliente avisar por WhatsApp.
          </p>
        </div>

        {erro && (
          <div className="helpbox" style={{ borderColor: "var(--risk)", marginBottom: 16 }}>
            <h3 style={{ color: "var(--risk)" }}>Erro</h3>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{erro}</p>
          </div>
        )}

        <section aria-labelledby="alertas-titulo" style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <h3 id="alertas-titulo" style={{ margin: 0 }}>
              Alertas da RPI
            </h3>
            <button
              className="btn ghost"
              style={{ minHeight: 40, padding: "10px 14px", fontSize: 13 }}
              disabled={verificando}
              onClick={verificarRpi}
            >
              {verificando ? "Lendo a RPI… (pode levar um minuto)" : "Verificar RPI agora"}
            </button>
          </div>
          <p className="help" style={{ marginBottom: 12 }}>
            {ultimaLeitura
              ? `Última leitura automática: RPI ${ultimaLeitura.edicao}, em ${new Date(ultimaLeitura.lidaEm).toLocaleString("pt-BR")} (${ultimaLeitura.verificados} processo(s) verificado(s)). `
              : "Nenhuma edição lida ainda. "}
            A leitura roda sozinha todo dia; só entram processos com monitoramento ligado e nº do
            INPI preenchido abaixo.
          </p>
          <div role="status" aria-live="polite">
            {aviso && <p style={{ fontSize: 13, marginBottom: 12 }}>{aviso}</p>}
          </div>
          {alertas.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Nenhum alerta até agora.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {alertas.map((a) => {
                const href = linkParaCliente(a.processo.cliente.whatsapp, mensagemAlerta(a));
                return (
                  <li
                    key={a.id}
                    className="helpbox"
                    style={{ display: "grid", gap: 6, opacity: a.avisadoEm ? 0.65 : 1 }}
                  >
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <strong>{a.processo.marca}</strong>
                      <span style={{ fontSize: 12.5, color: "var(--ink-dim)" }}>
                        {a.processo.cliente.nome} · RPI {a.edicao}
                      </span>
                      {a.tipo === "oposicao" && <span className="pill risk">oposição</span>}
                      {a.avisadoEm && <span className="pill safe">avisado</span>}
                    </div>
                    <p style={{ fontSize: 13.5, margin: 0 }}>
                      {a.despachoNome}
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                        {" "}
                        ({a.despachoCodigo})
                      </span>
                    </p>
                    {a.prazoAte && (
                      <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: 0 }}>
                        Prazo estimado (60 dias da publicação):{" "}
                        <strong>{fmtData(a.prazoAte)}</strong> — confira na RPI.
                      </p>
                    )}
                    {!a.avisadoEm && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {href && (
                          <a
                            className="btn"
                            style={{ minHeight: 40, padding: "10px 14px", fontSize: 13 }}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => marcarAvisado(a.id)}
                          >
                            Avisar no WhatsApp →
                          </a>
                        )}
                        <button
                          className="btn ghost"
                          style={{ minHeight: 40, padding: "10px 14px", fontSize: 13 }}
                          onClick={() => marcarAvisado(a.id)}
                        >
                          Marcar como avisado
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {processos === null && !erro && (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Carregando…</p>
        )}

        {processos?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Nenhum processo ainda — assim que alguém terminar uma análise no protótipo, aparece
            aqui.
          </p>
        )}

        {processos && processos.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Marca</th>
                  <th>Logotipo</th>
                  <th>Etapa</th>
                  <th>Nº no INPI</th>
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
                          <span
                            className="mono"
                            style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                          >
                            protocolo {p.protocolo}
                          </span>
                        </>
                      )}
                    </td>
                    <td>
                      {p.logoUrl ? (
                        <a href={p.logoUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Blob), next/image não se aplica */}
                          <img
                            src={p.logoUrl}
                            alt={`Logotipo de ${p.marca}`}
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: "contain",
                              borderRadius: 6,
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                            }}
                          />
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="pill accent">{STATUS_LABEL[p.status] ?? p.status}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <label className="sr-only" htmlFor={`num-${p.id}`}>
                          Número do processo no INPI — {p.marca}
                        </label>
                        <input
                          id={`num-${p.id}`}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="9 dígitos"
                          value={numeros[p.id] ?? p.numeroProcesso ?? ""}
                          onChange={(e) => setNumeros((n) => ({ ...n, [p.id]: e.target.value }))}
                          style={{ width: 120, minHeight: 40 }}
                        />
                        {p.id in numeros && numeros[p.id] !== (p.numeroProcesso ?? "") && (
                          <button
                            className="btn ghost"
                            style={{ minHeight: 40, padding: "10px 14px", fontSize: 13 }}
                            disabled={salvandoNumero === p.id}
                            onClick={() => salvarNumero(p.id)}
                          >
                            {salvandoNumero === p.id ? "Salvando…" : "Salvar"}
                          </button>
                        )}
                      </div>
                      {p.monitoramento ? (
                        <span className="pill safe" style={{ marginTop: 4 }}>
                          monitorando
                        </span>
                      ) : null}
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
                            {pg.tipo === "setup" ? "Setup" : "Monitoramento"} —{" "}
                            {fmtReais(pg.valorCentavos)}
                          </span>
                          {pg.status === "confirmado" ? (
                            <span className="pill safe">confirmado</span>
                          ) : (
                            <button
                              className="btn ghost"
                              // 44px de altura visual — abaixo disso é
                              // difícil de acertar no toque do celular,
                              // e essa é a ação que você mais vai usar lá.
                              style={{ padding: "10px 14px", fontSize: 13, minHeight: 40 }}
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
