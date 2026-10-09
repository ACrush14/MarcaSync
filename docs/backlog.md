# Backlog do MarcaSync

Última atualização: 08/10/2026. As decisões de produto abaixo são do Anderson.

## 1. Esboço de logo para o cliente — ADIADO (vendável)

**Ideia:** quando o cliente informar o nome da marca (e a descrição), o site oferece um **esboço de logo**, ou **vários esboços**, para mostrar que temos poder criativo e damos suporte visual. É um gancho para conquistar o cliente.

**Por que vale:** um esboço basta para impressionar; é diferencial comercial e serviço que dá para vender depois.

**O que já existe:** o campo "Descreva o produto ou serviço" já serve como briefing do logo. Não é preciso um recurso de "documentação" novo.

**A decidir quando chegar a hora:**
- Quem produz os esboços (designer, ferramenta de IA, mistura)?
- Em que momento do fluxo aparece (antes ou depois da consulta)?
- É grátis ou faz parte do plano?

**Status:** aprovado como ideia, sem data.

## 2. Categoria (classe) na análise de colidência — PRÓXIMA

**Problema:** hoje o risco compara só o **nome**. "NeuroLearn" (educação) e "NeuroLearn" (publicidade) aparecem como 100% de risco, e o resultado não separa por área. O INPI protege a marca dentro da sua área de atuação (**princípio da especialidade**), com exceção das marcas de **alto renome**.

**Decisões já tomadas:**
- Deve haver **pelo menos um aviso leve** quando o nome já existe **em outra área** (algo como: o nome já é usado em outra área; registrar na sua área pode proteger a marca). Cuidado com a redação: **não prometer aprovação**.
- Ordem de prioridade: **1º** o que o usuário informou na descrição; **2º** suposição pelo nome.
- Descrição **vazia**: oferecer as **2 ou 3 áreas mais prováveis** para o visitante escolher (ex.: "Casa Amarela" → pintura, alimentício, outros serviços), em vez de adivinhar uma só.
- A classe é a **classe de Nice** (a mesma que o sistema infere hoje).

**Etapas, nesta ordem:**
1. A classe do usuário **entra no cálculo** (começar por aqui).
2. Separar os resultados em **"mesma área"** e **"outras áreas"**.
3. O **risco** passa a variar conforme a área.

**Cuidados:** adivinhar só pelo nome pode enganar ("Maçã verde" parece comida, mas Maçã é a Apple), por isso mostrar "confiança baixa". Classes **afins** também colidem, não só a mesma.

**Perguntas para investigar na etapa 1:**
- De onde vem a classe de cada marca encontrada (busca ao vivo ou base local)? Por que `NEUROLEARN` aparece "não informada"?
- Na base local, quantas marcas têm classe? (2,58 milhões de 3,02 milhões.)

## 3. Funil de eventos — EM ANDAMENTO (branch `feature/funil-eventos`)

Feito: tabela `Evento`, API `POST /api/eventos`, `track.ts`, `TrackView` na landing.

Falta:
- Conferir no Prisma Studio os eventos `landing_visita` e guardar o trabalho no Git.
- Chamar o `track` nas outras etapas (consulta, resultado, plano, WhatsApp). O clique no WhatsApp guarda de onde veio no campo `dados`.
- Evento separado para o **envio** do formulário, e incluir o nome na lista `NOMES_VALIDOS`.
- Trocar o `200` e o `100` soltos do `route.ts` pelas constantes (`MAX_PAGINA`, `MAX_ORIGEM`).
- Terminar os 4 casos de teste que faltam da tabela.
- Consulta do funil (sessões distintas por etapa e por dia).
- **Antes de juntar na `main`: aplicar a migração `eventos` no banco de produção.**

## 4. Pendências gerais
- Configurar o Prettier do projeto (ou desligar "formatar ao salvar"): o VS Code reescreve arquivos inteiros.
- Trocar a senha do banco de produção (apareceu em conversa) e atualizar na Vercel.
- Corrigir o texto "45 classes de Nice" na tela de consulta (só 11 são inferidas).
- Testes automáticos (começar por funções simples, como `similaridade`).
