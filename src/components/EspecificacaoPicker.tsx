"use client";

import { useRef, useState } from "react";
import { normalizarTermo } from "@/lib/termo";

interface Analise {
  preAprovados: string[];
  livres: string[];
  todosPreAprovados: boolean;
}

interface EspecificacaoPickerProps {
  /** Classe de Nice escolhida (1 a 45), ou vazio se ainda não escolheu. */
  classe: string;
  itens: string[];
  onChange: (itens: string[]) => void;
  /** Avisa o formulário se algum item está fora da lista (muda a taxa do INPI). */
  onAnalise: (livre: boolean) => void;
  erro?: string;
}

/**
 * Montagem da especificação (os produtos ou serviços da marca) a partir da lista oficial do
 * INPI. O cliente procura um termo, clica para adicionar e vê, item a item, se ele está na
 * lista pré-aprovada. Item digitado fora da lista é aceito, mas avisa que o pedido passa a
 * usar a taxa de especificação livre (GRU 394), que é bem mais cara.
 *
 * A lista fica no servidor (`/api/catalogo`): o navegador só recebe os 15 melhores resultados
 * de cada busca. A conferência que vale é a do servidor, ao enviar o pedido.
 */
export default function EspecificacaoPicker({
  classe,
  itens,
  onChange,
  onAnalise,
  erro,
}: EspecificacaoPickerProps) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedidoBusca = useRef(0);
  const pedidoAnalise = useRef(0);

  function buscar(texto: string) {
    setBusca(texto);
    if (temporizador.current) clearTimeout(temporizador.current);
    if (!classe || texto.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    temporizador.current = setTimeout(async () => {
      const meu = ++pedidoBusca.current;
      try {
        const res = await fetch(
          `/api/catalogo?${new URLSearchParams({ classe, q: texto.trim() })}`
        );
        const corpo = await res.json();
        if (meu === pedidoBusca.current) setResultados(res.ok ? (corpo.termos ?? []) : []);
      } catch {
        if (meu === pedidoBusca.current) setResultados([]);
      } finally {
        if (meu === pedidoBusca.current) setBuscando(false);
      }
    }, 250);
  }

  async function atualizar(novos: string[]) {
    onChange(novos);
    if (novos.length === 0) {
      setAnalise(null);
      onAnalise(false);
      return;
    }
    const meu = ++pedidoAnalise.current;
    try {
      const res = await fetch("/api/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classe, itens: novos }),
      });
      const corpo = (await res.json()) as Analise;
      if (!res.ok || meu !== pedidoAnalise.current) return;
      setAnalise(corpo);
      onAnalise(!corpo.todosPreAprovados);
    } catch {
      // Sem rede para conferir: o servidor confere de novo ao enviar.
    }
  }

  function adicionar(termo: string) {
    const t = termo.trim();
    if (t.length < 3 || t.length > 300) return;
    if (itens.some((i) => normalizarTermo(i) === normalizarTermo(t))) return;
    if (itens.length >= 50) return;
    void atualizar([...itens, t]);
    setBusca("");
    setResultados([]);
  }

  function remover(termo: string) {
    void atualizar(itens.filter((i) => i !== termo));
  }

  const livres = new Set((analise?.livres ?? []).map(normalizarTermo));
  const naLista = new Set((analise?.preAprovados ?? []).map(normalizarTermo));
  const digitado = busca.trim();
  const jaTem = itens.some((i) => normalizarTermo(i) === normalizarTermo(digitado));

  return (
    <div className="field">
      <label htmlFor="campo-especificacao">Produtos ou serviços que a marca vai assinalar</label>
      <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: "2px 0 8px" }}>
        Procure na lista oficial do INPI e clique para adicionar. Itens da lista usam a taxa mais
        barata (GRU 389); item digitado por fora usa a taxa de especificação livre (GRU 394).
      </p>

      {itens.length > 0 && (
        <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0 }}>
          {itens.map((item) => {
            const chave = normalizarTermo(item);
            const fora = livres.has(chave);
            const dentro = naLista.has(chave);
            return (
              <li
                key={item}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid var(--line, rgba(0,0,0,.08))",
                  fontSize: 13.5,
                }}
              >
                <span>
                  {item} {dentro && <span className="pill safe">da lista</span>}
                  {fora && <span className="pill warm">fora da lista</span>}
                </span>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => remover(item)}
                  aria-label={`Remover ${item}`}
                >
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {analise && !analise.todosPreAprovados && (
        <p
          role="status"
          style={{ fontSize: 13, color: "var(--ink)", margin: "0 0 10px", fontWeight: 600 }}
        >
          {analise.livres.length === 1
            ? "1 item está fora da lista do INPI"
            : `${analise.livres.length} itens estão fora da lista do INPI`}
          : o pedido vai pela GRU 394, mais cara. Troque por termos da lista para voltar à GRU 389.
        </p>
      )}
      {analise?.todosPreAprovados && (
        <p role="status" style={{ fontSize: 13, color: "var(--safe)", margin: "0 0 10px" }}>
          Todos os itens estão na lista do INPI: vale a GRU 389.
        </p>
      )}

      <input
        id="campo-especificacao"
        type="text"
        autoComplete="off"
        disabled={!classe}
        placeholder={
          classe ? "Digite para procurar, ex.: bolo" : "Escolha a classe de Nice primeiro"
        }
        value={busca}
        onChange={(e) => buscar(e.target.value)}
        aria-invalid={!!erro}
        aria-describedby={erro ? "erro-especificacao" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (resultados[0] && normalizarTermo(resultados[0]) === normalizarTermo(digitado)) {
              adicionar(resultados[0]);
            }
          }
        }}
      />

      {buscando && <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>Buscando…</p>}

      {resultados.length > 0 && (
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
          {resultados.map((t) => (
            <li key={t}>
              <button
                type="button"
                className="btn ghost"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  fontSize: 13,
                  marginBottom: 2,
                }}
                onClick={() => adicionar(t)}
              >
                + {t}
              </button>
            </li>
          ))}
        </ul>
      )}

      {digitado.length >= 3 && !jaTem && !buscando && classe && (
        <button
          type="button"
          className="btn ghost"
          style={{ marginTop: 8, fontSize: 12.5, padding: "6px 10px" }}
          onClick={() => adicionar(digitado)}
        >
          Não achei: adicionar &quot;{digitado}&quot; como texto livre (GRU 394)
        </button>
      )}

      {erro && (
        <p
          id="erro-especificacao"
          role="alert"
          style={{ fontSize: 13, color: "var(--risk)", marginTop: 6 }}
        >
          {erro}
        </p>
      )}
    </div>
  );
}
