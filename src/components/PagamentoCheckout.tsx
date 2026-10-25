"use client";

import { useEffect, useRef, useState } from "react";
import { fmtReais } from "@/lib/planos";
import { PARCELAS_MAX_CARTAO } from "@/lib/pacotes";
import { track } from "@/lib/track";

interface Cobranca {
  tipo: string;
  valorCentavos: number;
  status: "pendente" | "confirmado" | "estornado" | "expirado";
  checkoutUrl: string | null;
  expiraEm: string | null;
}

/**
 * Tela de pagamento: um pagamento só (o serviço e a taxa do INPI juntos), feito na página do
 * AbacatePay por Pix ou cartão. Consulta o servidor a cada 5 segundos; quando o AbacatePay
 * confirma, a tela muda sozinha. Nenhum dado pessoal passa por aqui.
 */
export default function PagamentoCheckout({
  processoId,
  onTudoPago,
}: {
  processoId: string;
  /** Avisa a tela de cima quando o pagamento foi confirmado. */
  onTudoPago?: () => void;
}) {
  const [cobrancas, setCobrancas] = useState<Cobranca[] | null>(null);
  const [tudoPago, setTudoPago] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
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
        const ligado = (corpo.pagamentoAtivo ?? corpo.pixAtivo) !== false;
        setAtivo(ligado);
        if (!ligado) return;
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

  if (!cobrancas) {
    return (
      <div className="helpbox" style={{ marginTop: 24 }} role="status">
        <h3>Pagamento</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-dim)" }}>Preparando o pagamento…</p>
        {erro && <p style={{ fontSize: 13, color: "var(--risk)", marginTop: 6 }}>{erro}</p>}
      </div>
    );
  }

  const total = cobrancas.reduce((s, c) => s + c.valorCentavos, 0);

  if (cobrancas.length === 0) {
    return (
      <div className="helpbox" style={{ marginTop: 24 }} role="status">
        <h3>Pagamento</h3>
        <p style={{ fontSize: 14 }}>
          Ainda não há um pedido para pagar. Preencha os dados do pedido e o pagamento aparece aqui.
        </p>
      </div>
    );
  }

  if (!ativo) {
    return (
      <div className="helpbox" style={{ marginTop: 24 }} role="status">
        <h3>Pagamento</h3>
        <p style={{ fontSize: 14 }}>
          O pagamento pelo site ainda não está ligado nesta versão. Eu combino o pagamento de{" "}
          {fmtReais(total)} com você pelo WhatsApp e o registro segue depois da confirmação.
        </p>
      </div>
    );
  }

  if (tudoPago) {
    return (
      <div className="helpbox" style={{ marginTop: 24, borderColor: "var(--safe)" }} role="status">
        <h3 style={{ color: "var(--safe)" }}>Pagamento confirmado</h3>
        <p style={{ fontSize: 14 }}>
          Recebemos {fmtReais(total)}. O seu pedido entrou na fila de registro e você será avisado a
          cada passo.
        </p>
      </div>
    );
  }

  const c = cobrancas.find((x) => x.status === "pendente") ?? cobrancas[0];

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Pague para iniciar o registro</h3>
      <div className="helpbox" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: "0 0 2px" }}>
          Serviço do MarcaSync + taxa do INPI, num pagamento só
        </p>
        <p className="tab-nums" style={{ fontSize: 26, fontWeight: 600, margin: "0 0 10px" }}>
          {fmtReais(c?.valorCentavos ?? total)}
        </p>

        {c?.status === "pendente" && c.checkoutUrl && (
          <>
            <a
              className="btn"
              href={c.checkoutUrl}
              onClick={() => track("pagamento_iniciado")}
              style={{ justifyContent: "center", width: "100%", maxWidth: 360 }}
            >
              Pagar com Pix ou cartão →
            </a>
            <p style={{ fontSize: 12.5, color: "var(--ink-dim)", margin: "10px 0 0" }}>
              Você paga numa página segura do AbacatePay. No cartão, em até {PARCELAS_MAX_CARTAO}x. A
              confirmação chega sozinha, em poucos segundos.
            </p>
          </>
        )}
        {c?.status === "pendente" && !c.checkoutUrl && (
          <p role="status" style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Gerando o seu pagamento…
          </p>
        )}
        {c?.status === "expirado" && (
          <p role="status" style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Gerando um novo pagamento…
          </p>
        )}
        {c?.status === "estornado" && (
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Valor devolvido.</p>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: "12px 0 0" }}>
        Se o registro não puder ser feito, o dinheiro volta: tudo, se ainda não tivermos pago a taxa
        ao INPI; só o valor do serviço, depois disso.
      </p>
      {erro && (
        <p role="alert" style={{ fontSize: 13, color: "var(--risk)", marginTop: 10 }}>
          {erro}
        </p>
      )}
    </div>
  );
}
