import Link from "next/link";
import RodapeLegal from "./RodapeLegal";

/** Moldura das páginas legais: topo com a marca, o texto num painel e o rodapé. */
export default function PaginaLegal({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <Link href="/" className="mark" style={{ textDecoration: "none", color: "inherit" }}>
            MarcaSync
          </Link>
        </div>
        <Link href="/consulta" className="btn secondary">
          Consultar uma marca
        </Link>
      </div>
      <main className="panel" style={{ lineHeight: 1.65 }}>
        <div className="panel-head">
          <h1 style={{ fontSize: 26 }}>{titulo}</h1>
          <p className="help">Última atualização: {atualizadoEm}</p>
        </div>
        <div className="texto-legal">{children}</div>
      </main>
      <RodapeLegal />
    </div>
  );
}
