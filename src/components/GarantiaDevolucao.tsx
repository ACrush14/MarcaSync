import { GARANTIA_CURTA, GARANTIA_REGRAS, GARANTIA_TITULO } from "@/lib/garantia";

/** Caixa com a garantia de devolução, usada onde o cliente decide ou paga. */
export default function GarantiaDevolucao({ margem = "16px 0" }: { margem?: string }) {
  return (
    <div className="helpbox" style={{ margin: margem, borderColor: "var(--safe)" }}>
      <h3 style={{ color: "var(--safe)" }}>{GARANTIA_TITULO}</h3>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>{GARANTIA_CURTA}</p>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>Como funciona a devolução</summary>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--ink-dim)" }}>
          {GARANTIA_REGRAS.map((r) => (
            <li key={r} style={{ marginBottom: 4 }}>
              {r}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
