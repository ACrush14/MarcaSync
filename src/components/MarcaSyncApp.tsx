"use client";

import { useRef, useState } from "react";
import Stepper from "./Stepper";
import ConsultaStep from "./ConsultaStep";
import LoadingStep from "./LoadingStep";
import ResultadoStep from "./ResultadoStep";
import PlanoStep from "./PlanoStep";
import ContatoStep from "./ContatoStep";
import type { ColidenciaResultado } from "@/lib/colidencia";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS } from "@/lib/planos";
import { linkWhatsapp } from "@/lib/whatsapp";

type Phase = "consulta" | "carregando" | "resultado" | "plano" | "contato";

const PHASE_POR_PASSO: Phase[] = ["consulta", "resultado", "plano", "contato"];

export default function MarcaSyncApp() {
  const [current, setCurrent] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [phase, setPhase] = useState<Phase>("consulta");

  const [nomeCliente, setNomeCliente] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [marca, setMarca] = useState("");
  const [descricao, setDescricao] = useState(
    "Confeitaria artesanal com venda de bolos e doces personalizados para encomenda."
  );
  const [colidencia, setColidencia] = useState<ColidenciaResultado | null>(null);
  const [monitoramento, setMonitoramento] = useState(true);
  // true quando o cliente chegou ao contato passando pelo Plano (muda a mensagem do WhatsApp)
  const [planoEscolhido, setPlanoEscolhido] = useState(false);

  // Id do registro no "caderno de anotações" (banco) — null até a primeira
  // análise terminar. Se a gravação falhar, o wizard continua funcionando,
  // mas fica marcado em erroSalvar.
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // A busca (real, com fallback pra demo) começa assim que o usuário clica
  // "Analisar", em paralelo com a animação do LoadingStep — não espera a
  // animação acabar pra só então começar a buscar.
  const colidenciaPromiseRef = useRef<Promise<ColidenciaResultado> | null>(null);

  // Cobranças já criadas pra este processo: o cliente pode voltar ao Plano
  // pelo Stepper e confirmar de novo — sem isso duplicaria o registro.
  const setupCriadoRef = useRef(false);
  const monitoramentoCriadoRef = useRef(false);

  function navigate(i: number) {
    if (i > unlocked) return;
    setCurrent(i);
    setPhase(PHASE_POR_PASSO[i] as Phase);
  }

  function handleAnalisar(dados: {
    nomeCliente: string;
    whatsapp: string;
    marca: string;
    descricao: string;
  }) {
    setNomeCliente(dados.nomeCliente);
    setWhatsapp(dados.whatsapp);
    setMarca(dados.marca);
    setDescricao(dados.descricao);

    const params = new URLSearchParams({ marca: dados.marca, descricao: dados.descricao });
    colidenciaPromiseRef.current = fetch(`/api/colidencia?${params}`).then((r) => r.json());

    setPhase("carregando");
  }

  async function handleLoadingDone() {
    let resultado: ColidenciaResultado;
    try {
      resultado = colidenciaPromiseRef.current
        ? await colidenciaPromiseRef.current
        : await fetch(
            `/api/colidencia?${new URLSearchParams({ marca, descricao })}`
          ).then((r) => r.json());
    } catch {
      setErroSalvar("Falha ao buscar a colidência (rede indisponível).");
      setPhase("consulta");
      return;
    }

    setColidencia(resultado);
    setUnlocked((u) => Math.max(u, 1));
    setCurrent(1);
    setPhase("resultado");

    try {
      const res = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCliente,
          whatsapp,
          marca,
          descricao,
          nclCode: resultado.ncl.code,
          nclLabel: resultado.ncl.label,
          riscoPct: resultado.top?.pct ?? 0,
          riscoFonte: resultado.fonte,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha ao salvar o processo.");
      setProcessoId(body.processo.id);
      setErroSalvar(null);
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Falha ao salvar o processo no banco.");
    }
  }

  function handleVerPlano() {
    setUnlocked((u) => Math.max(u, 2));
    setCurrent(2);
    setPhase("plano");
    if (processoId) {
      fetch(`/api/processos/${processoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "plano" }),
      }).catch(() => setErroSalvar("Falha ao atualizar o processo no banco."));
    }
  }

  /**
   * Cliente decidiu falar comigo (botão "WhatsApp" do Resultado ou do
   * Plano). O <a href="wa.me/…"> dos botões abre a conversa por conta
   * própria — aqui só avançamos o wizard e anotamos no caderno. `comPlano`
   * é verdadeiro quando ele passou pelo Plano: aí viram cobranças pendentes
   * (que eu confirmo à mão no /admin depois do PIX).
   */
  async function handleContato(comPlano: boolean) {
    setPlanoEscolhido(comPlano);
    setUnlocked((u) => Math.max(u, 3));
    setCurrent(3);
    setPhase("contato");

    if (!processoId) return;
    try {
      await fetch(`/api/processos/${processoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          comPlano ? { status: "contato", monitoramento } : { status: "contato" }
        ),
      });

      if (comPlano) {
        const criar = (tipo: "setup" | "monitoramento", valorCentavos: number) =>
          fetch(`/api/processos/${processoId}/pagamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo, valorCentavos }),
          });
        if (!setupCriadoRef.current) {
          setupCriadoRef.current = true;
          await criar("setup", SETUP_CENTAVOS);
        }
        if (monitoramento && !monitoramentoCriadoRef.current) {
          monitoramentoCriadoRef.current = true;
          await criar("monitoramento", MONITORAMENTO_CENTAVOS);
        }
      }
      setErroSalvar(null);
    } catch {
      setErroSalvar("Falha ao registrar o contato no banco.");
    }
  }

  function novaConsulta() {
    colidenciaPromiseRef.current = null;
    setupCriadoRef.current = false;
    monitoramentoCriadoRef.current = false;
    setColidencia(null);
    setPlanoEscolhido(false);
    setProcessoId(null);
    setErroSalvar(null);
    setUnlocked(0);
    setCurrent(0);
    setPhase("consulta");
  }

  const hrefResultado = linkWhatsapp({ nomeCliente, marca, colidencia, processoId });
  const hrefPlano = linkWhatsapp({
    nomeCliente,
    marca,
    colidencia,
    processoId,
    plano: { monitoramento },
  });

  return (
    <div className="shell">
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
              {erroSalvar} O wizard continua funcionando, mas esse passo não ficou
              registrado no caderno de anotações.
            </p>
          </div>
        )}

        {phase === "consulta" && (
          <ConsultaStep
            nomeCliente={nomeCliente}
            whatsapp={whatsapp}
            marca={marca}
            descricao={descricao}
            onAnalisar={handleAnalisar}
          />
        )}
        {phase === "carregando" && <LoadingStep marca={marca} onDone={handleLoadingDone} />}
        {phase === "resultado" && colidencia && (
          <ResultadoStep
            descricao={descricao}
            colidencia={colidencia}
            onColidenciaAtualizada={setColidencia}
            onRefazer={() => {
              setCurrent(0);
              setPhase("consulta");
            }}
            onVerPlano={handleVerPlano}
            whatsappHref={hrefResultado}
            onContato={() => handleContato(false)}
          />
        )}
        {phase === "plano" && (
          <PlanoStep
            monitoramento={monitoramento}
            onToggleMonitoramento={() => setMonitoramento((m) => !m)}
            onConfirmar={() => handleContato(true)}
            processoId={processoId}
            whatsappHref={hrefPlano}
          />
        )}
        {phase === "contato" && (
          <ContatoStep
            nomeCliente={nomeCliente}
            whatsappCliente={whatsapp}
            marca={marca}
            whatsappHref={planoEscolhido ? hrefPlano : hrefResultado}
            onNovaConsulta={novaConsulta}
          />
        )}
      </main>

      <p className="footer-note">
        A busca de anterioridade consulta a base real do INPI e indica risco de colisão; a decisão
        final é sempre do INPI.
      </p>
    </div>
  );
}
