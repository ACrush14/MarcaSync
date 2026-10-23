import type { AvisoAnterioridade } from "@/lib/anterioridade";

/**
 * Caixa de aviso "já existe pedido ou registro parecido". Aparece no resultado da busca e no
 * formulário do pedido, para o cliente decidir com a informação na mão antes de pagar a taxa
 * do INPI. Não aparece quando não há aviso (`nivel` igual a "nenhum").
 */
export default function AvisoAnterioridadeBox({ aviso }: { aviso: AvisoAnterioridade }) {
  if (aviso.nivel === "nenhum") return null;
  const bloqueio = aviso.nivel === "provavel-bloqueio";

  return (
    <div
      className="helpbox"
      role="note"
      style={{ borderColor: bloqueio ? "var(--risk)" : "var(--ink-dim)", margin: "16px 0" }}
    >
      <h3 style={{ color: bloqueio ? "var(--risk)" : undefined }}>{aviso.titulo}</h3>
      <p style={{ fontSize: 14 }}>{aviso.texto}</p>
      {aviso.alternativas.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
            O que dá para fazer mesmo assim
          </summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5 }}>
            {aviso.alternativas.map((a) => (
              <li key={a} style={{ marginBottom: 6 }}>
                {a}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 8 }}>
            Isto é informação, não aconselhamento jurídico. Para seguir por um desses caminhos, fale
            comigo antes de pagar qualquer taxa.
          </p>
        </details>
      )}
    </div>
  );
}
