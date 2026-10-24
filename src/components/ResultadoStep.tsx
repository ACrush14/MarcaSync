"use client";

import AvisoAnterioridadeBox from "./AvisoAnterioridadeBox";
import type { AvisoAnterioridade } from "@/lib/anterioridade";
import { useState } from "react";
import { riskTier } from "@/lib/fonetica";
import { agruparPorArea } from "@/lib/classes";
import type { ColidenciaMatch, ColidenciaResultado, FonteColidencia } from "@/lib/colidencia";
import TrackView from "./TrackView";
import { track } from "@/lib/track";

/** Quantas marcas mostrar por grupo (o servidor já entrega no máximo 10 no total). */
const MAX_POR_GRUPO = 5;

/**
 * Tabela de marcas encontradas. Mesma tabela de antes, agora num componente para
 * poder aparecer uma vez por grupo (mesmo ramo, outros ramos, sem classe).
 */
function TabelaMarcas({ lista, fonte }: { lista: ColidenciaMatch[]; fonte: FonteColidencia }) {
  return (
    <div className="table-wrap table-cards" style={{ marginBottom: 16 }}>
      <table>
        <thead>
          <tr>
            <th>Marca {fonte === "real" ? "encontrada" : "na base"}</th>
            <th>Classe</th>
            <th>Similaridade fonética</th>
            <th>Risco</th>
            {fonte === "real" && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {lista.map((m) => {
            const t = riskTier(m.pct);
            return (
              <tr key={`${m.nome}-${m.numeroProcesso ?? ""}`}>
                <td>
                  {m.nome}
                  {m.numeroProcesso && (
                    <>
                      <br />
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                        processo {m.numeroProcesso}
                      </span>
                    </>
                  )}
                </td>
                <td data-label="Classe">{m.classe ? `NCL ${m.classe}` : "—"}</td>
                <td className="tab-nums" data-label="Similaridade">
                  {m.pct}%
                </td>
                <td data-label="Risco">
                  <span className={`pill ${t.cls}`}>{t.label}</span>
                </td>
                {fonte === "real" && (
                  <td data-label="Status" style={{ fontSize: 12 }}>
                    {m.status ?? "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface ResultadoStepProps {
  descricao: string;
  /** Aviso de marca anterior parecida no ramo (nivel "nenhum" não mostra nada). */
  aviso: AvisoAnterioridade;
  colidencia: ColidenciaResultado;
  onColidenciaAtualizada: (c: ColidenciaResultado) => void;
  onRefazer: () => void;
  onVerPlano: () => void;
  /** Link wa.me pro WhatsApp do MarcaSync; null se o número não estiver configurado. */
  whatsappHref: string | null;
  /** Chamado quando o cliente decide falar comigo (o <a> abre o WhatsApp sozinho). */
  onContato: () => void;
}

export default function ResultadoStep({
  descricao,
  aviso,
  colidencia,
  onColidenciaAtualizada,
  onRefazer,
  onVerPlano,
  whatsappHref,
  onContato,
}: ResultadoStepProps) {
  const { matches, ncl, fonte, avisoFonteReal, termo, baseLocal, risco } = colidencia;
  const grupos = agruparPorArea(matches);
  // `principal` é a marca que define o nível de colisão: a mais parecida entre as do mesmo
  // ramo e as sem classe (que não dá para descartar). Sem separação por ramo, é a `top`.
  const principal = risco.principal;
  const porRamo = risco.modo === "por-ramo";
  const tier = principal ? riskTier(principal.pct) : null;
  // A resposta chega por JSON, então comparamos a marca pelo nome e pelo número do processo.
  const principalConfirmada =
    !!principal &&
    risco.noRamo?.nome === principal.nome &&
    risco.noRamo?.numeroProcesso === principal.numeroProcesso;
  const rotuloColisao = !porRamo
    ? "Nível de colisão"
    : principalConfirmada
      ? "Nível de colisão no seu ramo"
      : "Nível de colisão (classe não confirmada)";

  const [termoBusca, setTermoBusca] = useState(termo);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  async function refazerBusca() {
    const alvo = termoBusca.trim();
    if (!alvo) return;
    setBuscando(true);
    setErroBusca(null);
    try {
      const params = new URLSearchParams({ marca: alvo, descricao });
      const res = await fetch(`/api/colidencia?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Falha na busca.");
      onColidenciaAtualizada(body as ColidenciaResultado);
    } catch (e) {
      setErroBusca(e instanceof Error ? e.message : "Falha de rede.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <TrackView nome="resultado_visto" />
      <div className="panel-head">
        <h2>Resultado da análise</h2>
        <p className="help">
          Busca de anterioridade de &quot;{termo}&quot; contra a{" "}
          {fonte === "real" ? "base real do INPI" : "base de demonstração"} e inferência de classe a
          partir da descrição informada.
          {baseLocal && (
            <>
              {" "}
              {baseLocal.usadaSozinha
                ? "A busca ao vivo do INPI não respondeu; usamos a cópia oficial dos dados abertos do INPI"
                : "Também comparamos com a cópia oficial dos dados abertos do INPI, que acha grafias de som parecido"}
              {baseLocal.atualizadaEm &&
                ` (arquivo de ${new Date(baseLocal.atualizadaEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })})`}
              .
            </>
          )}
        </p>
      </div>

      {fonte === "demo" && avisoFonteReal && (
        <div className="helpbox" style={{ borderColor: "var(--warm)", marginBottom: 20 }}>
          <h3 style={{ color: "var(--warm)" }}>Modo demonstração</h3>
          <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{avisoFonteReal}</p>
        </div>
      )}

      <div className="risk-summary">
        {principal ? (
          <>
            <div className="metric">
              <div className="lbl">{rotuloColisao}</div>
              <div className="val">{principal.pct}%</div>
              <div className="sub">
                <span className={`pill ${tier!.cls}`}>{tier!.label}</span>{" "}
                <span className="pill accent">{fonte === "real" ? "INPI" : "exemplo"}</span>
                {porRamo && !principalConfirmada && (
                  <>
                    <br />
                    Marca sem classe informada: não dá para descartar que seja do seu ramo.
                  </>
                )}
              </div>
            </div>
            <div className="metric">
              <div className="lbl">Marca mais próxima</div>
              <div className="val" style={{ fontSize: 18 }}>
                {principal.nome}
              </div>
              <div className="sub">
                {principal.classe ? `NCL ${principal.classe}` : "Classe não informada"}
                {principal.status ? ` · ${principal.status}` : ""}
                {porRamo && risco.outrosRamos && (
                  <>
                    <br />
                    Em outros ramos: até {risco.outrosRamos.pct}% ({risco.outrosRamos.nome}).
                  </>
                )}
              </div>
            </div>
          </>
        ) : porRamo && risco.outrosRamos ? (
          <div className="metric">
            <div className="lbl">Nível de colisão no seu ramo</div>
            <div className="val" style={{ fontSize: 19 }}>
              Nenhuma marca parecida
            </div>
            <div className="sub">
              <span className="pill safe">Risco baixo no seu ramo</span>{" "}
              <span className="pill accent">{fonte === "real" ? "INPI" : "exemplo"}</span>
              <br />
              Em outros ramos: até {risco.outrosRamos.pct}% ({risco.outrosRamos.nome}, NCL{" "}
              {risco.outrosRamos.classe}). O INPI também compara classes relacionadas.
            </div>
          </div>
        ) : (
          <div className="metric">
            <div className="lbl">Nível de colisão</div>
            <div className="val" style={{ fontSize: 19 }}>
              Nenhuma marca parecida
            </div>
            <div className="sub">
              <span className="pill safe">Risco baixo</span>{" "}
              <span className="pill accent">INPI</span>
            </div>
          </div>
        )}
        <div className="metric">
          <div className="lbl">Classe sugerida</div>
          <div className="val" style={{ fontSize: 18 }}>
            NCL {ncl.code}
          </div>
          <div className="sub">
            {ncl.label}{" "}
            <span className="pill accent" style={{ marginLeft: 4 }}>
              confiança {ncl.confidence}
            </span>
          </div>
        </div>
      </div>

      {/* CTA no topo: quem já viu o resultado resumido não precisa rolar a lista inteira. */}
      <div className="cta-topo">
        <button className="btn" onClick={onVerPlano}>
          Ver preço do registro →
        </button>
        <span className="cta-topo-nota">
          Você só paga depois de preencher os dados do pedido. Se não der certo, o dinheiro volta.
        </span>
      </div>

      {matches.length > 0 && !grupos.separavel && (
        <div style={{ marginBottom: 24 }}>
          {ncl.confidence === "baixa" && (
            <p className="help" style={{ marginBottom: 12 }}>
              Não deu para separar as marcas por ramo, porque a descrição está vaga demais para
              sugerir uma classe com segurança. Descreva melhor o que você vende (em &quot;Refazer
              consulta&quot;) para ver quais marcas parecidas estão no seu ramo.
            </p>
          )}
          <TabelaMarcas lista={matches.slice(0, 8)} fonte={fonte} />
        </div>
      )}

      {matches.length > 0 && grupos.separavel && (
        <div style={{ marginBottom: 24 }}>
          <p className="help" style={{ marginBottom: 16 }}>
            Separamos as marcas parecidas pelo ramo: &quot;mesmo ramo&quot; quer dizer a mesma
            classe de Nice que a sua (NCL {ncl.code}). O INPI também compara classes relacionadas,
            por isso eu confirmo isso com você antes do protocolo.
          </p>

          <section className="wave-section" aria-labelledby="grupo-mesmo-ramo">
            <h3 id="grupo-mesmo-ramo">
              No seu ramo (NCL {ncl.code}){" "}
              <span className={`pill ${grupos.mesmaArea.length > 0 ? "risk" : "safe"}`}>
                {grupos.mesmaArea.length}
              </span>
            </h3>
            <p className="sub">São as que mais podem barrar o seu registro.</p>
            {grupos.mesmaArea.length > 0 ? (
              <TabelaMarcas lista={grupos.mesmaArea.slice(0, MAX_POR_GRUPO)} fonte={fonte} />
            ) : (
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                Nenhuma das marcas parecidas encontradas está na classe NCL {ncl.code}.
              </p>
            )}
          </section>

          {grupos.outrasAreas.length > 0 && (
            <section className="wave-section" aria-labelledby="grupo-outros-ramos">
              <h3 id="grupo-outros-ramos">
                Em outros ramos <span className="pill accent">{grupos.outrasAreas.length}</span>
              </h3>
              <p className="sub">
                Têm nome parecido, mas registradas em outra classe. Costumam pesar menos, mas vale
                conferir.
              </p>
              <TabelaMarcas lista={grupos.outrasAreas.slice(0, MAX_POR_GRUPO)} fonte={fonte} />
            </section>
          )}

          {grupos.semClasse.length > 0 && (
            <section className="wave-section" aria-labelledby="grupo-sem-classe">
              <h3 id="grupo-sem-classe">
                Classe não informada <span className="pill accent">{grupos.semClasse.length}</span>
              </h3>
              <p className="sub">
                A base do INPI não traz a classe destas marcas, então não dá para dizer se são do
                seu ramo.
              </p>
              <TabelaMarcas lista={grupos.semClasse.slice(0, 3)} fonte={fonte} />
            </section>
          )}
        </div>
      )}

      <div className="wave-section">
        <h3>Buscar outro termo</h3>
        <p className="sub">
          Quer comparar com uma variação de grafia ou outra marca? Busca de novo — o resultado acima
          é atualizado, sem perder o restante da análise.
        </p>
        <div className="field busca-row">
          <div>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refazerBusca()}
              placeholder="Ex.: Kaza Doce, Casa do Doce..."
            />
          </div>
          <button className="btn secondary" onClick={refazerBusca} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar de novo →"}
          </button>
        </div>
        {erroBusca && (
          <p style={{ fontSize: 12, color: "var(--risk)", marginTop: 8 }}>{erroBusca}</p>
        )}
      </div>

      <AvisoAnterioridadeBox aviso={aviso} />

      <div className="cta-row cta-fixo">
        <button className="btn ghost" onClick={onRefazer}>
          ← Refazer consulta
        </button>
        <button className="btn" onClick={onVerPlano}>
          Ver preço do registro →
        </button>
        {whatsappHref ? (
          <a
            className="btn secondary"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              track("whatsapp_clicado", { onde: "resultado" });
              onContato();
            }}
          >
            Falar comigo no WhatsApp →
          </a>
        ) : (
          <button className="btn secondary" onClick={onContato}>
            Quero que me chamem →
          </button>
        )}
      </div>
    </>
  );
}
