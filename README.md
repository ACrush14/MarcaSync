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
cp .env.example .env        # se ainda não existir — aponta pro banco local
npx prisma migrate dev      # cria/atualiza prisma/dev.db (só na 1ª vez ou após mudar o schema)
npm run dev
```

Abra http://localhost:3000. Para checar tipos e build de produção antes de commitar:

```bash
npm run typecheck
npm run build
```

## Banco de dados (`prisma/`)

SQLite local via Prisma — o "caderno de anotações" real do produto. Um arquivo só
(`prisma/dev.db`, gerado por `npx prisma migrate dev`, nunca commitado — ver
`.gitignore`), sem servidor de banco pra configurar. Guarda cliente, processo (marca,
descrição, análise, status, protocolo) e pagamento (setup/monitoramento, confirmado à
mão depois que o cliente avisa por WhatsApp).

- `prisma/schema.prisma` — os 3 modelos: `Cliente`, `Processo`, `Pagamento`.
- `src/lib/db.ts` — cliente Prisma (singleton, evita conexões duplicadas no hot reload).
- `/admin` — lista todos os processos e pagamentos, com botão "Marcar como pago". Sem
  login ainda — **não exponha essa rota publicamente** antes de ter autenticação (ver
  "Próximos passos").

Prisma 7 mudou o modelo de configuração: a URL de conexão não vive mais no
`schema.prisma`, vive em `prisma.config.ts`. Se `npx prisma migrate dev` reclamar de
schema, veja esse arquivo antes de mexer no `schema.prisma`.

**Quando isto vira Postgres**: SQLite não aguenta escrita concorrente de múltiplos
processos/instâncias — é suficiente pra um único desenvolvedor local, não pra produção
com mais de uma pessoa mexendo ao mesmo tempo. Migrar é trocar `provider = "sqlite"` por
`"postgresql"` no schema e o adapter em `db.ts` — o resto (modelos, rotas) não muda.

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
- **Busca em tempo real na base do INPI** (`src/lib/inpi/busca-client.ts`,
  `src/app/api/inpi/busca/`, componente `BuscaRealPanel`) — API não documentada
  publicamente que sustenta o portal `servicos.busca.inpi.gov.br/marcas`, integrada e
  testada com dado real (ver seção própria abaixo). Aparece no passo "Resultado", como
  bloco separado da tabela de colidência fonética de exemplo.

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
Isso hoje é coberto pela integração de busca em tempo real, na seção seguinte.

**Testado de ponta a ponta em 25/08/2026, localmente, com rede sem bloqueio:**
`GET /api/rpi/lookup?numero=905922891` devolveu a edição real 2903 com o despacho
`IPAS161` e o titular "POLIMPORT - COMÉRCIO E EXPORTAÇÃO LTDA" — confirmado rodando
`npm run dev` e abrindo `/rpi-teste`, não apenas por inspeção estrutural. Numa sandbox que
bloqueie `revistas.inpi.gov.br`, repita esse teste antes de confiar nisto em produção.

## Busca em tempo real (`src/lib/inpi/busca-client.ts`)

API **não documentada publicamente** que sustenta o portal moderno
`servicos.busca.inpi.gov.br/marcas`. Contrato obtido por engenharia reversa (reprodução
da chamada que o próprio portal dispara) e **confirmado ao vivo** em 25/08/2026:

```
POST https://api-servicos.busca.inpi.gov.br/api/trademarks/search
Content-Type: application/json

{ "state": { "current": 1, "filters": [], "resultsPerPage": 10, "searchTerm": "Nubank",
  "sortDirection": "", "sortField": "", "sortList": [] },
  "queryConfig": { "search_fields": { "mark_name": { "weight": 3 }, "process_number": {},
  "holders.name": {} }, "result_fields": { "mark_name": {"raw":{}}, "process_number":
  {"raw":{}}, "status": {"raw":{}}, "classification_code": {"raw":{}}, "filing_date":
  {"raw":{}}, "nature_text": {"raw":{}}, "presentation_text": {"raw":{}}, "holders":
  {"raw":{}} } } }
