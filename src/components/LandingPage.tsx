import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import "./LandingPage.css";

/**
 * Landing page — a porta de entrada do produto (o assistente interativo
 * vive em /consulta). Server Component de propósito: não há estado de
 * cliente aqui, o FAQ usa <details> nativo.
 *
 * Regra de conteúdo, herdada do README ("O que já é funcional"): nada de
 * número, depoimento ou logo de cliente inventado. O MarcaSync é novo —
 * o argumento é o que existe de verdade: busca real no INPI, preço fechado
 * na tela e atendimento direto. Os exemplos visuais (mockup do herói, bento)
 * são marcados como ilustrativos; os percentuais usados neles foram
 * calculados pelo próprio algoritmo de src/lib/fonetica.ts, não digitados à
 * mão.
 */

/** Índice de entrada escalonada do herói (lido por animation-delay no CSS). */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

/* ---------- ícones (stroke 2px ao lado de texto semibold, 1.5px ao lado de regular) ---------- */

type IconProps = { size?: number; stroke?: number };

function Icon({
  children,
  size = 20,
  stroke = 2,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
const IconTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.25" />
  </Icon>
);
const IconChat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12z" />
  </Icon>
);
const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
const IconX = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
const IconArrowDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);
const IconWave = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" />
  </Icon>
);
const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
);
const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
);
const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.75" />
    <path d="m21 16-5-5-8 8" />
  </Icon>
);
const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);
const IconTrend = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
);
const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
    <path d="M14 10h5a1 1 0 0 1 1 1v10" />
    <path d="M8 8h2M8 12h2M8 16h2M3 21h18" />
  </Icon>
);

/* ---------- conteúdo ---------- */

const PASSOS = [
  {
    icon: <IconSearch />,
    tone: "mint",
    titulo: "Faça a busca",
    texto:
      "Informe o nome e o que você vende. Cruzamos com a base do INPI pelo som, não só pela grafia.",
  },
  {
    icon: <IconTag />,
    tone: "peach",
    titulo: "Veja o preço",
    texto: "Setup e monitoramento aparecem fechados na tela, antes de qualquer conversa.",
  },
  {
    icon: <IconChat />,
    tone: "lav",
    titulo: "Fale comigo",
    texto: "Reviso o resultado com você no WhatsApp e tiro as dúvidas antes de seguir.",
  },
  {
    icon: <IconShield />,
    tone: "sky",
    titulo: "Eu registro",
    texto: "Protocolo o pedido no INPI e te aviso a cada novidade do processo.",
  },
];

const BENEFICIOS = [
  {
    icon: <IconLock />,
    tone: "mint",
    titulo: "Exclusividade nacional",
    texto: "Só você pode usar a marca no ramo registrado, em todo o território brasileiro.",
  },
  {
    icon: <IconShield />,
    tone: "sky",
    titulo: "Proteção contra cópias",
    texto: "Base legal para agir contra quem usar seu nome ou se aproveitar da sua reputação.",
  },
  {
    icon: <IconTrend />,
    tone: "butter",
    titulo: "Um negócio que vale mais",
    texto: "Marca registrada é patrimônio — pesa na hora de vender, franquear ou captar investimento.",
  },
  {
    icon: <IconBuilding />,
    tone: "lav",
    titulo: "Segurança para crescer",
    texto: "Sem o risco de construir uma marca por anos e ter que trocar de nome depois.",
  },
];

const FAQ = [
  {
    p: "Quanto tempo demora para registrar uma marca?",
    r: "O processo no INPI pode levar de 1 a 2 anos até a concessão, mesmo sem oposição de terceiros — é um trâmite federal que não dá para acelerar. O que fazemos rápido é a parte que depende de nós: a busca de anterioridade e o protocolo do pedido.",
  },
  {
    p: "O resultado da busca garante que minha marca será aprovada?",
    r: "Não. É uma estimativa de risco de colisão, feita com a base pública do INPI no momento da consulta. Quem decide é o próprio INPI, no exame do pedido. A busca existe para reduzir o risco antes de você investir tempo e dinheiro — não para substituir a análise oficial.",
  },
  {
    p: "Preciso ter CNPJ para registrar minha marca?",
    r: "Não necessariamente — pessoa física também pode registrar, dependendo da atividade. É um detalhe que reviso com você antes de protocolar, porque muda de caso para caso.",
  },
  {
    p: "Preciso enviar o logotipo?",
    r: "Só se sua marca tiver logotipo (marca mista: nome + imagem). Se for apenas o nome (marca nominativa), não precisa. Quando precisar, é só arrastar o PNG, de até 1000×1000 px, no passo do plano.",
  },
  {
    p: "Como funciona o pagamento?",
    r: "Por PIX, confirmado por mim depois que você avisar no WhatsApp. O setup é um pagamento único; o monitoramento é opcional, mensal, e você desliga quando quiser.",
  },
];

