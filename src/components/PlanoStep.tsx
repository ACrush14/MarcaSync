"use client";

import { useRef, useState } from "react";
import GarantiaDevolucao from "./GarantiaDevolucao";
import TrackView from "./TrackView";
import { track } from "@/lib/track";
import { whatsappValido } from "@/lib/whatsapp";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS, fmtReais, fmtReaisCurto } from "@/lib/planos";

interface PlanoStepProps {
  nomeCliente: string;
  whatsapp: string;
  onNomeChange: (v: string) => void;
  onWhatsappChange: (v: string) => void;
  /** Gravando o processo no banco: segura os botões. */
  salvando: boolean;
  monitoramento: boolean;
  onToggleMonitoramento: () => void;
  /** Cliente quer registrar: abre o formulário com os dados do pedido. */
  onConfirmar: () => void;
  /** Cliente prefere conversar antes de preencher os dados. */
  onFalarPrimeiro: () => void;
  /** Link wa.me já com o plano escolhido; null se o número não estiver configurado. */
  whatsappHref: string | null;
}

export default function PlanoStep({
  nomeCliente,
  whatsapp,
  onNomeChange,
  onWhatsappChange,
  salvando,
  monitoramento,
  onToggleMonitoramento,
  onConfirmar,
  onFalarPrimeiro,
  whatsappHref,
}: PlanoStepProps) {
  const [erroContato, setErroContato] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);

  /** Antes de abrir o pedido (ou a conversa) precisamos saber quem é e como falar com a pessoa. */
  function contatoOk(): boolean {
    if (!nomeCliente.trim()) {
      setErroContato("Diga o seu nome para continuar.");
      nomeRef.current?.focus();
      return false;
    }
    if (!whatsappValido(whatsapp)) {
      setErroContato("Informe o WhatsApp com DDD, por exemplo (85) 91234-5678.");
      whatsappRef.current?.focus();
      return false;
    }
    setErroContato(null);
    return true;
  }

  return (
    <>
      <TrackView nome="plano_visto" />
      <div className="panel-head">
        <h2>Plano de registro</h2>
        <p className="help">
          Sem &quot;fale com um consultor&quot; — o valor do serviço abaixo é fechado, sem orçamento
          por telefone. Setup cobre a análise já feita, a petição e o protocolo. A taxa oficial do
          INPI (GRU) é cobrada à parte, e o valor exato aparece antes de você confirmar. O
          monitoramento é opcional e recorrente — desligue para conduzir o acompanhamento
          manualmente.
        </p>
      </div>

      <div className="plans">
        <div className="plan-card">
          <h3>Setup — Análise e Protocolo</h3>
          <div className="price">
            {fmtReaisCurto(SETUP_CENTAVOS)} <small>pagamento único</small>
          </div>
          <ul>
            <li>Busca de anterioridade fonética</li>
            <li>Inferência e conferência da classe NCL</li>
            <li>Petição, guia (GRU) e procuração prontas</li>
            <li>Protocolo do pedido no INPI</li>
          </ul>
        </div>
        <div className="plan-card">
          <h3>Monitoramento RPI</h3>
          <div className="price">
            {fmtReaisCurto(MONITORAMENTO_CENTAVOS)} <small>por mês</small>
          </div>
          <ul>
            <li>Leitura da RPI automática do seu processo: toda semana enquanto o pedido é protocolado e examinado; depois que está tudo certo, todo mês</li>
            <li>Aviso de qualquer despacho publicado, inclusive oposição de terceiros</li>
            <li>Prazo estimado de manifestação quando houver oposição</li>
            <li>Aviso por WhatsApp, com explicação do que fazer</li>
          </ul>
          <div className="toggle-row">
            <label className="t" htmlFor="sw-monitoramento">
              Contratar monitoramento
            </label>
            <button
              id="sw-monitoramento"
              type="button"
              className={`switch ${monitoramento ? "on" : ""}`}
              role="switch"
              aria-checked={monitoramento}
              onClick={onToggleMonitoramento}
            />
          </div>
        </div>
      </div>

      <GarantiaDevolucao margem="0 0 16px" />

      <div className="helpbox" style={{ margin: "0 0 16px" }}>
        <h3>Para onde mandamos o andamento?</h3>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 10 }}>
          Só usamos para falar sobre o seu pedido: o Pix, o protocolo e os prazos.
        </p>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="in-nome">Seu nome</label>
            <input
              ref={nomeRef}
              type="text"
              id="in-nome"
              autoComplete="name"
              value={nomeCliente}
              onChange={(e) => {
                onNomeChange(e.target.value);
                setErroContato(null);
              }}
              placeholder="Ex.: Ana Ramos"
              aria-describedby={erroContato ? "erro-contato" : undefined}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="in-whatsapp">Seu WhatsApp</label>
            <input
              ref={whatsappRef}
              type="tel"
              inputMode="tel"
              id="in-whatsapp"
              autoComplete="tel"
              value={whatsapp}
              onChange={(e) => {
                onWhatsappChange(e.target.value);
                setErroContato(null);
              }}
              placeholder="Ex.: (85) 91234-5678"
              aria-describedby={erroContato ? "erro-contato" : undefined}
            />
          </div>
        </div>
        {erroContato && (
          <p
            id="erro-contato"
            role="alert"
            style={{ fontSize: 13, color: "var(--risk)", marginTop: 8 }}
          >
            {erroContato}
          </p>
        )}
      </div>

      <div className="summary-strip">
        <div className="total">
          <div className="lbl">Serviço hoje</div>
          <div className="amt tab-nums">
            {fmtReais(SETUP_CENTAVOS)}
            <span
              style={{
                fontSize: 12.5,
                color: "var(--ink-dim)",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
              }}
            >
              {" "}
              + taxa do INPI (GRU)
            </span>
            {monitoramento && (
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                }}
              >
                {" "}
                + {fmtReaisCurto(MONITORAMENTO_CENTAVOS)}/mês a partir da publicação
              </span>
            )}
          </div>
        </div>
        <button
          className="btn"
          disabled={salvando}
          onClick={() => {
            if (contatoOk()) onConfirmar();
          }}
        >
          {salvando ? "Salvando…" : "Quero registrar — informar os dados →"}
        </button>
      </div>
      <p className="sim-note">
        Preço do serviço fechado, sem orçamento. A taxa do INPI (GRU) é oficial, vai direto para o
        INPI e é mostrada antes de você confirmar — sem surpresa depois.{" "}
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!contatoOk()) {
                e.preventDefault();
                return;
              }
              track("whatsapp_clicado", { onde: "plano" });
              onFalarPrimeiro();
            }}
          >
            Prefere conversar antes? Fale comigo no WhatsApp.
          </a>
        ) : (
          <button
            type="button"
            className="btn ghost"
            disabled={salvando}
            onClick={() => {
              if (contatoOk()) onFalarPrimeiro();
            }}
          >
            Prefere conversar antes? Me chamem.
          </button>
        )}
      </p>
    </>
  );
}
