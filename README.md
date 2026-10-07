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
cp .env.example .env        # preencha DATABASE_URL/DATABASE_URL_UNPOOLED (ver "Banco de dados")
npx prisma generate         # sempre rode isso depois de mudar prisma/schema.prisma
npm run dev
```

Abra http://localhost:3000. Para checar tipos e build de produção antes de commitar:

```bash
npm run typecheck
npm run build
```

## Banco de dados (`prisma/`)

Postgres via Neon (integração nativa do Vercel) — o "caderno de anotações" real do
produto. Guarda cliente, processo (marca, descrição, análise, status, protocolo) e
pagamento (setup/monitoramento, confirmado à mão depois que o cliente avisa por
WhatsApp).

Era SQLite local até 26/08/2026 (`prisma/dev.db`, um arquivo só) — migrado pra
Postgres porque o Vercel não tem disco persistente: sistema de arquivos lá é só
leitura fora de `/tmp`, um arquivo `.db` local não sobrevive a um redeploy, muito menos
a instâncias diferentes rodando em paralelo.

- `prisma/schema.prisma` — os 3 modelos: `Cliente`, `Processo`, `Pagamento`.
- `src/lib/db.ts` — cliente Prisma (singleton) + `@prisma/adapter-neon` (driver
  serverless do Neon, baseado em WebSocket — por isso o polyfill `ws` no arquivo,
  necessário em runtime Node.js).
- `/admin` — lista todos os processos e pagamentos, com botão "Marcar como pago". Sem
  login próprio — protegido por senha simples via `src/proxy.ts`, ver seção
  "Autenticação" abaixo.

**Setup**: crie o banco em Vercel → aba **Storage** → **Create Database** → **Postgres**
(Neon, camada gratuita, sem cartão). O Vercel injeta sozinho `DATABASE_URL` (pooled,
usada em runtime) e `DATABASE_URL_UNPOOLED` (conexão direta, usada só por
`prisma migrate`/`prisma.config.ts` — o pooler do Neon não suporta todas as operações
de migração) — não precisa configurar nada extra no dashboard. Localmente, copie esses
dois valores pro seu `.env` (ver `.env.example`).

Prisma 7 mudou o modelo de configuração: a URL de conexão não vive mais no
`schema.prisma`, vive em `prisma.config.ts`. Se `npx prisma migrate dev` reclamar de
schema, veja esse arquivo antes de mexer no `schema.prisma`.

**Pegadinha real, já caí nela várias vezes**: `npx prisma migrate dev` nem sempre
regenera o client automaticamente depois de mudar `schema.prisma` (deveria, às vezes
não regenera). Se o servidor começar a reclamar de "Unknown argument" num campo que
você acabou de adicionar, rode `npx prisma generate` manualmente — e se ainda assim
persistir, **reinicie o `npm run dev`** (o processo antigo mantém o client velho
carregado em memória, um `prisma generate` sozinho não é suficiente).

## Autenticação (`src/proxy.ts`)

Basic Auth simples protegendo só `/admin`, `GET /api/processos` (lista todo mundo) e
`POST /api/pagamentos/:id/confirmar` — o resto da API fica sem senha de propósito,
porque é o que o wizard público precisa chamar pra funcionar (criar processo, avançar
etapa, registrar cobrança pendente). Usuário do Basic Auth pode ser qualquer coisa; só
a senha importa, definida em `ADMIN_PASSWORD` (padrão no código: `2001` — troque antes
de deploy público, é fraca de propósito).

Chamado `proxy.ts`, não `middleware.ts` — o Next.js 16 renomeou a convenção (ver
[nextjs.org/docs/messages/middleware-to-proxy](https://nextjs.org/docs/messages/middleware-to-proxy)).

## Deploy (Vercel)

Projeto ligado em `andersoncrushlink-7788s-projects/marcasync`, com deploy automático a
cada push na `main` (integração Git conectada quando o projeto foi criado via
`vercel link`).

**Variáveis de ambiente já configuradas no Vercel** (Production + Preview):
`DATABASE_URL`, `DATABASE_URL_UNPOOLED` e as demais do Neon (injetadas sozinhas pela
integração de Storage), `BLOB_READ_WRITE_TOKEN` (injetada sozinha ao criar o Blob
store — ver "Upload de logotipo" abaixo), mais `ADMIN_PASSWORD` (adicionada
manualmente via `vercel env add`) `NEXT_PUBLIC_WHATSAPP_NUMBER` (ver "Contato pelo
WhatsApp" — trocar exige novo deploy) e `CRON_SECRET` (monitoramento da RPI).

## Upload de logotipo (`src/lib` + Vercel Blob)

Logotipo da marca (PNG, até 1000×1000px) — só pra marca mista, opcional. Guardado no
**Vercel Blob** (`marcasync-logos`, acesso público — a URL é aleatória e não listável,
não precisa de token pra ler), criado via `vercel blob create-store <nome> --access
public --yes`, que já injeta `BLOB_READ_WRITE_TOKEN` no projeto sozinho.

- `src/components/LogoUpload.tsx` — drag-and-drop, valida tipo e dimensão no navegador
  antes de enviar (só UX — não impede alguém de mandar outra coisa direto pra API).
- `src/app/api/processos/[id]/logo/route.ts` — a validação que conta de verdade: lê os
  8 bytes de assinatura do PNG e a largura/altura direto do chunk `IHDR` (bytes 16–23),
  sem depender de nenhuma lib de imagem nem confiar no `Content-Type` que o cliente
  mandou. Testado rejeitando um arquivo `.txt` disfarçado de PNG e um PNG 1001×1001 de
  verdade antes de considerar pronto.
- Local: rode `vercel env pull .env.local` (ou copie `BLOB_READ_WRITE_TOKEN` de
  `vercel env ls`) pra testar upload rodando `npm run dev`.

**Antes de considerar isso pronto pra clientes reais**:
- Trocar `ADMIN_PASSWORD` por algo mais forte que `2001` — 4 dígitos só era aceitável
  rodando local.
- O `/admin` não tem rate limiting no Basic Auth — um site público sem isso é atacável
  por força bruta, mesmo com senha forte. Considerar um WAF/rate limit (Vercel Firewall,
  gratuito no plano atual) antes de divulgar a URL amplamente.
- Redeploy manual, se precisar, sem esperar um push: `vercel --prod` (dentro da pasta do
  projeto, com o CLI autenticado).

## Contato pelo WhatsApp

Fluxo: **Consulta → Resultado → Plano → Contato**. O cliente pode ir pro WhatsApp já no
Resultado ("Falar comigo no WhatsApp") ou depois de ver o preço no Plano. Os botões são
`<a href="https://wa.me/…">` de verdade (abrem em nova aba, sem bloqueio de pop-up); o
clique também move o wizard pro passo "Contato" e grava `status = contato` no processo —
dá pra ver no `/admin` quem já pediu conversa. Pelo Plano, também viram as 2 cobranças
pendentes (setup e, se ligado, monitoramento), criadas uma única vez mesmo se o cliente
voltar pelo Stepper e confirmar de novo.

A mensagem (`src/lib/whatsapp.ts`) já vai com nome, marca, risco real do INPI, classe
sugerida, plano escolhido e uma `Ref.` curta pra achar o pedido no `/admin`.

**Configuração**: `NEXT_PUBLIC_WHATSAPP_NUMBER` (só dígitos, DDI + DDD + número, ex.:
`5585912345678`). Por ser `NEXT_PUBLIC_`, o Next embute o valor **no build** — trocar o
número exige novo deploy. Sem a variável, o botão vira "Quero que me chamem" e a
conversa parte do WhatsApp que o próprio cliente informou na consulta (nunca um link
quebrado).

## Monitoramento da RPI (automático)

O plano de R$ 29/mês agora tem processo real por trás:

1. Depois de protocolar no INPI, você digita o **nº do processo** na coluna "Nº no INPI" do `/admin` (isso também marca o pedido como *Protocolado*). O cliente precisa ter o monitoramento ligado no plano.
2. O **Vercel Cron** chama `/api/cron/rpi` todo dia às 12h UTC (`vercel.json`). A RPI sai às terças; rodar todo dia pega edição atrasada. Edição já lida é pulada sem baixar nada (tabela `LeituraRpi`).
3. A rotina (`src/lib/monitor-rpi.ts`) baixa o XML oficial da edição, procura só os processos monitorados e grava um `Alerta` por despacho (chave única: reprocessar não duplica). Despacho com "oposição" no texto ganha **prazo estimado de 60 dias** da publicação (Lei 9.279/96, art. 158) — é estimativa, confira na RPI.
4. No `/admin`, seção **Alertas da RPI**: botão "Avisar no WhatsApp" (abre a conversa com o cliente com a mensagem pronta e marca como avisado) e "Verificar RPI agora" para forçar a leitura.

A rota do cron exige `Authorization: Bearer $CRON_SECRET` (a Vercel envia sozinha); sem a variável ela se recusa a rodar. `RPI_BASE_URL` existe só para testar contra uma edição simulada — não defina em produção.

**Limites honestos**: o aviso ao cliente é por WhatsApp, enviado por você (não há e-mail/push nem envio automático de mensagem). Não calcula decênio nem outros prazos — só lista despachos e o prazo de oposição. Se o INPI estiver fora do ar, a rotina falha com 502 e tenta de novo no dia seguinte.

## Tema

Branco + tons pastéis (menta, lavanda, pêssego, céu, manteiga), **sem tema escuro** de
propósito — um único conjunto de tokens em `:root` (`globals.css`) vale pro app inteiro
e pra landing. `--accent` é só *preenchimento* (botão, passo atual): menta pastel com
tinta escura por cima; pra *texto* ou foco use `--accent-strong`. Cada par texto×fundo
foi medido (WCAG) — ver comentário no topo de `LandingPage.css`.

## O que já é funcional (não decorativo)

- **Colidência fonética real** (`src/lib/fonetica.ts`) — redução fonética simplificada
  para PT-BR + distância de Levenshtein, comparando a marca digitada contra uma base de
  exemplo (`src/lib/data.ts`). Isto é uma heurística deliberadamente pequena para provar
  a mecânica, **não** um Soundex/Metaphone validado — ver a seção "Próximos passos".
- **Inferência de classe NCL** (`src/lib/ncl.ts`) — mapeamento por palavra-chave de uma
  descrição em linguagem natural para uma das classes de Nice. Cobre 11 das 45 classes
  reais, como prova de conceito.
- **Integração real com a RPI oficial** (`src/lib/inpi/`, `src/app/api/rpi/lookup/`) —
  não é mock: baixa e faz parsing do XML publicado semanalmente em
  `revistas.inpi.gov.br`, o canal que o próprio INPI declara ser "para uso através de
  aplicativos". Ver seção própria abaixo.
- **Busca em tempo real na base do INPI** (`src/lib/inpi/busca-client.ts`,
  `src/lib/colidencia.ts`, `/api/colidencia`) — API não documentada publicamente que
  sustenta o portal `servicos.busca.inpi.gov.br/marcas`, integrada e testada com dado
  real (ver seção própria abaixo). Alimenta o passo "Resultado"; só cai pra base de
  exemplo se a busca real falhar de verdade.
- **Contato pelo WhatsApp** (`src/lib/whatsapp.ts`, `ContatoStep.tsx`) — depois da
  consulta o cliente cai direto numa conversa com o WhatsApp do MarcaSync, com a
  mensagem já escrita. Ver a seção "Contato pelo WhatsApp".

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
fonético com números estáveis e reproduzíveis — hoje só aparece como fallback quando a
busca real no INPI falha (ver `src/lib/colidencia.ts`), sempre avisando que é exemplo.
Não há peticionamento automático: o protocolo no INPI é feito à mão, depois da conversa
no WhatsApp (ver item 4 abaixo).

## Próximos passos (nesta ordem)

1. **Confirmar juridicamente o status de `api-servicos.busca.inpi.gov.br`** —
   produção ou homologação, termos de uso pra terceiros — antes de expor a busca em
   tempo real (`/api/inpi/busca`) pra usuário final em produção. A integração técnica
   já está pronta e testada (ver seção acima); o que falta é a confirmação
   institucional, não código.
2. ~~Fundir a demonstração fonética com a busca real~~ — **feito**: `/api/colidencia`
   (`src/lib/colidencia.ts`) tenta a base real do INPI primeiro; só cai pra
   demonstração de exemplo se a busca real falhar de verdade (rede/timeout/schema) —
   zero resultados reais não é falha, é "risco baixo" genuíno, e é tratado como tal
   (não confundir os dois foi a parte que importava aqui). Passo "Resultado" agora
   mostra uma única tabela/score, com badge indicando a fonte ("dado real" ou
   "exemplo"), mais uma caixa de "buscar outro termo" que atualiza o mesmo resultado
   em vez de abrir um bloco novo.
3. **Revisar o algoritmo fonético com alguém que entenda fonologia do português** — a
   versão atual é uma heurística de demonstração, não um algoritmo validado
   linguisticamente nem testado contra decisões reais de indeferimento do INPI.
   Recalibrada em 26/08/2026 (`src/lib/fonetica.ts`) pra não superestimar
   colidência quando uma marca é a outra + uma palavra extra genuína (ex.:
   "Ronaldo" vs. "Ronaldo Soluções" caía em 47%, deveria ser bem mais baixo) sem
   quebrar o caso de mesma sonoridade com grafia diferente (ex.: "Kazamarela"
   vs. "Casa Amarela" continua em 100%) — ainda heurística, ainda pede revisão
   por linguista antes de decisão real de negócio.
4. **Fluxo de procuração eletrônica** — rascunho pronto em
   [`docs/tutorial-procuracao-eletronica.md`](docs/tutorial-procuracao-eletronica.md),
   montado a partir do Manual de Marcas oficial do INPI. **Precisa de revisão por
   advogado antes de ir pra produção** — não foi escrito nem validado por um. Regra dura
   e não negociável, já cumprida no desenho: nunca capturar ou armazenar credenciais
   gov.br de terceiros.
5. ~~Persistência real~~ — **feito**: Postgres via Neon (`prisma/`, ver seção própria
   acima), wizard grava cliente/processo/pagamento de verdade, `/admin` lista tudo e
   confirma pagamento manualmente.
6. **Cobrança automatizada** — hoje é manual: você confirma no `/admin` depois que o
   cliente avisa por WhatsApp (isso já tem onde gravar — item 5 resolvido). Automação de
   verdade (cliente paga, sistema confirma sozinho) ainda depende de decidir entre gerar
   o payload PIX "copia e cola" (padrão EMV/BR Code) estático com a chave PIX pessoal — o
   mais simples, sem abrir conta em processador — ou Mercado Pago (Checkout Pro pro setup
   único, Assinaturas/`preapproval` pro monitoramento recorrente — são produtos
   diferentes, não a mesma integração).
7. ~~Autenticação no `/admin`~~ — **feito**: Basic Auth via `src/proxy.ts`, protege
   `/admin` inteiro + `GET /api/processos` + `POST /api/pagamentos/:id/confirmar` (não
   o resto da API — o wizard público precisa continuar chamando essas rotas sem
   senha). Senha padrão no código é `2001` (combinado com o usuário) — **4 dígitos é
   fraco de propósito só enquanto isto roda local**; antes de qualquer deploy
   público, defina `ADMIN_PASSWORD` no ambiente com algo mais forte, sem mudar
   nenhum código.
8. **Cache real para RPI e busca** — os dois caches em memória (`fetch-rpi.ts`,
   `busca-client.ts`) são só pra desenvolvimento (não sobrevivem a cold start
   serverless, não são compartilhados entre instâncias). Produção precisa de Redis/S3,
   TTL de 1 semana pra RPI e 24h pra busca (espelhando o `Cache-Control` do upstream).
9. **Sem termo de uso, contrato de serviço nem aviso de privacidade** — o produto já
   coleta nome, WhatsApp, descrição da marca e (desde 26/08/2026) imagem de logotipo
   de pessoas reais, e envolve cobrança + representação legal perante o INPI. Antes do
   primeiro cliente pagante: um contrato simples (o que é entregue, o que é cobrado,
   política de reembolso) e um aviso de privacidade (LGPD) — mesmo que informal no
   começo, mas por escrito.
10. ~~Painel de acompanhamento ilustrativo~~ — **removido** em 07/10/2026: o passo 4 do
    fluxo agora é "Contato" (WhatsApp), não mais uma linha do tempo com datas
    inventadas. Quando existir acompanhamento real (associar `numeroProcesso` ao
    cliente e consultar `fetch-rpi.ts` periodicamente), ele volta como feature de
    verdade — não como ilustração.
11. **Landing page sem prova social** — de propósito: não tem depoimento nem
    estatística de cliente porque ainda não existe nenhum de verdade — inventar isso
    seria mentira, não decisão de design. Quando houver, trocar a seção "Diferença na
    prática" (hoje só argumento) por números reais. O WhatsApp já está ligado (ver
    `NEXT_PUBLIC_WHATSAPP_NUMBER`), mas o rodapé ainda não exibe o número em texto.
12. **Confirmar o número do WhatsApp em produção** — o valor atual veio de um número que
    o dono do produto citou como seu durante os testes; conferir se é mesmo o comercial
    antes de divulgar a URL (trocar = atualizar a variável e fazer novo deploy).

## Estrutura

```
src/
  app/
    layout.tsx        — fontes via next/font/google (ver nota abaixo), metadata, shell HTML
    page.tsx           — monta <LandingPage /> — porta de entrada real (marketing)
    consulta/page.tsx   — monta <MarcaSyncApp /> — o assistente interativo em si
    globals.css         — tokens (paleta branco + pastel, SEM tema escuro) + estilos do app
    icon.svg             — favicon
    api/
      rpi/lookup/
        route.ts          — GET ?numero=... — consulta real à RPI oficial
      inpi/busca/
        route.ts           — GET ?termo=...&pagina=... — busca real em tempo real
      health/
        route.ts            — GET — healthcheck das duas integrações (status + schema)
      colidencia/
        route.ts             — GET ?marca=...&descricao=... — busca unificada (real com fallback pra demo)
      processos/
        route.ts             — GET lista, POST cria cliente+processo
        [id]/route.ts          — PATCH atualiza status/protocolo/monitoramento
        [id]/pagamentos/route.ts — POST registra cobrança pendente
        [id]/logo/route.ts — POST upload de logotipo (PNG, valida no servidor)
      pagamentos/[id]/confirmar/
        route.ts                — POST marca pagamento como confirmado
    admin/
      page.tsx              — "caderno de anotações": lista processos, confirma pagamento
    rpi-teste/
      page.tsx             — página de prova viva da integração com a RPI
  components/
    LandingPage.tsx — página de marketing (Server Component; FAQ em <details>)
    LandingPage.css — estilos da landing (classes .lp-*; a paleta vem de :root)
    MarcaSyncApp.tsx — orquestrador: estado do wizard (etapa, marca, análise, plano...)
    Stepper.tsx       — navegação entre etapas, com trava de progresso
    ConsultaStep.tsx  — formulário de entrada
    LoadingStep.tsx   — checklist animado da análise
    ResultadoStep.tsx — resumo de risco unificado (real com fallback pra demo) + busca de outro termo
    PlanoStep.tsx      — setup + monitoramento + upload de logotipo + botão WhatsApp
    LogoUpload.tsx      — drag-and-drop do logotipo (PNG, até 1000x1000)
    ContatoStep.tsx    — passo final: conversa no WhatsApp + o que acontece depois
  lib/
    fonetica.ts   — algoritmo de colidência fonética + Levenshtein
    ncl.ts         — inferência de classe NCL + rótulos
    data.ts        — base de marcas de exemplo (fallback de colidencia.ts se a busca real falhar)
    analysis.ts    — colidência fonética contra a base de exemplo (usado só como fallback)
    colidencia.ts    — busca unificada: real primeiro, cai pra analysis.ts se falhar
    monitor-rpi.ts    — leitura diária da RPI → alertas dos processos monitorados
    whatsapp.ts      — link wa.me com a mensagem montada a partir da consulta
    planos.ts         — preços (centavos) e formatação em reais
    types.ts          — tipos compartilhados (fonte única — fonetica.ts importa daqui)
    inpi/
      types.ts        — tipos do XML oficial da RPI
      parse-rpi.ts     — parser de um bloco <processo> (testado contra dado real)
      fetch-rpi.ts      — descoberta de edição + download/parsing sob demanda
      busca-types.ts     — tipos da busca em tempo real
      busca-client.ts     — cliente da busca em tempo real (cache + timeout)
      health.ts            — verificações de status+schema das duas integrações
  lib/db.ts — cliente Prisma (singleton)
  proxy.ts — Basic Auth do /admin (ver seção "Autenticação")
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