/* ---------- página ---------- */

export default function LandingPage() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="lp-brand" aria-label="MarcaSync — início">
            MarcaSync
          </Link>
          <nav className="lp-nav" aria-label="Principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#precos">Preços</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <Link href="/consulta" className="lp-btn lp-btn-primary lp-btn-sm">
            Começar agora
          </Link>
        </div>
      </header>

      <main id="conteudo">
        {/* ===== Herói ===== */}
        <section className="lp-hero" aria-labelledby="hero-titulo">
          <div className="lp-container lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow" style={stagger(0)}>
                <span className="lp-dot" aria-hidden="true" />
                Busca em tempo real na base do INPI
              </p>
              <h1 id="hero-titulo" style={stagger(1)}>
                Sua marca está livre?{" "}
                <span className="lp-hl">Descubra em segundos.</span>
              </h1>
              <p className="lp-lede" style={stagger(2)}>
                Veja o risco de colisão antes de investir no registro. O preço aparece fechado na
                tela e, depois, você fala direto comigo pelo WhatsApp — do protocolo até a marca
                registrada.
              </p>
              <div className="lp-hero-ctas" style={stagger(3)}>
                <Link href="/consulta" className="lp-btn lp-btn-primary lp-btn-lg">
                  Analisar minha marca grátis
                  <IconArrowRight size={18} />
                </Link>
                <a href="#como-funciona" className="lp-btn lp-btn-ghost lp-btn-lg">
                  Ver como funciona
                  <IconArrowDown size={18} />
                </a>
              </div>
              <ul className="lp-checks" style={stagger(4)}>
                <li>
                  <IconCheck size={16} stroke={1.5} /> Sem criar conta
                </li>
                <li>
                  <IconCheck size={16} stroke={1.5} /> Resultado em segundos
                </li>
                <li>
                  <IconCheck size={16} stroke={1.5} /> Preço fechado, sem orçamento
                </li>
              </ul>
            </div>

            <figure
              className="lp-window-wrap"
              style={stagger(2)}
              role="img"
              aria-label="Exemplo ilustrativo de resultado: a marca Kaza Doce tem risco alto de colisão com Casa Doce, 100% parecida pelo som, e a classe de Nice 30 é sugerida."
            >
              <div className="lp-window" aria-hidden="true">
                <div className="lp-window-bar">
                  <span />
                  <span />
                  <span />
                  <b>Resultado da análise</b>
                </div>
                <div className="lp-window-body">
                  <div className="lp-query">
                    <IconSearch size={16} stroke={1.5} />
                    <span>Kaza Doce</span>
                  </div>

                  <div className="lp-score">
                    <div>
                      <div className="lp-score-label">Nível de colisão</div>
                      <div className="lp-score-value">100%</div>
                    </div>
                    <span className="lp-pill lp-pill-risk">Risco alto</span>
                  </div>

                  <ul className="lp-matches">
                    <li>
                      <span>Casa Doce</span>
                      <span className="lp-match-pct">100%</span>
                      <span className="lp-pill lp-pill-risk">alto</span>
                    </li>
                    <li>
                      <span>Kaza Doces</span>
                      <span className="lp-match-pct">79%</span>
                      <span className="lp-pill lp-pill-risk">alto</span>
                    </li>
                    <li>
                      <span>Casa Verde</span>
                      <span className="lp-match-pct">31%</span>
                      <span className="lp-pill lp-pill-warn">moderado</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="lp-float lp-float-a lp-tone-lav" aria-hidden="true">
                <IconLayers size={18} />
                <div>
                  <b>Classe NCL 30</b>
                  <span>Padaria e confeitaria</span>
                </div>
              </div>
              <div className="lp-float lp-float-b lp-tone-mint" aria-hidden="true">
                <IconTag size={18} />
                <div>
                  <b>R$ 499</b>
                  <span>pagamento único</span>
                </div>
              </div>

              <figcaption>Exemplo ilustrativo</figcaption>
            </figure>
          </div>
        </section>

        {/* ===== Fontes ===== */}
        <section className="lp-sources" aria-label="Fontes oficiais consultadas">
          <div className="lp-container lp-sources-inner">
            <p>Consultamos fontes oficiais:</p>
            <ul>
              <li>
                <strong>INPI</strong> base de marcas
              </li>
              <li>
                <strong>RPI</strong> Revista da Propriedade Industrial
              </li>
              <li>
                <strong>Nice</strong> classificação de produtos e serviços
              </li>
            </ul>
          </div>
        </section>

        {/* ===== Como funciona ===== */}
        <section id="como-funciona" className="lp-section" aria-labelledby="t-como">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-kicker">Como funciona</p>
              <h2 id="t-como">Do primeiro clique à marca registrada, em quatro passos</h2>
            </div>
            <ol className="lp-steps">
              {PASSOS.map((p, i) => (
                <li className={`lp-step lp-tone-${p.tone}`} key={p.titulo}>
                  <div className="lp-step-top">
                    <span className="lp-icon-tile">{p.icon}</span>
                    <span className="lp-step-num" aria-hidden="true">
                      0{i + 1}
                    </span>
                  </div>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ===== Recursos (bento) ===== */}
        <section id="recursos" className="lp-section lp-band lp-band-neutral lp-tone-lav" aria-labelledby="t-recursos">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-kicker">O que você recebe</p>
              <h2 id="t-recursos">Menos achismo, mais critério para decidir</h2>
            </div>

            <div className="lp-bento">
              <article className="lp-card lp-bento-wide lp-tone-mint">
                <span className="lp-icon-tile">
                  <IconWave />
                </span>
                <h3>Uma busca que entende o som</h3>
                <p>
                  &ldquo;Kazamarela&rdquo; e &ldquo;Casa Amarela&rdquo; são marcas diferentes no
                  papel e iguais no ouvido. A busca compara como o nome soa, não só como se
                  escreve.
                </p>
                <div className="lp-visual lp-visual-sound" aria-hidden="true">
                  <span className="lp-chip">kazamarela</span>
                  <span className="lp-visual-eq">≈</span>
                  <span className="lp-chip">casa amarela</span>
                  <span className="lp-pill lp-pill-risk">100% parecidas</span>
                </div>
              </article>

              <article className="lp-card lp-tone-peach">
                <span className="lp-icon-tile">
                  <IconLayers />
                </span>
                <h3>Classe de Nice sugerida</h3>
                <p>
                  A partir da descrição do que você vende, sugerimos a classe — e eu confirmo com
                  você antes de protocolar.
                </p>
                <div className="lp-visual" aria-hidden="true">
                  <span className="lp-pill lp-pill-mint">NCL 30</span>
                  <span className="lp-visual-note">Padaria e confeitaria</span>
                </div>
              </article>

              <article className="lp-card lp-tone-sky">
                <span className="lp-icon-tile">
                  <IconImage />
                </span>
                <h3>Logotipo, se tiver</h3>
                <p>
                  Marca com imagem? Arraste o PNG (até 1000×1000 px) no passo do plano. Só nome?
                  Nem precisa.
                </p>
                <div className="lp-visual lp-visual-drop" aria-hidden="true">
                  Arraste o PNG aqui
                </div>
              </article>

              <article className="lp-card lp-bento-wide lp-tone-lav">
                <span className="lp-icon-tile">
                  <IconBell />
                </span>
                <h3>Acompanhamento depois do protocolo</h3>
                <p>
                  A RPI, a revista oficial do INPI, sai toda terça. Acompanho o seu processo nela e
                  aviso sobre oposição de terceiros e prazos importantes.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ===== Comparativo ===== */}
        <section className="lp-section lp-tone-peach" aria-labelledby="t-diff">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-kicker">Diferença na prática</p>
              <h2 id="t-diff">Sem esperar orçamento para saber o básico</h2>
            </div>
            <div className="lp-diff">
              <div className="lp-diff-col">
                <h3>Em muitos escritórios</h3>
                <ul>
                  <li>
                    <IconX size={16} stroke={1.5} />
                    Orçamento por telefone, com espera pelo retorno
                  </li>
                  <li>
                    <IconX size={16} stroke={1.5} />
                    Busca de anterioridade feita à mão
                  </li>
                  <li>
                    <IconX size={16} stroke={1.5} />
                    Preço definido caso a caso
                  </li>
                </ul>
              </div>
              <div className="lp-diff-col lp-diff-col-us">
                <h3>Com o MarcaSync</h3>
                <ul>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Preço fechado na tela, antes de decidir
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Busca em tempo real na base do INPI
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Uma única pessoa cuida do seu registro, do início ao fim
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Benefícios ===== */}
        <section className="lp-section lp-band lp-tone-peach" aria-labelledby="t-benef">
          <div className="lp-container lp-split">
            <div className="lp-section-head lp-split-head">
              <p className="lp-kicker">Por que registrar</p>
              <h2 id="t-benef">Sua marca é o ativo que o concorrente não pode copiar</h2>
              <p className="lp-section-lede">
                Sem registro, o nome que você construiu pode ser de quem protocolar primeiro.
              </p>
            </div>
            <ul className="lp-benefits">
              {BENEFICIOS.map((b) => (
                <li className={`lp-card lp-tone-${b.tone}`} key={b.titulo}>
                  <span className="lp-icon-tile">{b.icon}</span>
                  <h3>{b.titulo}</h3>
                  <p>{b.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===== Preços ===== */}
        <section id="precos" className="lp-section" aria-labelledby="t-precos">
          <div className="lp-container">
            <div className="lp-section-head lp-center">
              <p className="lp-kicker">Preços</p>
              <h2 id="t-precos">Preço fechado, sem letra miúda</h2>
              <p className="lp-section-lede">
                Dois valores, os dois visíveis aqui e na tela da consulta.
              </p>
            </div>

            <div className="lp-pricing">
              <article className="lp-price-card lp-price-card-main">
                <p className="lp-price-tag">Para registrar</p>
                <h3>Setup — análise e protocolo</h3>
                <p className="lp-price">
                  R$&nbsp;499 <small>pagamento único</small>
                </p>
                <ul>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Busca de anterioridade: fonética e real no INPI
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Conferência da classe de Nice
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Petição e guia (GRU)
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Protocolo do pedido no INPI
                  </li>
                </ul>
                <Link href="/consulta" className="lp-btn lp-btn-primary lp-btn-lg lp-btn-block">
                  Ver se minha marca está livre
                  <IconArrowRight size={18} />
                </Link>
              </article>

              <article className="lp-price-card">
                <p className="lp-price-tag lp-tone-lav">Opcional</p>
                <h3>Monitoramento da RPI</h3>
                <p className="lp-price">
                  R$&nbsp;29 <small>por mês</small>
                </p>
                <ul>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Acompanhamento semanal da RPI
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Aviso de oposição de terceiros
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Aviso de prazos (oposição e decênio)
                  </li>
                  <li>
                    <IconCheck size={16} stroke={1.5} />
                    Desliga quando quiser
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="duvidas" className="lp-section lp-band lp-tone-sky" aria-labelledby="t-faq">
          <div className="lp-container lp-split lp-split-faq">
            <div className="lp-section-head lp-split-head">
              <p className="lp-kicker">Dúvidas</p>
              <h2 id="t-faq">Perguntas frequentes</h2>
              <p className="lp-section-lede">
                Não achou a sua? Faça a consulta e me chame no WhatsApp.
              </p>
            </div>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.p} name="faq" className="lp-faq-item">
                  <summary>
                    <span>{f.p}</span>
                    <span className="lp-faq-icon" aria-hidden="true" />
                  </summary>
                  <p>{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA final ===== */}
        <section className="lp-final" aria-labelledby="t-final">
          <div className="lp-container">
            <div className="lp-final-card">
              <h2 id="t-final">Pronto para saber se sua marca está livre?</h2>
              <p>Leva alguns segundos e você não precisa criar conta.</p>
              <Link href="/consulta" className="lp-btn lp-btn-light lp-btn-lg">
                Analisar minha marca grátis
                <IconArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <span className="lp-brand">MarcaSync</span>
            <p>Busca de anterioridade e registro de marcas junto ao INPI, com preço fechado.</p>
          </div>
          <nav className="lp-footer-nav" aria-label="Rodapé">
            <a href="#como-funciona">Como funciona</a>
            <a href="#precos">Preços</a>
            <a href="#duvidas">Dúvidas</a>
            <Link href="/consulta">Começar consulta</Link>
          </nav>
          <p className="lp-footer-legal">
            O MarcaSync é um serviço independente, sem vínculo com o INPI. A busca indica risco de
            colisão a partir de dados públicos; a decisão final é sempre do INPI.
            <br />© 2026 MarcaSync
          </p>
        </div>
      </footer>
    </div>
  );
}
