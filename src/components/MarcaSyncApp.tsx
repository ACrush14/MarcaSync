"use client";

import { useState } from "react";
import Stepper from "./Stepper";
import ConsultaStep from "./ConsultaStep";
import LoadingStep from "./LoadingStep";
import ResultadoStep from "./ResultadoStep";
import PlanoStep from "./PlanoStep";
import PainelStep from "./PainelStep";
import { computeAnalysis } from "@/lib/analysis";
import type { Analise } from "@/lib/types";

type Phase = "consulta" | "carregando" | "resultado" | "plano" | "painel";

const SETUP_CENTAVOS = 49_900;
const MONITORAMENTO_CENTAVOS = 2_900;

export default function MarcaSyncApp() {
  const [current, setCurrent] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [phase, setPhase] = useState<Phase>("consulta");

  const [nomeCliente, setNomeCliente] = useState("Ana Ramos");
  const [whatsapp, setWhatsapp] = useState("");
  const [marca, setMarca] = useState("Kaza Doce");
  const [descricao, setDescricao] = useState(
    "Confeitaria artesanal com venda de bolos e doces personalizados para encomenda."
  );
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [monitoramento, setMonitoramento] = useState(true);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [opposed, setOpposed] = useState(false);

  // Id do registro no "caderno de anotações" (banco local) — null até a
  // primeira análise terminar. Se a gravação falhar, o wizard continua
  // funcionando (não trava a demonstração), mas fica marcado em erroSalvar.
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  function navigate(i: number) {
    if (i > unlocked) return;
    setCurrent(i);
    setPhase(["consulta", "resultado", "plano", "painel"][i] as Phase);
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
    setPhase("carregando");
  }

  async function handleLoadingDone() {
    const resultado = computeAnalysis(marca, descricao);
    setAnalise(resultado);
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
          riscoPct: resultado.top.pct,
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

  async function handleConfirmarPlano() {
    const novoProtocolo =
      protocolo ?? `92${Math.floor(100000000 + Math.random() * 899999999)}`;
    setProtocolo(novoProtocolo);
    setUnlocked((u) => Math.max(u, 3));
    setCurrent(3);
    setPhase("painel");

    if (!processoId) return;
    try {
      await fetch(`/api/processos/${processoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "protocolado", protocolo: novoProtocolo, monitoramento }),
      });
      await fetch(`/api/processos/${processoId}/pagamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "setup", valorCentavos: SETUP_CENTAVOS }),
      });
      if (monitoramento) {
        await fetch(`/api/processos/${processoId}/pagamentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "monitoramento", valorCentavos: MONITORAMENTO_CENTAVOS }),
        });
      }
      setErroSalvar(null);
    } catch {
      setErroSalvar("Falha ao registrar o(s) pagamento(s) no banco.");
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="mark">MarcaSync</span>
          <span className="tag">registro de marcas · automação INPI</span>
          <span className="proto-badge">protótipo interativo · dados de exemplo</span>
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
        {phase === "resultado" && analise && (
          <ResultadoStep
            marca={marca}
            analise={analise}
            onRefazer={() => {
              setCurrent(0);
              setPhase("consulta");
            }}
            onVerPlano={handleVerPlano}
          />
        )}
        {phase === "plano" && (
          <PlanoStep
            monitoramento={monitoramento}
            onToggleMonitoramento={() => setMonitoramento((m) => !m)}
            onConfirmar={handleConfirmarPlano}
          />
        )}
        {phase === "painel" && protocolo && (
          <PainelStep
            protocolo={protocolo}
            monitoramento={monitoramento}
            opposed={opposed}
            onSimularOposicao={() => setOpposed(true)}
          />
        )}
      </main>

      <p className="footer-note">
        Fluxo ilustrativo do produto MarcaSync — nomes, prazos e despachos são exemplos
        para demonstrar a mecânica do sistema, não dados reais do INPI.
      </p>
    </div>
  );
}
