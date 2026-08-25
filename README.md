# MarcaSync

Protótipo funcional do fluxo de produto do MarcaSync — automação do processo de
registro de marcas junto ao INPI. Este repositório contém duas coisas:

- **`prototype.html`** — o protótipo standalone (HTML/CSS/JS puro, um arquivo só), o
  mesmo publicado como artifact durante a fase de validação de interface. Útil para
  abrir direto no navegador sem instalar nada.
- **`src/`** — o início real da aplicação em **Next.js 16 (App Router) + React 19 +
  TypeScript + Tailwind v4**, com a mesma lógica portada para componentes tipados. É o
  ponto de partida para o desenvolvimento de verdade.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Para checar tipos e build de produção antes de commitar:

```bash
npm run typecheck
npm run build
```

## O que já é funcional (não decorativo)

- **Colidência fonética real** (`src/lib/fonetica.ts`) — redução fonética simplificada
  para PT-BR + distância de Levenshtein, comparando a marca digitada contra uma base de
  exemplo (`src/lib/data.ts`). Isto é uma heurística deliberadamente pequena para provar
  a mecânica, **não** um Soundex/Metaphone validado — ver a seção "Próximos passos".
- **Inferência de classe NCL** (`src/lib/ncl.ts`) — mapeamento por palavra-chave de uma
  descrição em linguagem natural para uma das classes de Nice. Cobre 11 das 45 classes
  reais, como prova de conceito.
- **Painel de acompanhamento** (`src/components/PainelStep.tsx`) — linha do tempo do
  processo com datas calculadas a partir de hoje, contador de prazo de oposição (60
  dias, Art. 158 da LPI) e simulação interativa de um alerta de oposição de terceiro.
- **Integração real com a RPI oficial** (`src/lib/inpi/`, `src/app/api/rpi/lookup/`) —
  não é mock: baixa e faz parsing do XML publicado semanalmente em
  `revistas.inpi.gov.br`, o canal que o próprio INPI declara ser "para uso através de
  aplicativos". Ver seção própria abaixo.

## Integração real com a RPI (`src/lib/inpi/`)

Isto substitui, de verdade, a promessa de "ler a RPI" — não é um `setTimeout` fingindo
progresso. `GET /api/rpi/lookup?numero=<processo>` baixa a edição mais recente da Revista
da Propriedade Industrial (Seção V — Marcas), publicada oficialmente e em formato aberto
pelo próprio INPI, e devolve os despachos reais de qualquer processo informado.

Validado em 25/08/2026 contra a edição real 2903 (peguei os bytes crus no navegador,
não confiei na documentação): a raiz é `<revista numero="2903" data="25/08/2026">`, cada
marca é `<processo numero="...">` com `<despachos><despacho codigo="IPASxxx"
name="..."/></despachos>` e `<titulares><titular nome-razao-social="..." pais=".."
uf=".."/></titulares>`. O encoding é UTF-8 mesmo — o XML não mente sobre isso. `src/lib/inpi/parse-rpi.ts`
foi testado contra esse fragmento real antes de entrar no repositório.

Decisão de arquitetura que vale registrar: a edição descompactada tem **~65 MB e dezenas
de milhares de processos**. `buscarProcessosNaEdicao` não faz parsing do XML inteiro numa
árvore de objetos — localiza cada bloco `<processo numero="...">` por busca de substring
e parseia só esses fragmentos pequenos. Parsear tudo pra extrair meia dúzia de registros
seria gastar centenas de MB de memória por request à toa.

Página de prova viva: `/rpi-teste` (fora do fluxo de demonstração, deliberadamente) — bate
direto na API pra qualquer número de processo real que você digitar.

**O que este canal NÃO resolve:** é o canal certo para *monitoramento* (o que mudou esta
semana), não para *busca de anterioridade em tempo real* (existe uma marca parecida?).
Pra isso, na mesma investigação encontrei uma API JSON não documentada que já roda por
trás do novo portal `servicos.busca.inpi.gov.br/marcas`
(`POST api-servicos.busca.inpi.gov.br/api/trademarks/search`) — schema rico, inclusive
com `dispatches` embutido no resultado da busca. Ainda não está integrada aqui de
propósito: não achei documentação pública, termos de uso pra terceiros, nem confirmação
de que a URL testada é produção e não homologação (o banner "Ambiente de homologação"
apareceu na tela). Ver "Próximos passos".

