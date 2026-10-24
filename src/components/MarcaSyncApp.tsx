"use client";

import { useRef, useState } from "react";
import Stepper from "./Stepper";
import ConsultaStep from "./ConsultaStep";
import LoadingStep from "./LoadingStep";
import ResultadoStep from "./ResultadoStep";
import PlanoStep from "./PlanoStep";
import PedidoStep, { type ResumoPedido } from "./PedidoStep";
import ContatoStep from "./ContatoStep";
import type { ColidenciaResultado } from "@/lib/colidencia";
import { linkWhatsapp } from "@/lib/whatsapp";
import { pctDoRisco } from "@/lib/risco-area";
import { avaliarAnterioridade, type AvisoAnterioridade } from "@/lib/anterioridade";
import TrackView from "./TrackView";
import RodapeLegal from "./RodapeLegal";

/** Sem busca feita não há o que avisar. */
const SEM_AVISO: AvisoAnterioridade = {
  nivel: "nenhum",
  anterior: null,
  titulo: "",
  texto: "",
  alternativas: [],
};

// "consulta" e "carregando" fazem parte do primeiro passo (Resultado): a pessoa chega, diz a
// marca e o produto, e o resultado aparece ali mesmo.
type Phase = "consulta" | "carregando" | "resultado" | "plano" | "pedido" | "contato";

const PHASE_POR_PASSO: Phase[] = ["resultado", "plano", "pedido", "contato"];

const PASSO_PLANO = 1;
const PASSO_PEDIDO = 2;
const PASSO_CONTATO = 3;

