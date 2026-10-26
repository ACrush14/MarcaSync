# Robô do e-INPI

Roda **no seu computador**, com o Chrome **visível**, e cuida da GRU do pedido de registro. Faz só **leitura**: confere o valor da GRU, nunca emite. Dois modos: o **ensaio** (você roda à mão) e o **`iniciar`** (fica ligado e trabalha para o site). O ensaio:
abre a emissão da GRU, escolhe o serviço (389 ou 394), vai até a **prévia**, lê o valor, confere com o que o site cobra e sai.
**Não gera boleto, não paga e não aperta "Cancelar Serviço".**

## Como usar

```powershell
cd robo
npm install            # baixa só o Playwright (usa o Chrome que já está instalado)
npm run ensaio         # abre o Chrome do robô, espera você entrar na conta e confere os valores do 389 e do 394
```

- Se a conta do e-INPI ainda não estiver aberta, o robô avisa e **espera até 10 minutos**: entre na sua conta **na janela do Chrome**
  que ele abriu. **A sua senha nunca passa pelo programa**: quem digita é você. Assim que o login é detectado, o ensaio continua
  na mesma janela.
- O e-INPI guarda o login num **cookie de sessão**, que o Chrome apaga ao fechar a janela. Por isso o ensaio faz o login e a conferência
  juntos. Quando o robô passar a rodar o tempo todo em segundo plano, ele mantém a janela aberta (e visita o e-INPI de tempos em tempos
  para a sessão não expirar); se a sessão cair mesmo assim, ele para e te avisa.
- `npm run ensaio -- --sem-desconto` se o cadastro **não** for MEI/ME/EPP (espera o valor cheio: R$ 880 e R$ 1.720).
- Com o cadastro como MEI, o esperado é **R$ 440 (389)** e **R$ 860 (394)**.
- As capturas de tela da prévia ficam em `robo/ensaios/` (fora do Git; têm os seus dados de cadastro).

## Ligar ao site (`npm run iniciar`)

O robô fica ligado, com o Chrome visível, e **a cada 5 minutos**: dá sinal de vida ao site, pede os pedidos já **pagos** que ainda não tiveram a GRU conferida,
confere cada um na prévia do e-INPI e **conta o resultado** ao site, que te avisa (Telegram/WhatsApp): `ok` (valor igual ao que o cliente pagou),
`divergente` (valor diferente: **confira antes de emitir**) ou `erro`. Pedido com problema só é tentado de novo depois de 1 hora.

1. Crie uma senha do robô (sequência longa e aleatória, 32+ caracteres) e coloque-a em **dois** lugares, e em mais nenhum: no Vercel (variável `ROBO_TOKEN`, sensível) e em `robo/.env` neste computador.
2. Crie `robo/.env` (o Git ignora este arquivo) com:

   ```
   ROBO_TOKEN=a-sua-sequência
   # só se for testar contra outro endereço (padrão: https://www.marcasync.com.br)
   # MARCASYNC_URL=http://localhost:3002
   ```

3. `npm run iniciar`, e entre no e-INPI **na janela** quando ele pedir. Se a sessão expirar, ele te avisa e espera; **deixe a janela aberta**.

O site só entrega ao robô o necessário (marca, serviço, valor): **sem CPF/CNPJ, endereço ou e-mail**. O robô só aceita falar com `https://` (ou `localhost`).

## Travas de segurança

1. O robô **recusa** clicar em "Gerar boleto", "Pagamento online", "Pagar", "Emitir" e "Imprimir" (`botaoProibido`).
2. Pedidos de rede para `boleto` e `pagamento online` são **derrubados** no navegador (`urlProibida`), mesmo que algo clique sozinho.
3. Janelas de confirmação do site nunca são aceitas.
4. A tabela de valores esperados está testada contra a que o site usa para cobrar (`src/lib/robo-esperado.test.ts`).

## Testar sem tocar no INPI

`npm run teste-local` sobe um site **falso** que imita a emissão da GRU e prova que o robô acha os campos, lê o valor,
acusa valor errado, pede login com a sessão fechada e **nunca** gera boleto.
O `npm run teste-rodada` faz o mesmo com a **rodada** inteira (pede tarefas, confere, conta o resultado ao site, com o token), contra um site falso do MarcaSync.

## O que vem depois (ainda não feito)

- Gerar o boleto de verdade (com a sua autorização) e mandar a linha digitável; **pagar continua sendo seu**.
- Iniciar junto com o Windows.