```

Resposta no formato Elastic App Search (`{ raw: valor }` em cada campo). Busca real por
"Nubank" devolveu 113 resultados, incluindo o processo `907206794`, titular "NU
PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO", status "Registro de marca em vigor" —
validado tanto via `curl` direto quanto pelo fluxo normal do produto
(`GET /api/inpi/busca?termo=Nubank&pagina=1`, chamado pelo componente `BuscaRealPanel`
dentro do passo "Resultado").

**Riscos herdados, sem mitigação total:**
- Banner "Ambiente de homologação" foi observado no portal na data da descoberta — não
  há confirmação de que é produção estável.
- Sem termos de uso conhecidos para consumo por terceiros.
- A resposta chega com `Access-Control-Allow-Origin: *` (o INPI permite chamada direta
  do navegador), mas a chamada foi mantida no servidor (`/api/inpi/busca`) mesmo assim,
  para poder cachear em memória o `Cache-Control: max-age=86400` que o upstream já
  declara — evita martelar uma API de terceiro sem SLA a cada clique. Mesma ressalva do
  cache da RPI: é `Map` em memória, não sobrevive a cold start serverless.
- Timeout de 6s via `AbortController`, sem retry automático (deliberado — retry
  esconderia sinal de instabilidade de uma API sem SLA conhecido).

Antes de confiar nisto em produção: confirmar com o INPI (ou jurídico) se
`api-servicos.busca.inpi.gov.br` é de fato produção e se há alguma restrição de uso por
terceiros — ninguém validou isso ainda, só a mecânica técnica.

## Healthcheck (`/api/health`)

`GET /api/health` verifica as duas integrações reais com o INPI e devolve `200` (tudo
saudável) ou `503` (alguma falhou). Cada checagem valida não só o status HTTP, mas a
*forma* mínima da resposta — uma API sem contrato formal (a busca em tempo real) pode
mudar de schema sem avisar e continuar respondendo `200` com corpo diferente; isso pega
esse caso, não só "está fora do ar".

Pensado pra ser chamado por um monitor externo gratuito (UptimeRobot, Better Uptime,
cron-job.org) a cada poucos minutos, alertando por e-mail/SMS quando não for `200` — mais
barato que construir alerta próprio numa fase sem volume de clientes. Ver
`src/lib/inpi/health.ts`.

## O que ainda é intencionalmente falso (e por quê)

A base de marcas usada na *demonstração de colidência fonética* (`BASE_MARCAS` em
`src/lib/data.ts`, usada pela tabela de similaridade do passo "Resultado") continua
sendo uma lista fixa de 14 marcas de exemplo — ela existe só pra ilustrar o algoritmo
fonético com números estáveis e reproduzíveis. A busca por dado real de verdade agora
tem canal próprio (`BuscaRealPanel`, ver seção acima), lado a lado com a tabela de
exemplo. O protocolo gerado no passo "Plano" continua sendo um número aleatório
fictício — ainda não há peticionamento real, ver item 4 abaixo.

## Próximos passos (nesta ordem)

1. **Confirmar juridicamente o status de `api-servicos.busca.inpi.gov.br`** —
   produção ou homologação, termos de uso pra terceiros — antes de expor a busca em
   tempo real (`/api/inpi/busca`) pra usuário final em produção. A integração técnica
   já está pronta e testada (ver seção acima); o que falta é a confirmação
   institucional, não código.
2. **Fundir a demonstração fonética com a busca real num único score de risco** —
   hoje são dois blocos visualmente separados no passo "Resultado" (dívida de UX já
   mapeada). O desafio: como combinar similaridade fonética (heurística) com
   colidência exata da base real (fato) sem confundir o usuário sobre qual é qual.
3. **Revisar o algoritmo fonético com alguém que entenda fonologia do português** — a
   versão atual é uma heurística de demonstração, não um algoritmo validado
   linguisticamente nem testado contra decisões reais de indeferimento do INPI.
4. **Fluxo de procuração eletrônica** — rascunho pronto em
   [`docs/tutorial-procuracao-eletronica.md`](docs/tutorial-procuracao-eletronica.md),
   montado a partir do Manual de Marcas oficial do INPI. **Precisa de revisão por
   advogado antes de ir pra produção** — não foi escrito nem validado por um. Regra dura
   e não negociável, já cumprida no desenho: nunca capturar ou armazenar credenciais
   gov.br de terceiros.
5. ~~Persistência real~~ — **feito**: SQLite local via Prisma (`prisma/`, ver seção
   própria acima), wizard grava cliente/processo/pagamento de verdade, `/admin` lista
   tudo e confirma pagamento manualmente. Ainda sem autenticação — qualquer um com a URL
   acessa `/admin` — e ainda SQLite (não aguenta múltiplos escritores concorrentes), não
   Postgres. Próximo passo real aqui é login, não banco.
6. **Cobrança automatizada** — hoje é manual: você confirma no `/admin` depois que o
   cliente avisa por WhatsApp (isso já tem onde gravar — item 5 resolvido). Automação de
   verdade (cliente paga, sistema confirma sozinho) ainda depende de decidir entre gerar
   o payload PIX "copia e cola" (padrão EMV/BR Code) estático com a chave PIX pessoal — o
   mais simples, sem abrir conta em processador — ou Mercado Pago (Checkout Pro pro setup
   único, Assinaturas/`preapproval` pro monitoramento recorrente — são produtos
   diferentes, não a mesma integração).
7. **Autenticação no `/admin`** — hoje qualquer pessoa com a URL vê nome, WhatsApp e
   valores de todo cliente. Sem risco enquanto só você acessa localmente; vira
   obrigatório antes de fazer deploy em qualquer lugar público.
8. **Cache real para RPI e busca** — os dois caches em memória (`fetch-rpi.ts`,
   `busca-client.ts`) são só pra desenvolvimento (não sobrevivem a cold start
   serverless, não são compartilhados entre instâncias). Produção precisa de Redis/S3,
   TTL de 1 semana pra RPI e 24h pra busca (espelhando o `Cache-Control` do upstream).

## Estrutura

```
src/
  app/
    layout.tsx        — fontes via next/font/google (ver nota abaixo), metadata, shell HTML
    page.tsx           — monta <MarcaSyncApp />
    globals.css         — tokens de design (cores claro/escuro, tipografia) + estilos
    icon.svg             — favicon
    api/
      rpi/lookup/
        route.ts          — GET ?numero=... — consulta real à RPI oficial
      inpi/busca/
        route.ts           — GET ?termo=...&pagina=... — busca real em tempo real
      health/
        route.ts            — GET — healthcheck das duas integrações (status + schema)
      processos/
        route.ts             — GET lista, POST cria cliente+processo
        [id]/route.ts          — PATCH atualiza status/protocolo/monitoramento
        [id]/pagamentos/route.ts — POST registra cobrança pendente
      pagamentos/[id]/confirmar/
        route.ts                — POST marca pagamento como confirmado
    admin/
      page.tsx              — "caderno de anotações": lista processos, confirma pagamento
    rpi-teste/
      page.tsx             — página de prova viva da integração com a RPI
  components/
    MarcaSyncApp.tsx — orquestrador: estado do wizard (etapa, marca, análise, plano...)
    Stepper.tsx       — navegação entre etapas, com trava de progresso
    ConsultaStep.tsx  — formulário de entrada
    LoadingStep.tsx   — checklist animado da análise
    ResultadoStep.tsx — resumo de risco, tabela de colidência de exemplo
    BuscaRealPanel.tsx — busca ao vivo na base real de marcas do INPI
    WaveCanvas.tsx     — visualização da assinatura fonética (canvas)
    PlanoStep.tsx      — setup + monitoramento, com toggle funcional
    PainelStep.tsx     — timeline do processo + log de monitoramento da RPI
  lib/
    fonetica.ts   — algoritmo de colidência fonética + Levenshtein
    ncl.ts         — inferência de classe NCL + rótulos
    data.ts        — base de marcas de exemplo (só alimenta a demo de colidência)
    analysis.ts    — junta fonética + NCL num único resultado de análise
    types.ts        — tipos compartilhados (fonte única — fonetica.ts importa daqui)
    inpi/
      types.ts        — tipos do XML oficial da RPI
      parse-rpi.ts     — parser de um bloco <processo> (testado contra dado real)
      fetch-rpi.ts      — descoberta de edição + download/parsing sob demanda
      busca-types.ts     — tipos da busca em tempo real
      busca-client.ts     — cliente da busca em tempo real (cache + timeout)
      health.ts            — verificações de status+schema das duas integrações
  lib/db.ts — cliente Prisma (singleton)
prisma/
  schema.prisma — modelos Cliente/Processo/Pagamento (ver seção "Banco de dados")
docs/
  tutorial-procuracao-eletronica.md — rascunho pro cliente autorizar o MarcaSync no INPI
```

Nota sobre `layout.tsx`: as fontes usam `next/font/google` (self-hosted em build time).
Até 25/08/2026 eram carregadas via `<link>` porque o ambiente de build original
bloqueava `fonts.googleapis.com`; reavaliado e revertido nesta sessão depois de
confirmar rede livre localmente — ver comentário no próprio arquivo antes de reverter de
volta para `<link>` num ambiente restrito.
