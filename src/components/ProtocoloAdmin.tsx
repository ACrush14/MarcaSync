"use client";

import { useState } from "react";
import { diasRestantes } from "@/lib/prazos";

export interface PrazoAdmin {
  id: string;
  tipo: string;
  descricao: string;
  venceEm: string;
}

interface ProtocoloAdminProps {
  processoId: string;
  numeroProcesso: string | null;
  protocoladoEm: string | null;
  prazos: PrazoAdmin[];
  recibo: { nomeArquivo: string; tamanho: number } | null;
  /** Chamado depois de qualquer mudança, para a lista recarregar. */
  onMudou: () => void;
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

/**
 * No /admin: registrar o protocolo (número do pedido e data/hora do e-Marcas), guardar o recibo em PDF e
 * acompanhar os prazos. Registrar o protocolo cria o prazo da procuração (60 dias), avisa o cliente e
 * faz a regra de devolução tratar o serviço como concluído.
 */
export default function ProtocoloAdmin({
  processoId,
  numeroProcesso,
  protocoladoEm,
  prazos,
  recibo,
  onMudou,
}: ProtocoloAdminProps) {
  const [numero, setNumero] = useState(numeroProcesso ?? "");
  const [quando, setQuando] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(url: string, init: RequestInit, rotuloErro: string): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch(url, init);
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo?.error ?? rotuloErro);
      onMudou();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : rotuloErro);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function registrar() {
    if (
      !window.confirm(
        "Registrar o protocolo avisa o cliente por e-mail (se o envio estiver ligado). Continuar?"
      )
    ) {
      return;
    }
    void chamar(
      `/api/admin/processos/${processoId}/protocolo`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // datetime-local não traz fuso: a data é lida no fuso do seu navegador.
        body: JSON.stringify({
          numeroPedido: numero,
          protocoladoEm: quando ? new Date(quando).toISOString() : "",
        }),
      },
      "Não consegui registrar o protocolo."
    );
  }

  function enviarRecibo(arquivo: File) {
    const dados = new FormData();
    dados.append("recibo", arquivo);
    void chamar(
      `/api/admin/processos/${processoId}/recibo`,
      { method: "POST", body: dados },
      "Não consegui guardar o recibo."
    );
  }

  return (
    <div style={{ margin: "8px 0 12px", fontSize: 12.5 }}>
      <p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 6px" }}>Protocolo e prazos</p>

      {!protocoladoEm ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 2 }}>
            Nº do pedido (9 dígitos)
            <input
              type="text"
              inputMode="numeric"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              style={{ width: 150 }}
            />
          </label>
          <label style={{ display: "grid", gap: 2 }}>
            Data e hora do protocolo
            <input
              type="datetime-local"
              value={quando}
              onChange={(e) => setQuando(e.target.value)}
            />
          </label>
          <button className="btn ghost" disabled={ocupado} onClick={registrar}>
            {ocupado ? "Registrando…" : "Registrar protocolo"}
          </button>
        </div>
      ) : (
        <p style={{ margin: "0 0 6px" }}>
          Protocolado em {fmtData(protocoladoEm)}
          {numeroProcesso ? `, pedido nº ${numeroProcesso}` : ""}.
        </p>
      )}

      {protocoladoEm && (
        <p style={{ margin: "6px 0" }}>
          Recibo:{" "}
          {recibo ? (
            <a href={`/api/admin/processos/${processoId}/recibo`} target="_blank" rel="noreferrer">
              {recibo.nomeArquivo} ({Math.round(recibo.tamanho / 1024)} KB)
            </a>
          ) : (
            "ainda não guardado"
          )}{" "}
          <label style={{ marginLeft: 8, cursor: "pointer", textDecoration: "underline" }}>
            {recibo ? "trocar PDF" : "enviar PDF"}
            <input
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviarRecibo(f);
                e.target.value = "";
              }}
            />
          </label>
        </p>
      )}

      {prazos.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {prazos.map((p) => {
            const dias = diasRestantes(new Date(p.venceEm), new Date());
            return (
              <li key={p.id} style={{ marginBottom: 4 }}>
                {p.descricao} — vence em {fmtData(p.venceEm).split(",")[0]} (
                {dias > 0 ? `faltam ${dias} dias` : "VENCIDO"}){" "}
                <button
                  className="btn ghost"
                  style={{ padding: "4px 10px", fontSize: 12, minHeight: 28 }}
                  disabled={ocupado}
                  onClick={() =>
                    void chamar(
                      `/api/admin/prazos/${p.id}/concluir`,
                      { method: "POST" },
                      "Não consegui concluir o prazo."
                    )
                  }
                >
                  Concluir
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {erro && (
        <p role="alert" style={{ color: "var(--risk)", margin: "6px 0 0" }}>
          {erro}
        </p>
      )}
    </div>
  );
}