export default function MarcaSyncApp() {
  const [current, setCurrent] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [phase, setPhase] = useState<Phase>("consulta");

  const [nomeCliente, setNomeCliente] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [marca, setMarca] = useState("");
  const [descricao, setDescricao] = useState("");
  const [colidencia, setColidencia] = useState<ColidenciaResultado | null>(null);
  const [monitoramento, setMonitoramento] = useState(true);
  // true quando o cliente chegou ao contato passando pelo Plano (muda a mensagem do WhatsApp)
  const [planoEscolhido, setPlanoEscolhido] = useState(false);

  // Id do registro no "caderno de anotações" (banco) — null até a primeira
  // análise terminar. Se a gravação falhar, o wizard continua funcionando,
  // mas fica marcado em erroSalvar.
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // A busca (real, com fallback pra demo) começa assim que o usuário clica
  // "Analisar", em paralelo com a animação do LoadingStep — não espera a
  // animação acabar pra só então começar a buscar.
  const colidenciaPromiseRef = useRef<Promise<ColidenciaResultado> | null>(null);

  // Resumo de valores devolvido pelo servidor depois que o cliente envia os dados do pedido
  // (as cobranças pendentes são criadas lá, com o preço calculado no servidor).
  const [resumoPedido, setResumoPedido] = useState<ResumoPedido | null>(null);

  const aviso = colidencia ? avaliarAnterioridade(colidencia.risco) : SEM_AVISO;

  function navigate(i: number) {
    if (i > unlocked) return;
    setCurrent(i);
    setPhase(PHASE_POR_PASSO[i] as Phase);
  }

  function handleAnalisar(dados: { marca: string; descricao: string }) {
    setMarca(dados.marca);
    setDescricao(dados.descricao);
    // Uma análise nova é um processo novo: o anterior (se houve) ficou com a marca antiga.
    setProcessoId(null);

    const params = new URLSearchParams({
      marca: dados.marca,
      descricao: dados.descricao,
    });
    colidenciaPromiseRef.current = fetch(`/api/colidencia?${params}`).then((r) => r.json());

    setPhase("carregando");
  }

  async function handleLoadingDone() {
    let resultado: ColidenciaResultado;
    try {
      resultado = colidenciaPromiseRef.current
        ? await colidenciaPromiseRef.current
        : await fetch(`/api/colidencia?${new URLSearchParams({ marca, descricao })}`).then((r) =>
            r.json()
          );
    } catch {
      setErroSalvar("Falha ao buscar a colidência (rede indisponível).");
      setPhase("consulta");
      return;
    }

    setColidencia(resultado);
    setErroSalvar(null);
    setCurrent(0);
    setPhase("resultado");
  }

  /**
   * O processo só entra no caderno (banco) quando a pessoa decide seguir e deixa nome e
   * WhatsApp: até o resultado ela não precisa se identificar. Devolve o id, ou null se a
   * gravação falhou (aí o wizard não avança, porque o pedido precisa do processo).
   */
  async function garantirProcesso(status: "plano" | "contato"): Promise<string | null> {
    if (!colidencia) return null;
    setSalvando(true);
    try {
      let id = processoId;
      if (!id) {
        const res = await fetch("/api/processos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nomeCliente: nomeCliente.trim(),
            whatsapp: whatsapp.trim(),
            marca,
            descricao,
            nclCode: colidencia.ncl.code,
            nclLabel: colidencia.ncl.label,
            riscoPct: pctDoRisco(colidencia.risco),
            riscoFonte: colidencia.fonte,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Falha ao salvar o processo.");
        id = body.processo.id as string;
        setProcessoId(id);
      }
      await fetch(`/api/processos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setErroSalvar(null);
      return id;
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Falha ao salvar o processo no banco.");
      return null;
    } finally {
      setSalvando(false);
    }
  }

  function handleVerPlano() {
    setUnlocked((u) => Math.max(u, PASSO_PLANO));
    setCurrent(PASSO_PLANO);
    setPhase("plano");
  }

  /** Cliente decidiu seguir com o registro: abre o formulário de dados do pedido. */
  async function handleVerPedido() {
    if (!(await garantirProcesso("plano"))) return;
    setUnlocked((u) => Math.max(u, PASSO_PEDIDO));
    setCurrent(PASSO_PEDIDO);
    setPhase("pedido");
  }

  /**
   * O servidor gravou o pedido e criou as cobranças pendentes (serviço, taxa do INPI e,
   * se for o caso, monitoramento). Aqui só guardamos o resumo e avançamos para a conversa.
   */
  function handlePedidoEnviado(resumo: ResumoPedido) {
    setResumoPedido(resumo);
    setPlanoEscolhido(true);
    setErroSalvar(null);
    setUnlocked((u) => Math.max(u, PASSO_CONTATO));
    setCurrent(PASSO_CONTATO);
    setPhase("contato");
  }

  /**
   * Cliente decidiu falar comigo antes de preencher os dados (botão "WhatsApp" do Plano).
   * O <a href="wa.me/…"> abre a conversa por conta própria — aqui gravamos o processo e
   * avançamos o wizard. Não cria cobrança: elas nascem quando o cliente envia o formulário
   * do pedido.
   */
  async function handleContato() {
    setPlanoEscolhido(false);
    if (!(await garantirProcesso("contato"))) return;
    setUnlocked((u) => Math.max(u, PASSO_CONTATO));
    setCurrent(PASSO_CONTATO);
    setPhase("contato");
  }

  function novaConsulta() {
    colidenciaPromiseRef.current = null;
    setResumoPedido(null);
    setColidencia(null);
    setPlanoEscolhido(false);
    setProcessoId(null);
    setErroSalvar(null);
    setUnlocked(0);
    setCurrent(0);
    setPhase("consulta");
  }

  const hrefResultado = linkWhatsapp({
    nomeCliente,
    marca,
    colidencia,
    processoId,
  });
  const hrefPlano = linkWhatsapp({
    nomeCliente,
    marca,
    colidencia,
    processoId,
    plano: { monitoramento },
    pedidoEnviado: resumoPedido !== null,
  });

  return (
    <div className="shell">
      <TrackView nome="consulta_iniciada" />
      <div className="topbar">
        <div className="brand">
          <span className="mark">MarcaSync</span>
          <span className="tag">registro de marcas · resultado em segundos, direto do INPI</span>
          <span className="value-badge">preço fechado · sem &quot;fale conosco&quot;</span>
        </div>
        <div className="session-chip">
          <div className="avatar">
            {nomeCliente
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "?"}
          </div>
          <span>{nomeCliente || "Visitante"}</span>
        </div>
      </div>

      <Stepper current={current} unlocked={unlocked} onNavigate={navigate} />

      <main className="panel">
        {erroSalvar && (
          <div className="helpbox" style={{ borderColor: "var(--risk)", marginBottom: 20 }}>
            <h3 style={{ color: "var(--risk)" }}>Não consegui salvar no banco</h3>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
              {erroSalvar} O wizard continua funcionando, mas esse passo não ficou registrado no
              caderno de anotações.
            </p>
          </div>
        )}

        {phase === "consulta" && (
          <ConsultaStep marca={marca} descricao={descricao} onAnalisar={handleAnalisar} />
        )}
        {phase === "carregando" && <LoadingStep marca={marca} onDone={handleLoadingDone} />}
        {phase === "resultado" && colidencia && (
          <ResultadoStep
            descricao={descricao}
            aviso={aviso}
            colidencia={colidencia}
            onColidenciaAtualizada={setColidencia}
            onRefazer={() => {
              setCurrent(0);
              setPhase("consulta");
            }}
            onVerPlano={handleVerPlano}
            whatsappHref={hrefResultado}
          />
        )}
        {phase === "plano" && (
          <PlanoStep
            nomeCliente={nomeCliente}
            whatsapp={whatsapp}
            onNomeChange={setNomeCliente}
            onWhatsappChange={setWhatsapp}
            salvando={salvando}
            monitoramento={monitoramento}
            onToggleMonitoramento={() => setMonitoramento((m) => !m)}
            onConfirmar={handleVerPedido}
            onFalarPrimeiro={handleContato}
            whatsappHref={hrefPlano}
          />
        )}
        {phase === "pedido" && (
          <PedidoStep
            processoId={processoId}
            marca={marca}
            classeSugerida={colidencia?.ncl.code ?? ""}
            aviso={aviso}
            monitoramento={monitoramento}
            onVoltar={() => {
              setCurrent(PASSO_PLANO);
              setPhase("plano");
            }}
            onEnviado={handlePedidoEnviado}
          />
        )}
        {phase === "contato" && (
          <ContatoStep
            nomeCliente={nomeCliente}
            processoId={processoId}
            whatsappCliente={whatsapp}
            marca={marca}
            whatsappHref={planoEscolhido ? hrefPlano : hrefResultado}
            resumo={resumoPedido}
            onNovaConsulta={novaConsulta}
          />
        )}
      </main>

      <p className="footer-note">
        A busca de anterioridade consulta a base real do INPI e indica risco de colisão; a decisão
        final é sempre do INPI. Medimos as etapas do site com um código anônimo no navegador, que
        não é ligado ao seu nome nem ao seu telefone.
      </p>
      <RodapeLegal />
    </div>
  );
}
