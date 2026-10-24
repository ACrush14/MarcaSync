import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { EMPRESA, linhaEmpresa } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de privacidade — MarcaSync",
  description: "Como o MarcaSync usa e protege os seus dados pessoais (LGPD).",
};

const H2 = { fontSize: 18, margin: "28px 0 8px" } as const;

export default function PrivacidadePage() {
  return (
    <PaginaLegal titulo="Política de privacidade" atualizadoEm="24 de outubro de 2026">
      <p>
        Esta política explica como {linhaEmpresa()} (&quot;MarcaSync&quot;) trata os seus dados
        pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD). O
        MarcaSync é o controlador dos dados.
      </p>

      <h2 style={H2}>1. Quais dados coletamos</h2>
      <ul>
        <li>
          <b>Na consulta:</b> seu nome, WhatsApp, o nome da marca e a descrição do que ela vai
          identificar.
        </li>
        <li>
          <b>No pedido de registro:</b> nome ou razão social, CPF ou CNPJ, e-mail, endereço
          completo, natureza jurídica, dados da marca (nome, classe, produtos ou serviços,
          tradução), a imagem da marca, a descrição da sua atividade e os aceites que você marcou,
          com a data.
        </li>
        <li>
          <b>No pagamento:</b> valor, status e o código da cobrança. Os dados do pagamento em si
          ficam com a plataforma de pagamento, e nós não guardamos dados de cartão nem de conta.
        </li>
        <li>
          <b>Técnicos:</b> um código anônimo guardado no seu navegador e as etapas do site que você
          percorre, para sabermos quais telas funcionam. Ele não é ligado ao seu nome nem ao seu
          telefone.
        </li>
      </ul>

      <h2 style={H2}>2. Para que usamos</h2>
      <ul>
        <li>Fazer a busca de anterioridade e falar com você sobre o resultado.</li>
        <li>
          Preencher e protocolar o seu pedido no INPI, acompanhar o processo e avisar você de cada
          novidade e de cada prazo (execução do contrato que você pediu).
        </li>
        <li>Cobrar, conferir o pagamento e devolver valores quando for o caso.</li>
        <li>Cumprir obrigações legais e proteger o serviço contra fraude e abuso.</li>
      </ul>
      <p>
        Para os dados do pedido, usamos também o consentimento que você dá no formulário. Você pode
        retirá-lo a qualquer momento, mas sem esses dados não conseguimos protocolar o pedido.
      </p>

      <h2 style={H2}>3. Com quem compartilhamos</h2>
      <ul>
        <li>
          <b>INPI:</b> recebe os dados necessários ao pedido. O INPI publica dados do processo, como
          o nome do titular e a marca, conforme a lei, e isso foge ao nosso controle.
        </li>
        <li>
          <b>AbacatePay:</b> plataforma que gera e confirma os pagamentos por Pix.
        </li>
        <li>
          <b>Vercel e Neon:</b> empresas de hospedagem do site e do banco de dados onde os dados
          ficam guardados.
        </li>
      </ul>
      <p>Não vendemos os seus dados nem os usamos para publicidade de terceiros.</p>

      <h2 style={H2}>4. Por quanto tempo guardamos</h2>
      <p>
        Guardamos os dados enquanto forem necessários para a finalidade acima, inclusive durante
        todo o processo no INPI, e depois pelo prazo que a lei nos obrigar a manter. Você pode pedir
        a exclusão ou a anonimização do que não precisarmos mais manter.
      </p>

      <h2 style={H2}>5. Como protegemos</h2>
      <p>
        A conexão com o site é criptografada, a área interna exige senha e tem limite de tentativas,
        e o acesso aos dados é restrito a quem precisa deles. Nenhum sistema é 100% seguro, e, se
        houver um incidente que possa lhe causar dano relevante, avisaremos você e a Autoridade
        Nacional de Proteção de Dados, como a lei exige.
      </p>

      <h2 style={H2}>6. Seus direitos</h2>
      <p>
        Você pode pedir a confirmação de que tratamos seus dados, o acesso a eles, a correção, a
        anonimização, bloqueio ou exclusão, a portabilidade, informações sobre com quem
        compartilhamos e a revogação do consentimento (art. 18 da LGPD).{" "}
        {EMPRESA.emailContato
          ? `Para isso, escreva para ${EMPRESA.emailContato}.`
          : "Para isso, fale conosco pelo WhatsApp do site."}
      </p>

      <h2 style={H2}>7. Mudanças</h2>
      <p>Se esta política mudar, a data no topo mostra a última versão.</p>
    </PaginaLegal>
  );
}
