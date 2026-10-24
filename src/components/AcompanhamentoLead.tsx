"use client";

import { useState } from "react";
import {
  AJUDA_INTERESSE,
  INTERESSES,
  MAX_ANOTACOES,
  ROTULO_INTERESSE,
  dataEmDias,
  paraCampoDeData,
  situacaoDoContato,
  type Interesse,
} from "@/lib/acompanhamento";

export interface AcompanhamentoDoProcesso {
  interesse: string;
  proximoContatoEm: string | null;
  ultimoContatoEm: string | null;
  anotacoes: string | null;
}

interface Props {
  processoId: string;
  marca: string;
  acompanhamento: AcompanhamentoDoProcesso;
  /** Já pagou o serviço: o contato está encerrado, só as anotações importam. */
  jaPagou: boolean;
  onSalvo: () => void;
}

const COR_SITUACAO = {
  atrasado: { classe: "pill warm", texto: "contato atrasado" },
  hoje: { classe: "pill warm", texto: "falar hoje" },
  agendado: { classe: "pill safe", texto: "agendado" },
  sem_data: { classe: "pill", texto: "sem data" },
  encerrado: { classe: "pill", texto: "encerrado" },
} as const;

/** O seu controle de acompanhamento de uma pessoa: interesse, próximo contato e anotações. */
export default function AcompanhamentoLead({ processoId, marca, acompanhamento, jaPagou, onSalvo }: Props) {
  const gravado = {
    interesse: INTERESSES.find((i) => i === acompanhamento.interesse) ?? "novo",
    data: paraCampoDeData(acompanhamento.proximoContatoEm),
    nota: acompanhamento.anotacoes ?? "",
  };
  const [interesse, setInteresse] = useState<Interesse>(gravado.interesse);
  const [data, setData] = useState(gravado.data);
  const [nota, setNota] = useState(gravado.nota);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudou = interesse !== gravado.interesse || data !== gravado.data || nota.trim() !== gravado.nota;
  const situacao = situacaoDoContato(
    { ...acompanhamento, interesse: gravado.interesse },
    new Date(),
    jaPagou
  );
  const pill = COR_SITUACAO[situacao];

  async function enviar(corpo: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/processos/${processoId}/acompanhamento`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const resposta = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resposta?.error ?? "Não consegui salvar.");
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }

  const salvar = () => enviar({ interesse, proximoContatoEm: data || null, anotacoes: nota });

  // Quando a pessoa deixa de ser "sem interesse"/"novo" sem data, sugerimos um prazo curto.
  function escolherInteresse(v: Interesse) {
    setInteresse(v);
    if ((v === "interessado" || v === "acompanhar") && !data) setData(dataEmDias(v === "interessado" ? 1 : 7));
    if (v === "sem_interesse") setData("");
  }

  const idBase = `acomp-${processoId}`;

  return (
    <div style={{ minWidth: 240, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <label className="sr-only" htmlFor={`${idBase}-interesse`}>
          Interesse — {marca}
        </label>
        <select
          id={`${idBase}-interesse`}
          value={interesse}
          onChange={(e) => escolherInteresse(e.target.value as Interesse)}
          style={{ minHeight: 40 }}
          aria-describedby={`${idBase}-ajuda`}
        >
          {INTERESSES.map((i) => (
            <option key={i} value={i}>
              {ROTULO_INTERESSE[i]}
            </option>
          ))}
        </select>
        <span className={pill.classe}>{pill.texto}</span>
      </div>
      <span id={`${idBase}-ajuda`} style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
        {AJUDA_INTERESSE[interesse]}
      </span>

      {interesse !== "sem_interesse" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor={`${idBase}-data`} style={{ fontSize: 12 }}>
            Falar de novo em
          </label>
          <input
            id={`${idBase}-data`}
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            style={{ minHeight: 40 }}
          />
          {[1, 3, 7].map((d) => (
            <button
              key={d}
              type="button"
              className="btn ghost"
              style={{ padding: "6px 10px", fontSize: 12, minHeight: 32 }}
              onClick={() => setData(dataEmDias(d))}
            >
              +{d} dia{d > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      )}

      <label className="sr-only" htmlFor={`${idBase}-nota`}>
        Anotações — {marca}
      </label>
      <textarea
        id={`${idBase}-nota`}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={MAX_ANOTACOES}
        rows={2}
        placeholder="Anotações: o que a pessoa disse, o que ficou combinado…"
        style={{ fontSize: 13, minHeight: 56 }}
      />

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {mudou && (
          <button
            className="btn"
            style={{ padding: "8px 14px", fontSize: 13, minHeight: 40 }}
            disabled={salvando}
            onClick={salvar}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        )}
        <button
          className="btn ghost"
          style={{ padding: "8px 14px", fontSize: 13, minHeight: 40 }}
          disabled={salvando || mudou}
          title={mudou ? "Salve as mudanças primeiro" : undefined}
          onClick={() => enviar({ contatei: true })}
        >
          Falei com a pessoa agora
        </button>
      </div>
      {acompanhamento.ultimoContatoEm && (
        <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
          Último contato: {new Date(acompanhamento.ultimoContatoEm).toLocaleDateString("pt-BR")}
        </span>
      )}
      {erro && (
        <span role="alert" style={{ fontSize: 12.5, color: "var(--risk)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
