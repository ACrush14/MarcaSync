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

export default function MarcaSyncApp() {
  const [current, setCurrent] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [phase, setPhase] = useState<Phase>("consulta");

  const [marca, setMarca] = useState("Kaza Doce");
  const [descricao, setDescricao] = useState(
    "Confeitaria artesanal com venda de bolos e doces personalizados para encomenda."
  );
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [monitoramento, setMonitoramento] = useState(true);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [opposed, setOpposed] = useState(false);

  function navigate(i: number) {
    if (i > unlocked) return;
    setCurrent(i);
    setPhase(["consulta", "resultado", "plano", "painel"][i] as Phase);
  }

  function handleAnalisar(novaMarca: string, novaDescricao: string) {
    setMarca(novaMarca);
    setDescricao(novaDescricao);
    setPhase("carregando");
  }

  function handleLoadingDone() {
    setAnalise(computeAnalysis(marca, descricao));
    setUnlocked((u) => Math.max(u, 1));
    setCurrent(1);
    setPhase("resultado");
  }

  function handleVerPlano() {
    setUnlocked((u) => Math.max(u, 2));
    setCurrent(2);
    setPhase("plano");
  }

  function handleConfirmarPlano() {
    setProtocolo((p) => p ?? `92${Math.floor(100000000 + Math.random() * 899999999)}`);
    setUnlocked((u) => Math.max(u, 3));
    setCurrent(3);
    setPhase("painel");
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
          <div className="avatar">AR</div>
          <span>Ana Ramos · Doce Ponto Confeitaria</span>
        </div>
      </div>

      <Stepper current={current} unlocked={unlocked} onNavigate={navigate} />

      <main className="panel">
        {phase === "consulta" && (
          <ConsultaStep marca={marca} descricao={descricao} onAnalisar={handleAnalisar} />
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
