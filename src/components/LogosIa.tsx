"use client";

import { useEffect, useRef, useState } from "react";
import { LOGOS_POR_RODADA, RODADAS_POR_PEDIDO } from "@/lib/logo-ia";

interface LogosIaProps {
  processoId: string | null;
  marca: string;
  atividade: string;
  apresentacao: "figurativa" | "mista";
  /** Os dados do titular e da marca já estão preenchidos e válidos? Só então a IA é liberada. */
  dadosProntos: boolean;
  /** O cliente escolheu uma opção: ela segue pelo envio normal da imagem da marca. */
  onUsar: (arquivo: File) => void;
  /** Está enviando a imagem escolhida (segura os botões). */
  ocupado: boolean;
}

type Opcao =
  | { estado: "gerando" }
  | { estado: "pronta"; imagem: string }
  | { estado: "erro"; mensagem: string };

/**
 * "Criar a logo com IA": gera 4 opções (uma por estilo) a partir do nome e da atividade, o cliente
 * escolhe uma e ela entra no mesmo envio da imagem da marca. Fica escondido enquanto o servidor não
 * tiver a chave do Gemini. Cada pedido tem um limite de rodadas (o servidor é quem confere).
 */
export default function LogosIa({
  processoId,
  marca,
  atividade,
  apresentacao,
  dadosProntos,
  onUsar,
  ocupado,
}: LogosIaProps) {
  const [disponivel, setDisponivel] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [ciente, setCiente] = useState(false);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);
  const geracao = useRef(0);

  useEffect(() => {
    if (!processoId) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/processos/${processoId}/logo-ia`, { cache: "no-store" });
        if (!res.ok) return;
        const corpo = (await res.json()) as { disponivel?: boolean; restantes?: number };
        if (!vivo) return;
        setDisponivel(corpo.disponivel === true);
        setRestantes(typeof corpo.restantes === "number" ? corpo.restantes : null);
      } catch {
        /* sem a IA o formulário segue normal, com o envio da imagem */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [processoId]);

  if (!disponivel || !processoId) return null;

  const rodadasRestantes = restantes === null ? null : Math.floor(restantes / LOGOS_POR_RODADA);
  const esgotou = restantes !== null && restantes < LOGOS_POR_RODADA;
  const podeGerar = dadosProntos && ciente && !gerando && !esgotou && !ocupado;

  async function gerar() {
    if (!processoId) return;
    const minha = ++geracao.current;
    setGerando(true);
    setEscolhida(null);
    setOpcoes(Array.from({ length: LOGOS_POR_RODADA }, () => ({ estado: "gerando" as const })));

    const pedidos = Array.from({ length: LOGOS_POR_RODADA }, async (_, variacao) => {
      let nova: Opcao;
      try {
        const res = await fetch(`/api/processos/${processoId}/logo-ia`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ marca, atividade, apresentacao, variacao, cienteIa: true }),
        });
        const corpo = (await res.json()) as { imagem?: string; error?: string; restantes?: number };
        if (!res.ok || !corpo.imagem) throw new Error(corpo.error ?? "Não consegui criar esta logo.");
        if (typeof corpo.restantes === "number") setRestantes(corpo.restantes);
        nova = { estado: "pronta", imagem: corpo.imagem };
      } catch (e) {
        nova = { estado: "erro", mensagem: e instanceof Error ? e.message : "Falha de rede." };
      }
      if (geracao.current !== minha) return;
      setOpcoes((antes) => antes.map((o, i) => (i === variacao ? nova : o)));
    });
    await Promise.all(pedidos);
    if (geracao.current === minha) setGerando(false);
  }

  async function usar(indice: number) {
    const opcao = opcoes[indice];
    if (opcao?.estado !== "pronta") return;
    setEscolhida(indice);
    const blob = await (await fetch(opcao.imagem)).blob();
    onUsar(new File([blob], `logo-ia-${indice + 1}.jpg`, { type: "image/jpeg" }));
  }

  return (
    <div className="helpbox" style={{ margin: "0 0 14px" }}>
      <h3>Não tem logo? Crie com IA</h3>
      <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: "4px 0 10px" }}>
        Criamos {LOGOS_POR_RODADA} opções a partir do nome da marca e da atividade que você
        descreveu. Você escolhe uma e ela segue como a imagem da marca. Dá para pedir novas opções
        até {RODADAS_POR_PEDIDO} vezes
        {rodadasRestantes !== null && !esgotou
          ? ` (ainda restam ${rodadasRestantes})`
          : ""}
        .
      </p>

      <div className="field" style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={ciente}
            onChange={(e) => setCiente(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>
            Entendo que a logo criada por IA pode não ter proteção de direito autoral, pode
            lembrar uma marca que já existe e que quem decide o registro é o INPI. A busca de
            anterioridade que fizemos vale para o nome, não para o desenho.
          </span>
        </label>
      </div>

      {!dadosProntos && (
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 8 }}>
          Preencha antes os dados do titular, da marca e a atividade (os campos acima e abaixo):
          a IA só é liberada depois disso.
        </p>
      )}

      <button className="btn secondary" type="button" disabled={!podeGerar} onClick={gerar}>
        {gerando
          ? "Criando as logos…"
          : opcoes.length > 0
            ? "Criar outras 4 logos"
            : "Criar 4 logos com IA"}
      </button>
      {esgotou && (
        <p style={{ fontSize: 13, marginTop: 8 }}>
          Você usou todas as rodadas deste pedido. Escolha uma das opções acima ou envie a sua
          própria imagem.
        </p>
      )}

      {opcoes.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          {opcoes.map((o, i) => (
            <div
              key={i}
              style={{
                border: `2px solid ${escolhida === i ? "var(--accent-strong)" : "var(--border)"}`,
                borderRadius: 10,
                padding: 8,
                background: "#fff",
                textAlign: "center",
              }}
            >
              {o.estado === "gerando" && (
                <div style={{ padding: "50px 0", fontSize: 12.5, color: "#505b69" }}>Criando…</div>
              )}
              {o.estado === "erro" && (
                <div style={{ padding: "18px 4px", fontSize: 12.5, color: "var(--risk)" }}>
                  {o.mensagem}
                </div>
              )}
              {o.estado === "pronta" && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagem em data: URL, next/image não se aplica */}
                  <img
                    src={o.imagem}
                    alt={`Opção ${i + 1} de logo criada por IA`}
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "contain" }}
                  />
                  <button
                    type="button"
                    className={escolhida === i ? "btn" : "btn ghost"}
                    style={{ marginTop: 6, padding: "6px 10px", fontSize: 12.5, minHeight: 32 }}
                    disabled={ocupado}
                    aria-pressed={escolhida === i}
                    onClick={() => void usar(i)}
                  >
                    {escolhida === i ? "Escolhida" : "Usar esta"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {opcoes.some((o) => o.estado === "pronta") && (
        <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>
          Imagens criadas por IA (Google Gemini). Confira se o desenho não lembra uma marca
          conhecida antes de escolher.
        </p>
      )}
    </div>
  );
}
