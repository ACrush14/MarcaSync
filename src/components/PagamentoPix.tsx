"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { fmtReais } from "@/lib/planos";
import { track } from "@/lib/track";

interface Cobranca {
  tipo: string;
  valorCentavos: number;
  status: "pendente" | "confirmado" | "estornado" | "expirado";
  brCode: string | null;
  expiraEm: string | null;
}

const ROTULO: Record<string, string> = {
  setup: "Serviço MarcaSync",
  gru: "Taxa do INPI (GRU)",
};

/** Um QR code do Pix, desenhado no navegador a partir do código copia e cola. */
function QrPix({ codigo }: { codigo: string }) {
  const [imagem, setImagem] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(codigo, { margin: 1, width: 192 })
      .then((url) => {
        if (vivo) setImagem(url);
      })
      .catch(() => {
        if (vivo) setImagem(null);
      });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  if (!imagem) return <div style={{ width: 192, height: 192 }} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- imagem gerada na hora (data:), next/image não se aplica
  return <img src={imagem} width={192} height={192} alt="QR code do Pix" />;
}

/**
 * Tela de pagamento: duas cobranças Pix (serviço e taxa do INPI), cada uma com QR code e
 * "copia e cola". Consulta o servidor a cada 5 segundos; quando o AbacatePay confirma, a
 * cobrança vira "pago" sozinha. Nenhum dado pessoal passa por aqui.
 */
export default function PagamentoPix({
  processoId,
  onTudoPago,
}: {
  processoId: string;
  /** Avisa a tela de cima quando as duas cobranças foram pagas. */
  onTudoPago?: () => void;
}) {
  const [cobrancas, setCobrancas] = useState<Cobranca[] | null>(null);
  const [tudoPago, setTudoPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const jaAvisou = useRef(false);
  // Guardamos a função em um ref para a consulta periódica não reiniciar quando ela muda.
  const aoPagar = useRef(onTudoPago);
  useEffect(() => {
    aoPagar.current = onTudoPago;
  });

  useEffect(() => {
    let vivo = true;
    let tempo: ReturnType<typeof setTimeout> | undefined;

    async function consultar() {
      try {
        const res = await fetch(`/api/processos/${processoId}/cobrancas`, { cache: "no-store" });
        const corpo = await res.json();
        if (!vivo) return;
        if (!res.ok) throw new Error(corpo?.error ?? "Não consegui consultar o pagamento.");
        setCobrancas(corpo.cobrancas as Cobranca[]);
        setTudoPago(corpo.tudoPago === true);
        setErro(null);
        if (corpo.tudoPago === true && !jaAvisou.current) {
          jaAvisou.current = true;
          track("pagamento_confirmado");
          aoPagar.current?.();
        }
        if (corpo.tudoPago !== true) tempo = setTimeout(consultar, 5000);
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : "Falha de rede.");
        tempo = setTimeout(consultar, 10000);
      }
    }

    consultar();
    return () => {
      vivo = false;
      if (tempo) clearTimeout(tempo);
    };
  }, [processoId]);

  async function copiar(tipo: string, codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(tipo);
      setTimeout(() => setCopiado((atual) => (atual === tipo ? null : atual)), 2500);
    } catch {
      setErro("Não consegui copiar. Selecione o código e copie à mão.");
    }
  }

  if (!cobrancas) {
    return (
      <div className="helpbox" style={{ marginTop: 24 }} role="status">
        <h3>Pagamento</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-dim)" }}>Gerando os seus Pix…</p>
        {erro && <p style={{ fontSize: 13, color: "var(--risk)", marginTop: 6 }}>{erro}</p>}
      </div>
    );
  }

  if (tudoPago) {
    return (
      <div className="helpbox" style={{ marginTop: 24, borderColor: "var(--safe)" }} role="status">
        <h3 style={{ color: "var(--safe)" }}>Pagamento confirmado</h3>
        <p style={{ fontSize: 14 }}>
          Recebemos {fmtReais(cobrancas.reduce((s, c) => s + c.valorCentavos, 0))}. O seu pedido
          entrou na fila de registro e você será avisado a cada passo.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Pague com Pix para iniciar o registro</h3>
      <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 12 }}>
        São dois Pix, um para cada parte, e o pagamento é conferido sozinho em poucos segundos. Se o
        registro não puder ser feito, o valor volta pelo Pix: tudo, se ainda não pagamos a taxa ao
        INPI; só o serviço, depois disso.
      </p>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {cobrancas.map((c) => (
          <div key={c.tipo} className="helpbox" style={{ textAlign: "center" }}>
            <h3 style={{ marginBottom: 2 }}>{ROTULO[c.tipo] ?? c.tipo}</h3>
            <p className="tab-nums" style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              {fmtReais(c.valorCentavos)}
            </p>
            {c.status === "confirmado" && (
              <p role="status" style={{ color: "var(--safe)", fontWeight: 600 }}>
                Pago ✓
              </p>
            )}
            {c.status === "pendente" && c.brCode && (
              <>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <QrPix codigo={c.brCode} />
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
                  onClick={() => copiar(c.tipo, c.brCode as string)}
                >
                  {copiado === c.tipo ? "Código copiado" : "Copiar código Pix"}
                </button>
              </>
            )}
            {c.status === "pendente" && !c.brCode && (
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Gerando o Pix…</p>
            )}
            {(c.status === "estornado" || c.status === "expirado") && (
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                {c.status === "estornado" ? "Valor devolvido" : "Gerando um novo Pix…"}
              </p>
            )}
          </div>
        ))}
      </div>
      {erro && (
        <p role="alert" style={{ fontSize: 13, color: "var(--risk)", marginTop: 10 }}>
          {erro}
        </p>
      )}
    </div>
  );
}
