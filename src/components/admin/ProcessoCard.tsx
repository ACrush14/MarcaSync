"use client";

import { Fragment } from "react";
import AcompanhamentoLead from "@/components/AcompanhamentoLead";
import ProtocoloAdmin from "@/components/ProtocoloAdmin";
import { modoDoMonitoramento, podeIrParaMensal } from "@/lib/cadencia";
import { situacaoDoContato } from "@/lib/acompanhamento";
import {
  ROTULO_PAGAMENTO_RESUMO,
  fmtDataHora,
  haQuanto,
  linhasDeDatas,
  situacaoDoPagamento,
} from "@/lib/admin-dados";
import { descreverSituacao } from "@/lib/situacoes-inpi";
import { fmtReais } from "@/lib/planos";
import { linkParaCliente } from "@/lib/whatsapp";
import PedidoDetalhe from "./PedidoDetalhe";
import type { Processo } from "./tipos";

export const STATUS_LABEL: Record<string, string> = {
  consulta: "Em consulta",
  resultado: "Resultado visto",
  plano: "Vendo plano",
  pedido: "Dados do pedido enviados",
  contato: "Pediu contato",
  protocolado: "Protocolado",
};

const ROTULO_PAGAMENTO: Record<string, string> = {
  pacote: "Serviço + taxa do INPI",
  setup: "Setup",
  gru: "Taxa do INPI (GRU)",
  monitoramento: "Monitoramento",
};

export function jaPagouServico(p: Processo): boolean {
  return p.pagamentos.some(
    (g) => (g.tipo === "pacote" || g.tipo === "setup") && g.status === "confirmado"
  );
}

const BOTAO_PEQUENO = { padding: "6px 12px", fontSize: 12, minHeight: 32 } as const;

