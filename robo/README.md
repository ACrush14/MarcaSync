# Robô do e-INPI

Roda **no seu computador**, com o Chrome **visível**, e cuida da GRU do pedido de registro. Hoje faz só o **ensaio**:
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

## Travas de segurança

1. O robô **recusa** clicar em "Gerar boleto", "Pagamento online", "Pagar", "Emitir" e "Imprimir" (`botaoProibido`).
2. Pedidos de rede para `boleto` e `pagamento online` são **derrubados** no navegador (`urlProibida`), mesmo que algo clique sozinho.
3. Janelas de confirmação do site nunca são aceitas.
4. A tabela de valores esperados está testada contra a que o site usa para cobrar (`src/lib/robo-esperado.test.ts`).

## Testar sem tocar no INPI

`npm run teste-local` sobe um site **falso** que imita a emissão da GRU e prova que o robô acha os campos, lê o valor,
acusa valor errado, pede login com a sessão fechada e **nunca** gera boleto.

## O que vem depois (ainda não feito)

- Ligar ao site: o robô buscar os pedidos já pagos e te avisar (Telegram/WhatsApp) com o resultado.
- Gerar o boleto de verdade (com a sua autorização) e mandar a linha digitável; **pagar continua sendo seu**.
- Iniciar junto com o Windows.
