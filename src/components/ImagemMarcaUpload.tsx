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
  const [arrastando, setArrastando] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
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
    setNomeArquivo(arquivo.name);
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

  function escolher(lista: FileList | null | undefined) {
    const arquivo = lista?.[0];
    if (arquivo) void enviar(arquivo);
  }

  return (
    <div className="field">
      <label htmlFor="campo-imagem">Logo da marca</label>
      <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "2px 0 8px" }}>
        Se você já tem a logo, envie aqui. PNG ou JPG, até 5 MB, só com o símbolo (sem ™ ou ®).
        Eu converto para o JPG que o INPI pede (300 dpi, no mínimo 945 x 945 px); se a sua for menor,
        ela é ampliada. Imagem colorida equivale a reivindicar as cores.
      </p>

      <div
        className={`upload-zona${arrastando ? " arrastando" : ""}${erro || erroEnvio ? " com-erro" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (!enviando) escolher(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          id="campo-imagem"
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg"
          disabled={enviando}
          aria-invalid={!!erro}
          aria-describedby={erro ? "erro-imagem" : undefined}
          onChange={(e) => {
            escolher(e.target.files);
            // permite escolher o mesmo arquivo de novo depois de um erro
            e.target.value = "";
          }}
        />
        {preview ? (
          <div className="upload-previa">
            {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), next/image não se aplica */}
            <img src={preview} alt="Prévia da logo enviada" />
            <div role="status" style={{ fontSize: 13, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{nomeArquivo}</div>
              {enviando && "Enviando…"}
              {!enviando && guardada && (
                <>
                  <span style={{ color: "var(--safe)", fontWeight: 600 }}>Guardada.</span> Ficou com{" "}
                  {guardada.largura} x {guardada.altura} px em JPG.
                  {guardada.ampliada && (
                    <span style={{ display: "block", color: "var(--ink-dim)" }}>
                      A original ({guardada.larguraOriginal} x {guardada.alturaOriginal} px) era
                      menor que o mínimo do INPI e foi ampliada. Se puder, envie uma maior para
                      ficar mais nítida.
                    </span>
                  )}
                </>
              )}
              <div style={{ marginTop: 8 }}>
                <label
                  htmlFor="campo-imagem"
                  className="btn ghost"
                  style={{ padding: "6px 12px", fontSize: 12.5, minHeight: 32 }}
                >
                  Trocar a imagem
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="upload-vazio">
            <label htmlFor="campo-imagem" className="btn secondary">
              Escolher a logo
            </label>
            <span>ou arraste o arquivo para cá</span>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>
        Ainda não tem logo? Em &quot;Como a marca se apresenta&quot;, escolha &quot;Nominativa&quot;
        (só o nome): não precisa de imagem.
      </p>

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