/** A última conferência da GRU feita pelo robô (só leitura: o robô não gera boleto nem paga). */
function ConferenciaDoRobo({ p }: { p: Processo }) {
  const c = p.conferenciasGru?.[0];
  if (!c) return null;
  const quando = new Date(c.createdAt).toLocaleString("pt-BR");
  const classe = c.resultado === "ok" ? "pill safe" : c.resultado === "divergente" ? "pill risk" : "pill warm";
  const texto =
    c.resultado === "ok"
      ? `GRU conferida pelo robô: ${fmtReais(c.lidoCentavos ?? 0)}`
      : c.resultado === "divergente"
        ? `GRU diferente: o e-INPI mostrou ${fmtReais(c.lidoCentavos ?? 0)}, o cliente pagou ${fmtReais(c.esperadoCentavos)}`
        : `Robô não conseguiu conferir${c.detalhe ? `: ${c.detalhe}` : ""}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
      <span className={classe}>{texto}</span>
      <span className="help" style={{ fontSize: 12 }}>
        {quando}
      </span>
    </div>
  );
}

/** Os ganchos do painel que o cartão chama; quem muda o banco continua sendo a página. */
export interface AcoesDoCartao {
  confirmando: string | null;
  salvandoNumero: boolean;
  /** O número do INPI digitado e ainda não salvo (undefined = nada editado). */
  numeroEditado: string | undefined;
  onNumero: (valor: string) => void;
  onSalvarNumero: () => void;
  onConfirmarPagamento: (pagamentoId: string) => void;
  onEstornar: (pagamentoId: string, rotulo: string) => void;
  onDevolucao: (pagamentoId: string, centavos: number) => void;
  onGruPaga: () => void;
  onCadencia: (modo: "mensal" | "semanal") => void;
  onMudou: () => void;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ minWidth: 0 }}>
      <h4
        style={{
          fontSize: 11.5,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--ink-faint)",
          margin: "0 0 8px",
        }}
      >
        {titulo}
      </h4>
      {children}
    </section>
  );
}

function ListaDeDados({ linhas, rotulo }: { linhas: Array<[string, string]>; rotulo: string }) {
  return (
    <dl
      aria-label={rotulo}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(110px, 175px) 1fr",
        gap: "4px 10px",
        fontSize: 12.5,
        margin: 0,
      }}
    >
      {linhas.map(([nome, valor]) => (
        <Fragment key={nome}>
          <dt style={{ color: "var(--ink-dim)" }}>{nome}</dt>
          <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{valor}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Tudo sobre uma pessoa e o pedido dela num cartão só: quando chegou, em que ponto está, o
 * pagamento, o acompanhamento do contato, o monitoramento e, aberto, todos os dados do titular e
 * da marca para o INPI.
 */
export default function ProcessoCard({
  p,
  acoes,
  aberto,
}: {
  p: Processo;
  acoes: AcoesDoCartao;
  aberto: boolean;
}) {
  const a = acoes;
  const pagamento = situacaoDoPagamento(p.pagamentos);
  const contato = situacaoDoContato(p, new Date(), jaPagouServico(p));
  const modo = modoDoMonitoramento({ monitoramentoMensalDesde: p.monitoramentoMensalDesde ?? null });
  const mensalOk = podeIrParaMensal({ protocoladoEm: p.protocoladoEm, numeroProcesso: p.numeroProcesso }).ok;
  const wa = linkParaCliente(p.cliente.whatsapp, `Olá, ${p.cliente.nome.split(" ")[0]}! Aqui é do MarcaSync, sobre a sua marca ${p.marca}.`);
  const email = p.pedidoRegistro?.email ?? p.cliente.email ?? null;
  const nomeDoTitular = p.pedidoRegistro && p.pedidoRegistro.nome !== p.cliente.nome ? p.pedidoRegistro.nome : null;

  return (
    <article
      className="helpbox"
      aria-label={`${p.marca}, ${p.cliente.nome}`}
      style={{ display: "grid", gap: 14, padding: 16, marginBottom: 14, overflowWrap: "anywhere", minWidth: 0 }}
    >
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {p.logoUrl && (
          <a href={p.logoUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Blob), next/image não se aplica */}
            <img
              src={p.logoUrl}
              alt={`Logotipo de ${p.marca}`}
              style={{
                width: 48,
                height: 48,
                objectFit: "contain",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            />
          </a>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ margin: 0, fontSize: 17, overflowWrap: "anywhere" }}>{p.marca}</h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, overflowWrap: "anywhere" }}>
            {p.cliente.nome}
            {nomeDoTitular ? ` (titular: ${nomeDoTitular})` : ""} ·{" "}
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer">
                {p.cliente.whatsapp}
              </a>
            ) : (
              p.cliente.whatsapp
            )}
            {email ? ` · ${email}` : ""}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-dim)" }}>
            Deixou o contato em <strong>{fmtDataHora(p.createdAt)}</strong> ({haQuanto(p.createdAt)})
            {" · "}última atividade em {fmtDataHora(p.updatedAt ?? p.createdAt)}
            {p.updatedAt ? ` (${haQuanto(p.updatedAt)})` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="pill accent">{STATUS_LABEL[p.status] ?? p.status}</span>
          <span className={pagamento === "pago" ? "pill safe" : pagamento === "estornado" ? "pill warm" : "pill"}>
            {ROTULO_PAGAMENTO_RESUMO[pagamento]}
          </span>
          {contato === "atrasado" && <span className="pill warm">contato atrasado</span>}
          {contato === "hoje" && <span className="pill warm">falar hoje</span>}
          {p.riscoPct != null && <span className="pill">risco {p.riscoPct}%</span>}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          alignItems: "start",
        }}
      >
        <Secao titulo="Quando">
          <ListaDeDados linhas={linhasDeDatas(p)} rotulo={`Datas de ${p.marca}`} />
        </Secao>

        <Secao titulo="Acompanhamento do contato">
          <AcompanhamentoLead
            processoId={p.id}
            marca={p.marca}
            acompanhamento={p}
            jaPagou={jaPagouServico(p)}
            onSalvo={a.onMudou}
          />
        </Secao>

        <Secao titulo="Pagamento">
          {p.pagamentos.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0 }}>Nenhuma cobrança ainda.</p>
          )}
          {p.pagamentos.map((pg) => (
            <div
              key={pg.id}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}
            >
              <span style={{ fontSize: 12.5 }}>
                {ROTULO_PAGAMENTO[pg.tipo] ?? pg.tipo} — {fmtReais(pg.valorCentavos)}
              </span>
              {pg.status === "confirmado" ? (
                <>
                  <span className="pill safe">
                    confirmado{pg.confirmadoVia === "abacatepay" ? " (AbacatePay)" : ""}
                  </span>
                  {pg.confirmadoVia === "abacatepay" && (
                    <button
                      className="btn ghost"
                      style={BOTAO_PEQUENO}
                      disabled={a.confirmando === pg.id}
                      onClick={() => a.onEstornar(pg.id, ROTULO_PAGAMENTO[pg.tipo] ?? pg.tipo)}
                    >
                      {a.confirmando === pg.id ? "Estornando…" : "Estornar"}
                    </button>
                  )}
                  {pg.tipo === "pacote" && p.gruPagaInpiEm && <span className="pill">taxa paga ao INPI</span>}
                  {pg.tipo === "pacote" && !p.gruPagaInpiEm && !p.protocoladoEm && (
                    <button
                      className="btn ghost"
                      style={BOTAO_PEQUENO}
                      disabled={a.confirmando === p.id}
                      onClick={a.onGruPaga}
                    >
                      Paguei a taxa ao INPI
                    </button>
                  )}
                  {pg.tipo === "pacote" && (pg.devolvidoCentavos ?? 0) > 0 && (
                    <span className="pill warm">devolvido à mão: {fmtReais(pg.devolvidoCentavos ?? 0)}</span>
                  )}
                  {pg.tipo === "pacote" &&
                    p.gruPagaInpiEm &&
                    !p.protocoladoEm &&
                    (pg.devolvidoCentavos ?? 0) === 0 &&
                    p.pedidoRegistro && (
                      <button
                        className="btn ghost"
                        style={BOTAO_PEQUENO}
                        disabled={a.confirmando === pg.id}
                        title="A taxa já foi paga ao INPI: só o serviço volta, por Pix seu"
                        onClick={() => a.onDevolucao(pg.id, p.pedidoRegistro?.servicoCentavos ?? 0)}
                      >
                        Registrei a devolução do serviço ({fmtReais(p.pedidoRegistro.servicoCentavos)})
                      </button>
                    )}
                </>
              ) : pg.status === "estornado" ? (
                <span className="pill warm">estornado</span>
              ) : (
                <button
                  className="btn ghost"
                  // 40px de altura: abaixo disso é difícil de acertar no toque do celular.
                  style={{ padding: "10px 14px", fontSize: 13, minHeight: 40 }}
                  disabled={a.confirmando === pg.id}
                  onClick={() => a.onConfirmarPagamento(pg.id)}
                >
                  {a.confirmando === pg.id ? "Confirmando…" : "Marcar como pago (reserva)"}
                </button>
              )}
            </div>
          ))}
          <ConferenciaDoRobo p={p} />
        </Secao>

        <Secao titulo="INPI e monitoramento">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <label className="sr-only" htmlFor={`num-${p.id}`}>
              Número do processo no INPI — {p.marca}
            </label>
            <input
              id={`num-${p.id}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Nº no INPI (9 dígitos)"
              value={a.numeroEditado ?? p.numeroProcesso ?? ""}
              onChange={(e) => a.onNumero(e.target.value)}
              style={{ width: 170, minHeight: 40 }}
            />
            {a.numeroEditado !== undefined && a.numeroEditado !== (p.numeroProcesso ?? "") && (
              <button
                className="btn ghost"
                style={{ minHeight: 40, padding: "10px 14px", fontSize: 13 }}
                disabled={a.salvandoNumero}
                onClick={a.onSalvarNumero}
              >
                {a.salvandoNumero ? "Salvando…" : "Salvar"}
              </button>
            )}
          </div>
          <div style={{ margin: "8px 0", fontSize: 12.5 }}>
            {p.situacaoInpi ? (
              <>
                Situação no INPI: <strong>{descreverSituacao(p.situacaoInpi)}</strong>{" "}
                <span className="mono" style={{ color: "var(--ink-faint)" }}>({p.situacaoInpi})</span>
              </>
            ) : (
              <span style={{ color: "var(--ink-dim)" }}>Situação no INPI: ainda não lida.</span>
            )}
            {(p.situacoes?.length ?? 0) > 1 && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer" }}>Histórico de situações ({p.situacoes?.length})</summary>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {p.situacoes?.map((s) => (
                    <li key={s.id}>
                      {fmtDataHora(s.vistaEm)}: {descreverSituacao(s.situacao)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {(p._count?.alertas ?? 0) > 0 && (
              <div style={{ color: "var(--ink-dim)" }}>Alertas da RPI: {p._count?.alertas}</div>
            )}
          </div>
          {p.monitoramento ? (
            <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
              <span className="pill safe">monitorando ({modo})</span>
              {modo === "semanal" ? (
                <button
                  className="btn ghost"
                  style={BOTAO_PEQUENO}
                  disabled={a.confirmando === p.id || !mensalOk}
                  title={
                    mensalOk
                      ? "Está tudo certo com o protocolo: monitorar uma vez por mês"
                      : "Só depois de protocolar e preencher o número do INPI"
                  }
                  onClick={() => a.onCadencia("mensal")}
                >
                  Protocolo OK: passar para mensal
                </button>
              ) : (
                <button
                  className="btn ghost"
                  style={BOTAO_PEQUENO}
                  disabled={a.confirmando === p.id}
                  onClick={() => a.onCadencia("semanal")}
                >
                  Voltar para semanal
                </button>
              )}
            </div>
          ) : (
            <span className="pill">sem monitoramento</span>
          )}
        </Secao>
      </div>

      {p.pedidoRegistro ? (
        <div>
          <PedidoDetalhe
            pedido={p.pedidoRegistro}
            processoId={p.id}
            prontidao={p.prontidao}
            temImagem={p.imagemMarca !== null}
            marca={p.marca}
            rotulo="Dados completos do titular e da marca (para o INPI)"
            aberto={aberto}
          />
          <ProtocoloAdmin
            processoId={p.id}
            numeroProcesso={p.numeroProcesso}
            protocoladoEm={p.protocoladoEm}
            prazos={p.prazos}
            recibo={p.reciboProtocolo}
            onMudou={a.onMudou}
          />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-dim)" }}>
          Ainda não preencheu os dados do pedido
          {p.descricao ? `. Disse que vai usar a marca para: ${p.descricao.slice(0, 300)}${p.descricao.length > 300 ? "…" : ""}` : "."}
          {p.nclCode ? ` Classe sugerida: ${p.nclCode}${p.nclLabel ? ` (${p.nclLabel})` : ""}.` : ""}
        </p>
      )}

      {(p.avisos?.length ?? 0) > 0 && (
        <details open={aberto} key={aberto ? "a" : "f"}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Avisos do sistema sobre este pedido ({p.avisos?.length})
          </summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {p.avisos?.map((v) => (
              <li key={v.id}>
                {fmtDataHora(v.createdAt)}: <b>{v.assunto}</b> (para {v.destino === "cliente" ? "o cliente" : "você"},{" "}
                {v.canal === "painel" ? "só no painel" : v.erro ? `${v.canal}: falhou` : `${v.canal}: enviado`})
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
