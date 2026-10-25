import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { EMPRESA, linhaEmpresa } from "@/lib/empresa";
import { GARANTIA_CURTA, GARANTIA_REGRAS } from "@/lib/garantia";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS, fmtReais } from "@/lib/planos";

export const metadata: Metadata = {
  title: "Termos de uso — MarcaSync",
  description: "As regras do serviço de busca e registro de marcas do MarcaSync.",
};

const H2 = { fontSize: 18, margin: "28px 0 8px" } as const;

export default function TermosPage() {
  return (
    <PaginaLegal titulo="Termos de uso" atualizadoEm="24 de outubro de 2026">
      <p>
        Estes termos valem para o serviço oferecido por {linhaEmpresa()} (&quot;MarcaSync&quot;) em
        marcasync.com.br. Ao enviar um pedido de registro e pagar por ele, você concorda com o que
        está escrito aqui.
      </p>

      <h2 style={H2}>1. O que o MarcaSync faz</h2>
      <p>
        O MarcaSync faz uma busca de anterioridade (marcas parecidas já registradas ou pedidas no
        INPI) e, se você decidir seguir, prepara e protocola o seu pedido de registro de marca no
        INPI, atuando como seu procurador. O MarcaSync é um serviço independente e não tem vínculo
        com o INPI. Não prestamos aconselhamento jurídico: a busca indica risco a partir de dados
        públicos, e a decisão final é sempre do INPI.
      </p>

      <h2 style={H2}>2. Preços</h2>
      <ul>
        <li>
          <b>Serviço do MarcaSync:</b> {fmtReais(SETUP_CENTAVOS)} por pedido (uma classe).
        </li>
        <li>
          <b>Taxa do INPI (GRU):</b> é cobrada pelo INPI, não pelo MarcaSync. O valor depende da sua
          natureza jurídica (há desconto de 50% para pessoa física que não seja sócia de empresa do
          mesmo ramo, MEI, microempresa, empresa de pequeno porte e outras entidades) e de a
          especificação usar só itens da lista pré-aprovada do INPI. Você vê o valor antes de pagar.
          Se o valor da tela de emissão da guia for diferente do mostrado, avisamos antes de
          qualquer pagamento.
        </li>
        <li>
          <b>Monitoramento (opcional):</b> {fmtReais(MONITORAMENTO_CENTAVOS)} por mês, depois da
          publicação do pedido.
        </li>
      </ul>

      <h2 style={H2}>3. Pagamento</h2>
      <p>
        O pagamento é um só, que cobre o serviço e a taxa do INPI, e é feito por Pix ou cartão de
        crédito (em até 3 vezes) na página da plataforma AbacatePay. O pedido só segue depois que o
        pagamento é confirmado.
      </p>

      <h2 style={H2}>4. Garantia de devolução</h2>
      <p>
        <b>{GARANTIA_CURTA}</b> Na prática:
      </p>
      <ul>
        {GARANTIA_REGRAS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p>
        Nada neste item afasta os direitos que a lei já lhe dá, inclusive os do Código de Defesa do
        Consumidor.
      </p>

      <h2 style={H2}>5. Não há garantia de registro</h2>
      <p>
        Quem decide se a marca é registrada é o INPI. Ele pode indeferir o pedido, por exemplo, por
        haver marca anterior igual ou parecida no mesmo ramo, e pode fazer exigências com prazo
        curto. A especificação (os produtos ou serviços) e a imagem da marca não podem ser trocadas
        depois do protocolo.
      </p>

      <h2 style={H2}>6. O que combinamos com você</h2>
      <ul>
        <li>Você informa dados verdadeiros e completos.</li>
        <li>
          Você declara, sob as penas da lei, que exerce de forma efetiva e lícita a atividade a que
          a marca se refere (art. 128 da Lei 9.279/96).
        </li>
        <li>Você tem os direitos sobre a imagem ou o logotipo que enviar.</li>
        <li>
          Você assina a procuração que enviamos. Ela precisa estar no processo em até 60 dias do
          protocolo, senão o INPI arquiva o pedido.
        </li>
        <li>
          Você cria o seu cadastro no e-INPI e <b>nunca nos passa a sua senha</b>: ela é pessoal e
          não precisamos dela.
        </li>
      </ul>

      <h2 style={H2}>7. Responsabilidade</h2>
      <p>
        Dentro do que a lei permite, o MarcaSync não responde por decisões do INPI, por prazos que
        dependam de informações que você não nos deu, nem por prejuízos que não tenham ligação
        direta com uma falha do nosso serviço.
      </p>

      <h2 style={H2}>8. Mudanças e contato</h2>
      <p>
        Podemos atualizar estes termos; a data no topo mostra a última versão. Pedidos já pagos
        seguem as regras vigentes no dia do pagamento.
        {EMPRESA.emailContato ? ` Dúvidas: ${EMPRESA.emailContato}.` : ""}
      </p>
    </PaginaLegal>
  );
}
