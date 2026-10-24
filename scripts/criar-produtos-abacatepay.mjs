/**
 * Cria no AbacatePay os produtos do catálogo de marcas do MarcaSync (serviço, taxas do INPI e
 * monitoramento). Não é usado pelo site: o pedido cobra por valor, via /transparents/create.
 * Os produtos servem para links de pagamento e para a assinatura do monitoramento.
 *
 * Uso:   node --env-file=.env.local scripts/criar-produtos-abacatepay.mjs
 * A chave (ABACATEPAY_API_KEY) decide o ambiente: "abc_dev_..." cria no modo de teste; a de produção
 * cria de verdade. Rodar de novo é seguro: um produto cujo externalId já existe é só avisado.
 * Precisa da permissão PRODUCT:CREATE na chave.
 */
const chave = process.env.ABACATEPAY_API_KEY;
if (!chave) {
  console.error("Defina ABACATEPAY_API_KEY (por exemplo com --env-file=.env.local).");
  process.exit(1);
}

const PRODUTOS = [
  {
    externalId: "marcasync-servico-registro",
    name: "MarcaSync - serviço de registro de marca",
    description:
      "Busca de anterioridade, preparo e protocolo do pedido de registro no INPI (uma classe).",
    price: 49_900,
  },
  {
    externalId: "inpi-gru-389-integral",
    name: "Taxa do INPI (GRU 389) - valor integral",
    description: "Pedido de registro com especificação pré-aprovada, por classe, sem desconto.",
    price: 88_000,
  },
  {
    externalId: "inpi-gru-389-desconto",
    name: "Taxa do INPI (GRU 389) - com desconto de 50%",
    description:
      "Pedido de registro com especificação pré-aprovada, por classe, para quem tem direito ao desconto.",
    price: 44_000,
  },
  {
    externalId: "inpi-gru-394-integral",
    name: "Taxa do INPI (GRU 394) - valor integral",
    description:
      "Pedido de registro com especificação de livre preenchimento, por classe, sem desconto.",
    price: 172_000,
  },
  {
    externalId: "inpi-gru-394-desconto",
    name: "Taxa do INPI (GRU 394) - com desconto de 50%",
    description:
      "Pedido de registro com especificação de livre preenchimento, por classe, com desconto.",
    price: 86_000,
  },
  {
    externalId: "marcasync-monitoramento-mensal",
    name: "MarcaSync - monitoramento do pedido (mensal)",
    description:
      "Acompanhamento da situação e dos despachos do seu pedido no INPI, com aviso a cada novidade.",
    price: 2_900,
    cycle: "MONTHLY",
  },
];

let falhas = 0;
for (const p of PRODUTOS) {
  const res = await fetch("https://api.abacatepay.com/v2/products/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...p, currency: "BRL" }),
  });
  const corpo = await res.json().catch(() => ({}));
  if (res.ok && corpo.success !== false) {
    console.log(
      `criado   ${p.externalId}  R$ ${(p.price / 100).toFixed(2)}${corpo.data?.devMode ? "  (teste)" : ""}`
    );
  } else {
    falhas++;
    console.log(
      `falhou   ${p.externalId}  [${res.status}] ${typeof corpo.error === "string" ? corpo.error : ""}`
    );
  }
}
process.exit(falhas ? 1 : 0);
