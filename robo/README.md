# Robô do e-INPI

Roda **no seu computador**, com o Chrome **visível**, e cuida da GRU do pedido de registro. Hoje faz só o **ensaio**:
abre a emissão da GRU, escolhe o serviço (389 ou 394), vai até a **prévia**, lê o valor, confere com o que o site cobra e sai.
**Não gera boleto, não paga e não aperta "Cancelar Serviço".**

## Primeira vez

```powershell
cd robo
npm install            # baixa só o Playwright (usa o Chrome que já está instalado)
npm run login          # abre o Chrome do robô: ENTRE NA SUA CONTA do e-INPI, na janela
npm run ensaio         # confere os valores do 389 e do 394
```

- O login fica guardado num perfil só do robô (`robo/.perfil`, fora do Git). **A sua senha nunca passa pelo programa**:
  quem digita é você, na janela do Chrome. Quando a sessão expirar, o ensaio avisa e pede `npm run login` de novo.
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
