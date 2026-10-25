"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { linkParaCliente } from "@/lib/whatsapp";
import { camposEmarcas } from "@/lib/campos-emarcas";
import type { Prontidao } from "@/lib/prontidao";
import ProtocoloAdmin, { type PrazoAdmin } from "@/components/ProtocoloAdmin";
import AcompanhamentoLead from "@/components/AcompanhamentoLead";
import { modoDoMonitoramento, podeIrParaMensal } from "@/lib/cadencia";
import {
  ROTULO_INTERESSE,
  contar,
  precisaContatar,
  type Interesse,
} from "@/lib/acompanhamento";

interface Pagamento {
  id: string;
  tipo: string;
  valorCentavos: number;
  devolvidoCentavos?: number;
  status: string;
  confirmadoEm: string | null;
  confirmadoVia: string | null;
}

interface PedidoRegistro {
  tipoRequerente: string;
  regime: string;
  participaEmpresaDoRamo: boolean;
  nome: string;
  documento: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  apresentacao: string;
  elementoNominativo: string | null;
  classeNice: string;
  especificacao: string;
  especificacaoItens: string[];
  especificacaoLivre: boolean;
  palavraEstrangeira: boolean;
  traducao: string | null;
  cienteAnterioridade: boolean;
  atividade: string;
  servicoCentavos: number;
  gruCentavos: number;
  gruComDesconto: boolean;
  aceitoEm: string;
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
  monitoramentoMensalDesde?: string | null;
  gruPagaInpiEm?: string | null;
  logoUrl: string | null;
  createdAt: string;
  interesse: string;
  proximoContatoEm: string | null;
  ultimoContatoEm: string | null;
  anotacoes: string | null;
  cliente: { nome: string; whatsapp: string };
  pagamentos: Pagamento[];
  pedidoRegistro: PedidoRegistro | null;
  protocoladoEm: string | null;
  prazos: PrazoAdmin[];
  reciboProtocolo: { nomeArquivo: string; tamanho: number } | null;
  imagemMarca: { largura: number; altura: number; ampliada: boolean } | null;
  prontidao: Prontidao | null;
}

interface AvisoSistema {
  id: string;
  destino: string;
  canal: string;
  assunto: string;
  texto: string;
  enviadaEm: string | null;
  erro: string | null;
  createdAt: string;
}

interface Alerta {
  id: string;
  edicao: number | null;
  despachoCodigo: string | null;
  despachoNome: string | null;
  tipo: string;
  origem: string;
  situacaoNova: string | null;
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
  if (a.tipo === "situacao") {
    return (
      `Olá, ${a.processo.cliente.nome.split(" ")[0]}! A situação do processo da marca ` +
      `${a.processo.marca} mudou para: ${a.situacaoNova}. ` +
      `Posso te explicar o que isso significa?`
    );
  }
  const prazo = a.prazoAte ? ` Prazo estimado: ${fmtData(a.prazoAte)}.` : "";
  return (
    `Olá, ${a.processo.cliente.nome.split(" ")[0]}! Saiu uma movimentação no processo da marca ` +
    `${a.processo.marca} na RPI nº ${a.edicao}: ${a.despachoNome}.${prazo} ` +
    `Posso te explicar o que isso significa e o que fazer?`
  );
}

const ROTULO_PAGAMENTO: Record<string, string> = {
  pacote: "Serviço + taxa do INPI",
  setup: "Setup",
  gru: "Taxa do INPI (GRU)",
  monitoramento: "Monitoramento",
};

/** CPF (11 dígitos) ou CNPJ (14) com máscara, só para ler na tela. */
function fmtDocumento(d: string): string {
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return d;
}

function fmtReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Os dados do pedido de registro, na ordem em que o e-Marcas os pede (Manual de Marcas do
 * INPI, itens 3.1 e 3.5.2), para você conferir e copiar na hora de emitir a GRU e protocolar.
 * Só aparece aqui, na área com senha: CPF/CNPJ e endereço não saem desta tela.
 */
