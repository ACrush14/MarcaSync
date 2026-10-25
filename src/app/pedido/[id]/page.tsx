import type { Metadata } from "next";
import Link from "next/link";
import PagamentoCheckout from "@/components/PagamentoCheckout";
import RodapeLegal from "@/components/RodapeLegal";

export const metadata: Metadata = {
  title: "Seu pedido — MarcaSync",
  description: "Acompanhe o pagamento do seu pedido de registro de marca.",
  robots: { index: false, follow: false },
};

/**
 * Para onde o AbacatePay devolve o cliente depois de pagar, e onde ele pode retomar o pagamento de
 * um pedido já preenchido. O endereço leva o código do pedido (que ninguém adivinha) e mostra só o
 * estado do pagamento, nenhum dado pessoal.
 */
export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
          <h1 style={{ fontSize: 26 }}>Seu pedido de registro</h1>
          <p className="help">
            Aqui você vê se o pagamento foi confirmado e, se ainda falta, pode pagar. Nada é
            protocolado no INPI antes da confirmação.
          </p>
        </div>
        <PagamentoCheckout processoId={id} />
      </main>
      <RodapeLegal />
    </div>
  );
}
