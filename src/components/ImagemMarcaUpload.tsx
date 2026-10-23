"use client";

import { useRef, useState } from "react";

interface ImagemGuardada {
  largura: number;
  altura: number;
  larguraOriginal: number;
  alturaOriginal: number;
  ampliada: boolean;
}

interface ImagemMarcaUploadProps {
  processoId: string | null;
  /** Avisa o formulário se já há imagem guardada no servidor. */
  onGuardada: (guardada: boolean) => void;
  erro?: string;
}

/**
 * Envio da imagem da marca (marca figurativa ou mista). O cliente manda PNG ou JPG; o servidor
 * converte no JPG que o e-Marcas pede (RGB, 300 dpi, no mínimo 945 x 945 px, até 2 MB) e guarda
 * no banco. Aqui só mostramos a prévia e o que ficou guardado.
 *
 * Esta checagem do navegador é só para ajudar: quem valida de verdade é a rota do servidor.
 */
export default function ImagemMarcaUpload({
  processoId,
  onGuardada,
  erro,
}: ImagemMarcaUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [guardada, setGuardada] = useState<ImagemGuardada | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(arquivo: File) {
    setErroEnvio(null);
    if (arquivo.type !== "image/png" && arquivo.type !== "image/jpeg") {
      setErroEnvio("Só aceitamos PNG ou JPG.");
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setErroEnvio("Arquivo muito grande (máximo 5 MB).");
      return;
    }
    if (!processoId) {
      setErroEnvio(
        "Ainda não consegui registrar a sua consulta. Volte ao resultado e tente de novo."
      );
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(arquivo));
    setEnviando(true);
    try {
      const dados = new FormData();
      dados.append("imagem", arquivo);
      const res = await fetch(`/api/processos/${processoId}/imagem`, {
        method: "POST",
        body: dados,
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Não consegui enviar a imagem.");
      setGuardada(corpo as ImagemGuardada);
      onGuardada(true);
    } catch (e) {
      setGuardada(null);
      onGuardada(false);
      setErroEnvio(e instanceof Error ? e.message : "Falha de rede. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor="campo-imagem">Imagem da marca</label>
      <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: "2px 0 8px" }}>
        PNG ou JPG, até 5 MB, com uma única imagem do símbolo, sem ™ ou ®. Eu converto para o JPG
        que o INPI pede (300 dpi, no mínimo 945 x 945 px). Imagem colorida equivale a reivindicar as
        cores.
      </p>
      <input
        ref={inputRef}
        id="campo-imagem"
        type="file"
        accept="image/png,image/jpeg"
        aria-invalid={!!erro}
        aria-describedby={erro ? "erro-imagem" : undefined}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void enviar(arquivo);
        }}
      />

      {preview && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), next/image não se aplica */}
          <img
            src={preview}
            alt="Prévia da imagem da marca enviada"
            style={{ width: 96, height: 96, objectFit: "contain", background: "#fff" }}
          />
          <div style={{ fontSize: 13 }} role="status">
            {enviando && "Enviando…"}
            {!enviando && guardada && (
              <>
                <b>Guardada.</b> Ficou com {guardada.largura} x {guardada.altura} px em JPG.
                {guardada.ampliada && (
                  <span style={{ display: "block", color: "var(--ink-dim)" }}>
                    A original ({guardada.larguraOriginal} x {guardada.alturaOriginal} px) era menor
                    que o mínimo do INPI e foi ampliada. Se puder, envie uma maior para ficar mais
                    nítida.
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {(erroEnvio || erro) && (
        <p
          id="erro-imagem"
          role="alert"
          style={{ fontSize: 13, color: "var(--risk)", marginTop: 6 }}
        >
          {erroEnvio ?? erro}
        </p>
      )}
    </div>
  );
}