function PedidoDetalhe({
  pedido: d,
  processoId,
  prontidao,
  temImagem,
  marca,
  rotulo,
}: {
  pedido: PedidoRegistro;
  processoId: string;
  prontidao: Prontidao | null;
  temImagem: boolean;
  marca: string;
  rotulo: string;
}) {
  const linhas: Array<[string, string]> = [
    ...camposEmarcas(d).map(([nome, valor]): [string, string] => [
      nome,
      nome === "CPF/CNPJ"
        ? fmtDocumento(d.documento)
        : (valor ?? "— (não se aplica a este pedido)"),
    ]),
    ["Itens da especificação", d.especificacaoItens.join(" | ")],
    ["Complemento", d.complemento ?? "—"],
    [
      "GRU a emitir",
      `serviço ${d.especificacaoLivre ? "394 (especificação livre)" : "389 (especificação pré-aprovada)"}, ${fmtReais(d.gruCentavos)}${d.gruComDesconto ? " (com 50% de desconto)" : ""}; confirme o valor na tela de emissão`,
    ],
    ["Serviço MarcaSync", fmtReais(d.servicoCentavos)],
    ["Aceites dados em", new Date(d.aceitoEm).toLocaleString("pt-BR")],
  ];
  return (
    <details style={{ margin: "4px 0 8px" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{rotulo}</summary>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "190px 1fr",
          gap: "4px 12px",
          fontSize: 12.5,
          marginTop: 8,
        }}
        aria-label={`Dados do pedido da marca ${marca}`}
      >
        {linhas.map(([nome, valor]) => (
          <Fragment key={nome}>
            <dt style={{ color: "var(--ink-dim)" }}>{nome}</dt>
            <dd style={{ margin: 0 }}>{valor}</dd>
          </Fragment>
        ))}
      </dl>
      {temImagem && (
        <p style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          Imagem da marca:{" "}
          <a href={`/api/processos/${processoId}/imagem`} target="_blank" rel="noreferrer">
            JPG pronto para o e-Marcas
          </a>
          {" · "}
          <a
            href={`/api/processos/${processoId}/imagem?tipo=original`}
            target="_blank"
            rel="noreferrer"
          >
            arquivo original
          </a>
        </p>
      )}
      <p style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 4px" }}>
        {prontidao?.pronto ? "Pronto para protocolar" : "Antes de protocolar"}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
        {(prontidao?.itens ?? []).map((i) => (
          <li key={i.id} style={{ marginBottom: 3 }}>
            <strong>
              {i.estado === "ok" ? "✓" : i.estado === "atencao" ? "Conferir:" : "Falta:"} {i.titulo}
            </strong>
            {i.estado !== "ok" && (
              <span style={{ color: "var(--ink-dim)" }}>
                {" "}
                ({i.quem === "cliente" ? "cliente" : "você"}) {i.detalhe}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const STATUS_LABEL: Record<string, string> = {
  consulta: "Em consulta",
  resultado: "Resultado visto",
  plano: "Vendo plano",
  pedido: "Dados do pedido enviados",
  contato: "Pediu contato",
  protocolado: "Protocolado",
};

/**
 * /admin — o "caderno de anotações": todo processo que já passou pela
 * análise, com os pagamentos ligados a ele. Sem login ainda (ver README,
 * item de persistência/contas) — não exponha esta rota publicamente antes
 * de colocar autenticação.
 */
function jaPagouServico(p: Processo): boolean {
  return p.pagamentos.some((g) => g.tipo === "setup" && g.status === "confirmado");
}

function passaNoFiltro(p: Processo, filtro: "todos" | "hoje" | Interesse): boolean {
  if (filtro === "todos") return true;
  if (filtro === "hoje") return precisaContatar(p, new Date(), jaPagouServico(p));
  return p.interesse === filtro;
}

/** Os números de quem está interessado e de quem precisa de contato, que também filtram a tabela. */
function FiltroAcompanhamento({
  processos,
  filtro,
  onFiltro,
}: {
  processos: Processo[];
  filtro: "todos" | "hoje" | Interesse;
  onFiltro: (f: "todos" | "hoje" | Interesse) => void;
}) {
  const c = contar(processos.map((p) => ({ ...p, jaPagou: jaPagouServico(p) })));
  const opcoes: Array<{ id: "todos" | "hoje" | Interesse; texto: string; n: number }> = [
    { id: "todos", texto: "Todos", n: c.total },
    { id: "hoje", texto: "Falar hoje", n: c.paraContatarHoje },
    { id: "interessado", texto: ROTULO_INTERESSE.interessado, n: c.porInteresse.interessado },
    { id: "acompanhar", texto: ROTULO_INTERESSE.acompanhar, n: c.porInteresse.acompanhar },
    { id: "novo", texto: ROTULO_INTERESSE.novo, n: c.porInteresse.novo },
    { id: "sem_interesse", texto: ROTULO_INTERESSE.sem_interesse, n: c.porInteresse.sem_interesse },
  ];
  return (
    <section aria-label="Acompanhamento dos contatos" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            className={filtro === o.id ? "btn" : "btn ghost"}
            style={{ padding: "8px 14px", fontSize: 13, minHeight: 40 }}
            aria-pressed={filtro === o.id}
            onClick={() => onFiltro(o.id)}
          >
            {o.texto} ({o.n})
          </button>
        ))}
      </div>
      {c.semData > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "8px 0 0" }}>
          {c.semData} pessoa{c.semData > 1 ? "s" : ""} interessada{c.semData > 1 ? "s" : ""} ou a
          acompanhar sem data para falar de novo: marque uma data para não esquecer.
        </p>
      )}
    </section>
  );
}

export default function AdminPage() {
  const [processos, setProcessos] = useState<Processo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [avisosSistema, setAvisosSistema] = useState<AvisoSistema[]>([]);
  const [testandoAviso, setTestandoAviso] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<string | null>(null);
  const [ultimaLeitura, setUltimaLeitura] = useState<UltimaLeitura | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [numeros, setNumeros] = useState<Record<string, string>>({});
  const [salvandoNumero, setSalvandoNumero] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "hoje" | Interesse>("todos");

  async function carregar() {
    try {
      const [res, resAlertas, resAvisos] = await Promise.all([
        fetch("/api/processos"),
        fetch("/api/admin/alertas"),
        fetch("/api/admin/notificacoes"),
      ]);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha ao carregar.");
      setProcessos(body.processos);
      if (resAvisos.ok) setAvisosSistema((await resAvisos.json()).avisos);
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

  /** Manda um aviso de teste para você e mostra o resultado de cada canal ligado. */
  async function enviarAvisoTeste() {
    setTestandoAviso(true);
    setResultadoTeste(null);
    try {
      const res = await fetch("/api/admin/notificacoes/teste", { method: "POST" });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao enviar o teste.");
      const lista = (corpo.resultados ?? []) as Array<{
        canal: string;
        enviado: boolean;
        erro: string | null;
      }>;
      setResultadoTeste(
        lista
          .map((r) =>
            r.canal === "painel"
              ? "nenhum canal de envio está ligado (o aviso ficou só no painel)"
              : r.enviado
                ? `${r.canal}: enviado, confira o seu aparelho`
                : `${r.canal}: falhou (${r.erro ?? "erro"})`
          )
          .join(" · ") || "sem resposta"
      );
      await carregar();
    } catch (e) {
      setResultadoTeste(e instanceof Error ? e.message : "Falha ao enviar o teste.");
    } finally {
      setTestandoAviso(false);
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
        const [res, resAlertas, resAvisos] = await Promise.all([
          fetch("/api/processos"),
          fetch("/api/admin/alertas"),
          fetch("/api/admin/notificacoes"),
        ]);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Falha ao carregar.");
        const a = resAlertas.ok ? await resAlertas.json() : null;
        const av = resAvisos.ok ? await resAvisos.json() : null;
        if (!cancelado) {
          setProcessos(body.processos);
          if (av) setAvisosSistema(av.avisos);
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

  /** Marca que a taxa do INPI (GRU) deste pedido já foi paga ao INPI: a partir daí ela não volta. */
  async function marcarGruPaga(id: string, marca: string) {
    if (
      !window.confirm(
        `Confirme só DEPOIS de ter pago a GRU de "${marca}" ao INPI. Daqui para frente, se o pedido não for protocolado, só o valor do serviço volta para o cliente.`
      )
    )
      return;
    setConfirmando(id);
    try {
      const res = await fetch(`/api/admin/processos/${id}/gru-paga`, { method: "POST" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error ?? "Falha ao marcar a taxa como paga.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao marcar a taxa como paga.");
    } finally {
      setConfirmando(null);
    }
  }

  /** Anota que você devolveu o valor do serviço por Pix (o AbacatePay não estorna só uma parte). */
  async function registrarDevolucao(id: string, centavos: number) {
    if (
      !window.confirm(
        `Confirme só DEPOIS de ter feito o Pix de ${fmtReais(centavos)} para o cliente. Isto apenas registra a devolução no painel; não move dinheiro.`
      )
    )
      return;
    setConfirmando(id);
    try {
      const res = await fetch(`/api/admin/pagamentos/${id}/devolucao-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centavos, nota: "Pix feito por fora" }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error ?? "Falha ao registrar a devolução.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar a devolução.");
    } finally {
      setConfirmando(null);
    }
  }

  /**
   * Estorna um pagamento feito pelo AbacatePay. O servidor aplica a regra de devolução (antes de
   * pagar a GRU ao INPI volta tudo; depois, só o serviço; após o protocolo, nada). Se a regra
   * recusar, você pode forçar, e isso fica registrado nas notas do pagamento.
   */
  /** Troca a frequência do monitoramento: mensal depois que o protocolo está certo, ou volta a semanal. */
  async function mudarCadencia(id: string, modo: "mensal" | "semanal") {
    setConfirmando(id);
    try {
      const res = await fetch(`/api/admin/processos/${id}/cadencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error ?? "Falha ao mudar a frequência.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao mudar a frequência.");
    } finally {
      setConfirmando(null);
    }
  }

  async function estornarPagamento(id: string, rotulo: string) {
    const motivo = window.prompt(
      `Estornar "${rotulo}". Motivo (vai para o histórico):`,
      "pedido cancelado"
    );
    if (motivo === null) return;
    setConfirmando(id);
    try {
      let forcar = false;
      for (;;) {
        const res = await fetch(`/api/admin/pagamentos/${id}/estornar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo, forcar }),
        });
        const corpo = await res.json().catch(() => ({}));
        if (res.ok) break;
        if (res.status === 409 && !forcar && String(corpo.error).startsWith("A regra")) {
          if (
            !window.confirm(`${corpo.error}

Estornar mesmo assim?`)
          )
            return;
          forcar = true;
          continue;
        }
        throw new Error(corpo.error ?? "Falha ao estornar.");
      }
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao estornar.");
    } finally {
      setConfirmando(null);
    }
  }

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
                        {a.processo.cliente.nome} ·{" "}
                        {a.origem === "consulta" ? " consulta direta" : `RPI ${a.edicao}`}
                      </span>
                      {a.tipo === "oposicao" && <span className="pill risk">oposição</span>}
                      {a.tipo === "situacao" && <span className="pill">mudou de situação</span>}
                      {a.avisadoEm && <span className="pill safe">avisado</span>}
                    </div>
                    <p style={{ fontSize: 13.5, margin: 0 }}>
                      {a.tipo === "situacao" ? (
                        <>
                          Nova situação: <strong>{a.situacaoNova}</strong>
                        </>
                      ) : (
                        <>
                          {a.despachoNome}
                          <span
                            className="mono"
                            style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                          >
                            {" "}
                            ({a.despachoCodigo})
                          </span>
                        </>
                      )}
                    </p>{" "}
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
          <FiltroAcompanhamento processos={processos} filtro={filtro} onFiltro={setFiltro} />
        )}

        {processos && processos.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Marca</th>
                  <th>Acompanhamento</th>
                  <th>Logotipo</th>
                  <th>Etapa</th>
                  <th>Nº no INPI</th>
                  <th>Risco</th>
                  <th>Pagamentos</th>
                </tr>
              </thead>
              <tbody>
                {processos.filter((p) => passaNoFiltro(p, filtro)).map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td className="celula-texto">
                        {p.cliente.nome}
                        <br />
                        <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                          {p.cliente.whatsapp}
                        </span>
                      </td>
                      <td className="celula-texto">
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
                      <td className="celula-texto celula-larga">
                        <AcompanhamentoLead
                          processoId={p.id}
                          marca={p.marca}
                          acompanhamento={p}
                          jaPagou={jaPagouServico(p)}
                          onSalvo={carregar}
                        />
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
                          <div style={{ marginTop: 4, display: "grid", gap: 6 }}>
                            <span className="pill safe">
                              monitorando ({modoDoMonitoramento({ monitoramentoMensalDesde: p.monitoramentoMensalDesde ?? null })})
                            </span>
                            {modoDoMonitoramento({ monitoramentoMensalDesde: p.monitoramentoMensalDesde ?? null }) === "semanal" ? (
                              <button
                                className="btn ghost"
                                style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}
                                disabled={
                                  confirmando === p.id ||
                                  !podeIrParaMensal({
                                    protocoladoEm: p.protocoladoEm,
                                    numeroProcesso: p.numeroProcesso,
                                  }).ok
                                }
                                title={
                                  podeIrParaMensal({
                                    protocoladoEm: p.protocoladoEm,
                                    numeroProcesso: p.numeroProcesso,
                                  }).ok
                                    ? "Está tudo certo com o protocolo: monitorar uma vez por mês"
                                    : "Só depois de protocolar e preencher o número do INPI"
                                }
                                onClick={() => mudarCadencia(p.id, "mensal")}
                              >
                                Protocolo OK: passar para mensal
                              </button>
                            ) : (
                              <button
                                className="btn ghost"
                                style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}
                                disabled={confirmando === p.id}
                                onClick={() => mudarCadencia(p.id, "semanal")}
                              >
                                Voltar para semanal
                              </button>
                            )}
                          </div>
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
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontSize: 12.5 }}>
                              {ROTULO_PAGAMENTO[pg.tipo] ?? pg.tipo} — {fmtReais(pg.valorCentavos)}
                            </span>
                            {pg.status === "confirmado" ? (
                              <>
                                <span className="pill safe">
                                  confirmado{pg.confirmadoVia === "abacatepay" ? " (Pix)" : ""}
                                </span>
                                {pg.confirmadoVia === "abacatepay" && (
                                  <button
                                    className="btn ghost"
                                    style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}
                                    disabled={confirmando === pg.id}
                                    onClick={() =>
                                      estornarPagamento(pg.id, ROTULO_PAGAMENTO[pg.tipo] ?? pg.tipo)
                                    }
                                  >
                                    {confirmando === pg.id ? "Estornando…" : "Estornar"}
                                  </button>
                                )}
                                {pg.tipo === "pacote" && p.gruPagaInpiEm && (
                                  <span className="pill">taxa paga ao INPI</span>
                                )}
                                {pg.tipo === "pacote" && !p.gruPagaInpiEm && !p.protocoladoEm && (
                                  <button
                                    className="btn ghost"
                                    style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}
                                    disabled={confirmando === p.id}
                                    onClick={() => marcarGruPaga(p.id, p.marca)}
                                  >
                                    Paguei a taxa ao INPI
                                  </button>
                                )}
                                {pg.tipo === "pacote" &&
                                  (pg.devolvidoCentavos ?? 0) > 0 && (
                                    <span className="pill warm">
                                      devolvido à mão: {fmtReais(pg.devolvidoCentavos ?? 0)}
                                    </span>
                                  )}
                                {pg.tipo === "pacote" &&
                                  p.gruPagaInpiEm &&
                                  !p.protocoladoEm &&
                                  (pg.devolvidoCentavos ?? 0) === 0 &&
                                  p.pedidoRegistro && (
                                    <button
                                      className="btn ghost"
                                      style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}
                                      disabled={confirmando === pg.id}
                                      title="A taxa já foi paga ao INPI: só o serviço volta, por Pix seu"
                                      onClick={() =>
                                        registrarDevolucao(pg.id, p.pedidoRegistro?.servicoCentavos ?? 0)
                                      }
                                    >
                                      Registrei a devolução do serviço (
                                      {fmtReais(p.pedidoRegistro.servicoCentavos)})
                                    </button>
                                  )}
                              </>
                            ) : pg.status === "estornado" ? (
                              <span className="pill warm">estornado</span>
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
                                {confirmando === pg.id
                                  ? "Confirmando…"
                                  : "Marcar como pago (reserva)"}
                              </button>
                            )}
                          </div>
                        ))}
                      </td>
                    </tr>
                    {p.pedidoRegistro && (
                      <tr>
                        <td colSpan={8}>
                          <PedidoDetalhe
                            pedido={p.pedidoRegistro}
                            processoId={p.id}
                            prontidao={p.prontidao}
                            temImagem={p.imagemMarca !== null}
                            marca={p.marca}
                            rotulo={`Dados do pedido de ${p.marca}`}
                          />
                          <ProtocoloAdmin
                            processoId={p.id}
                            numeroProcesso={p.numeroProcesso}
                            protocoladoEm={p.protocoladoEm}
                            prazos={p.prazos}
                            recibo={p.reciboProtocolo}
                            onMudou={carregar}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details style={{ marginTop: 28 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Avisos do sistema ({avisosSistema.length})
          </summary>
          <div style={{ margin: "10px 0 0" }}>
            <button className="btn ghost" disabled={testandoAviso} onClick={enviarAvisoTeste}>
              {testandoAviso ? "Enviando…" : "Enviar aviso de teste"}
            </button>
            {resultadoTeste && (
              <span role="status" style={{ marginLeft: 10, fontSize: 13 }}>
                {resultadoTeste}
              </span>
            )}
          </div>
          {avisosSistema.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>
              Nenhum aviso ainda. Eles aparecem aqui quando um pagamento é confirmado, um pedido é
              protocolado ou um prazo se aproxima.
            </p>
          ) : (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {avisosSistema.map((a) => (
                <li key={a.id} style={{ marginBottom: 6 }}>
                  <b>{a.assunto}</b> — para {a.destino === "cliente" ? "o cliente" : "você"} (
                  {a.canal === "painel"
                    ? "só no painel, nenhum canal de envio ligado"
                    : a.erro
                      ? `${a.canal}: falhou, ${a.erro}`
                      : `${a.canal}: enviado`}
                  ), {new Date(a.createdAt).toLocaleString("pt-BR")}
                </li>
              ))}
            </ul>
          )}
        </details>
      </main>
    </div>
  );
}