**O que eu não consegui testar de ponta a ponta:** o ambiente onde este código foi
escrito bloqueia saída de rede para `revistas.inpi.gov.br` (mesma política que bloqueia
`fonts.googleapis.com` — ver decisão sobre fontes acima). `descobrirEdicaoMaisRecente()`
e o download do `.zip` foram validados estruturalmente (contagem de `<tr>`, padrão dos
links `RM<edição>.zip`) via inspeção ao vivo no navegador, mas a chamada HTTP completa
dentro do Next.js só foi exercitada localmente contra um 403 do próprio bloqueio de rede
do ambiente de build — não contra uma resposta 200 real. Rode `npm run dev` e teste
`/rpi-teste` com o número `905922891` (um processo real, despacho `IPAS161`) antes de
confiar cegamente nisto em produção.

## O que ainda é intencionalmente falso (e por quê)

A base de marcas usada na *busca de anterioridade* (`BASE_MARCAS` em `src/lib/data.ts`,
usada pelo passo "Consulta"/"Resultado") continua sendo uma lista fixa de exemplo — ela
alimenta a demonstração de colidência fonética, não o monitoramento. O protocolo gerado
no passo "Plano" também continua sendo um número aleatório fictício. Isso é proposital:
a página `/rpi-teste` já prova que a ponta de dados reais funciona; plugar isso na
`Consulta` principal é o próximo passo listado abaixo, não algo que devesse ser
apressado só pra "completar a demo".

## Próximos passos (nesta ordem)

1. **Confirmar se `api-servicos.busca.inpi.gov.br` é produção ou homologação**, e se
   existe documentação/termos de uso — antes de decidir se a busca em tempo real do
   passo "Consulta" vai usar essa API ou continuar só com a RPI semanal.
2. **Revisar o algoritmo fonético com alguém que entenda fonologia do português** — a
   versão atual é uma heurística de demonstração, não um algoritmo validado
   linguisticamente nem testado contra decisões reais de indeferimento do INPI.
3. **Desenhar o fluxo de procuração eletrônica** para peticionamento — nunca capturar ou
   armazenar credenciais gov.br de terceiros. O caminho correto é o cliente cadastrar o
   MarcaSync como procurador dentro do e-Marcas.
4. **Cache real para a RPI** — o cache em memória de `fetch-rpi.ts` é só pra desenvolvimento
   (não sobrevive a cold start serverless, não é compartilhado entre instâncias). Produção
   precisa de Redis/S3 com TTL de 1 semana.
5. **Persistência real** — hoje todo o estado do wizard é `useState` em memória, perdido a
   cada reload. Entra banco de dados (Postgres) e API assim que houver dado real de
   cliente para guardar — o que inclui decidir como associar processos reais (vindos da
   RPI) a contas de usuário.

## Estrutura

```
src/
  app/
    layout.tsx        — fontes via <link> (ver nota abaixo), metadata, shell HTML
    page.tsx           — monta <MarcaSyncApp />
    globals.css         — tokens de design (cores claro/escuro, tipografia) + estilos
    icon.svg             — favicon
    api/rpi/lookup/
      route.ts            — GET ?numero=... — consulta real à RPI oficial
    rpi-teste/
      page.tsx             — página de prova viva da integração com a RPI
  components/
    MarcaSyncApp.tsx — orquestrador: estado do wizard (etapa, marca, análise, plano...)
    Stepper.tsx       — navegação entre etapas, com trava de progresso
    ConsultaStep.tsx  — formulário de entrada
    LoadingStep.tsx   — checklist animado da análise
    ResultadoStep.tsx — resumo de risco, tabela de colidência
    WaveCanvas.tsx     — visualização da assinatura fonética (canvas)
    PlanoStep.tsx      — setup + monitoramento, com toggle funcional
    PainelStep.tsx     — timeline do processo + log de monitoramento da RPI
  lib/
    fonetica.ts   — algoritmo de colidência fonética + Levenshtein
    ncl.ts         — inferência de classe NCL + rótulos
    data.ts        — base de marcas de exemplo (só alimenta a demo de colidência)
    analysis.ts    — junta fonética + NCL num único resultado de análise
    types.ts        — tipos compartilhados
    inpi/
      types.ts        — tipos do XML oficial da RPI
      parse-rpi.ts     — parser de um bloco <processo> (testado contra dado real)
      fetch-rpi.ts      — descoberta de edição + download/parsing sob demanda
```

Nota sobre `layout.tsx`: as fontes são carregadas via `<link>` no `<head>`, não com
`next/font/google`. Motivo documentado no próprio arquivo — `next/font` busca as fontes
em tempo de *build*, o que quebra builds offline/atrás de proxy corporativo (foi
exatamente o que aconteceu no ambiente onde este projeto foi montado).
