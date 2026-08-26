"use client";

import { useRef, useState } from "react";

const MAX_DIMENSAO = 1000;

interface LogoUploadProps {
  processoId: string | null;
}

interface ErrorResponse {
  error: string;
}

/**
 * Upload do logotipo da marca (drag-and-drop ou clique) — só pra marca
 * mista (nome + imagem); marca nominativa não precisa disso, por isso vive
 * como opcional no passo "Plano", não na Consulta.
 *
 * Valida no navegador antes de gastar upload (tipo + dimensão via
 * `Image.naturalWidth/Height`) — mas isso é só UX, não segurança: a
 * validação que conta de verdade é a do servidor
 * (`/api/processos/:id/logo`), que lê o header do PNG direto, sem confiar
 * em nada que o cliente disse.
 */
export default function LogoUpload({ processoId }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processarArquivo(file: File) {
    setErro(null);
    setEnviado(false);

    if (file.type !== "image/png") {
      setErro("Só aceitamos PNG.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const dimensaoOk = await new Promise<boolean>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(img.naturalWidth <= MAX_DIMENSAO && img.naturalHeight <= MAX_DIMENSAO);
      img.onerror = () => resolve(false);
      img.src = objectUrl;
    });

    if (!dimensaoOk) {
      setErro(`A imagem precisa ter no máximo ${MAX_DIMENSAO}×${MAX_DIMENSAO}px.`);
      URL.revokeObjectURL(objectUrl);
      return;
    }

    setPreview(objectUrl);

    if (!processoId) {
      setErro("Ainda não deu pra identificar o processo — tente de novo em instantes.");
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(`/api/processos/${processoId}/logo`, {
        method: "POST",
        body: formData,
      });
      const body: { url: string } | ErrorResponse = await res.json();
      if (!res.ok) throw new Error((body as ErrorResponse).error ?? "Falha ao enviar.");
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processarArquivo(file);
  }

  return (
    <div className="logo-upload-head">
      <h3>Logotipo da marca (opcional)</h3>
      <p className="sub" style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 12 }}>
        Só se sua marca tiver um logotipo (marca mista) — nome + imagem, não só nome.
        PNG, até {MAX_DIMENSAO}×{MAX_DIMENSAO}px.
      </p>

      {preview ? (
        <div className="dropzone-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview de blob: local, next/image não se aplica */}
          <img src={preview} alt="Prévia do logotipo enviado" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {enviando ? "Enviando…" : enviado ? "Logotipo salvo" : erro ? "Não deu certo" : "Selecionado"}
            </div>
            <button
              className="btn ghost"
              style={{ marginTop: 8, padding: "6px 12px", fontSize: 12 }}
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setEnviado(false);
                setErro(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Trocar imagem
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone ${arrastando ? "dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={onDrop}
        >
          <div>Arraste o PNG aqui, ou clique pra escolher</div>
          <div className="hint">até {MAX_DIMENSAO}×{MAX_DIMENSAO}px</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processarArquivo(file);
            }}
          />
        </div>
      )}

      {erro && <p style={{ fontSize: 12, color: "var(--risk)", marginTop: 8 }}>{erro}</p>}
    </div>
  );
}
