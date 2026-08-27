"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Landing page — a porta de entrada real do produto agora (o assistente
 * interativo mudou pra /consulta). Estrutura inspirada em sites
 * tradicionais de escritório de marcas (herói, "como funciona",
 * benefícios, FAQ, rodapé) — mas deliberadamente sem números inventados
 * (anos de mercado, marcas registradas, depoimentos de cliente). O
 * MarcaSync é novo; fingir histórico que não existe seria o tipo de
 * mentira que este projeto vem evitando desde o início (ver README,
 * seção "O que já é funcional"). A honestidade "somos novos, mas
 * rápidos e transparentes" carrega o argumento sozinha.
 */

const PASSOS = [
  {
    n: "1",
    titulo: "Você faz a busca",
    texto: "Nome da marca e descrição do produto — resultado em segundos, direto na base do INPI.",
  },
  {
    n: "2",
    titulo: "Você vê o preço, sem esperar orçamento",
    texto: "Setup e monitoramento aparecem na tela, fechados, antes de você decidir qualquer coisa.",
  },
  {
    n: "3",
    titulo: "Você fala comigo pelo WhatsApp",
    texto: "Reviso o resultado com você pessoalmente e tiro qualquer dúvida antes de seguir.",
  },
  {
    n: "4",
    titulo: "Eu cuido do registro",
    texto: "Do protocolo no INPI até você ter sua marca registrada — com você sabendo de cada etapa.",
  },
];

const BENEFICIOS = [
  {
    titulo: "Exclusividade em todo o Brasil",
    texto: "Só você pode usar sua marca no ramo registrado, em território nacional.",
  },
  {
    titulo: "Proteção contra uso indevido",
    texto: "Base legal pra agir contra quem copiar seu nome ou se aproveitar da sua reputação.",
  },
  {
    titulo: "Valorização do seu negócio",
    texto: "Marca registrada é patrimônio — conta na hora de vender, franquear ou buscar investimento.",
  },
  {
    titulo: "Segurança pra investir e crescer",
    texto: "Sem o risco de construir uma marca por anos e ter que trocar de nome depois.",
  },
];

const FAQ = [
  {
    p: "Quanto tempo demora pra registrar uma marca?",
    r: "No INPI, o prazo típico até a concessão é de 12 a 24 meses, mesmo sem oposição de terceiros — o processo é federal, não é algo que dá pra acelerar. O que dá pra fazer rápido é a parte que depende da gente: a busca de anterioridade e o protocolo do pedido.",
  },
  {
    p: "O resultado da busca é garantia de que meu registro vai ser aprovado?",
    r: "Não. É uma estimativa de risco de colisão baseada na base pública do INPI, no momento da consulta. Quem decide de fato é o próprio INPI, no exame do pedido — a busca existe pra reduzir risco antes de você investir tempo e dinheiro, não pra substituir a análise oficial.",
  },
  {
    p: "Preciso ter CNPJ pra registrar minha marca?",
    r: "Não necessariamente — pessoa física também pode registrar, dependendo da atividade. Isso é exatamente o tipo de detalhe que reviso com você pessoalmente antes de protocolar, porque muda caso a caso.",
  },
  {
    p: "Preciso enviar logotipo?",
    r: "Só se sua marca tiver um logotipo (marca mista — nome + imagem). Se for só o nome (marca nominativa), não precisa.",
  },
  {
    p: "Como funciona o pagamento?",
    r: "PIX, confirmado manualmente depois que você avisa. Setup é pagamento único; o monitoramento (opcional) é mensal, e você pode desligar quando quiser.",
  },
];

function FaqItem({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="landing-faq-item">
      <button
        className="landing-faq-question"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
      >
        <span>{pergunta}</span>
        <span aria-hidden="true">{aberto ? "−" : "+"}</span>
      </button>
      {aberto && <div className="landing-faq-answer">{resposta}</div>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand">
          <span className="mark">MarcaSync</span>
        </div>
        <div className="landing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <a href="#precos">Preços</a>
          <a href="#faq">Dúvidas</a>
        </div>
        <Link href="/consulta" className="btn">
          Começar agora →
        </Link>
      </nav>

      <header className="landing-hero">
        <div>
          <h1>
            Registre sua marca com busca real no INPI — e preço fechado, sem esperar
            orçamento.
          </h1>
          <p className="lede">
            Descubra em segundos se sua marca corre risco de colidir com uma já
            registrada. Sem &quot;fale com um consultor&quot;: o valor aparece na tela,
            e depois você conversa comigo direto pelo WhatsApp pra seguir com o
            registro.
          </p>
          <div className="landing-hero-ctas">
            <Link href="/consulta" className="btn">
              Analisar minha marca grátis →
            </Link>
            <span className="landing-hero-hint">Sem cadastro prévio · resultado em segundos</span>
          </div>
        </div>

        <div className="landing-mockup" aria-hidden="true">
          <div className="risk-summary" style={{ marginBottom: 0 }}>
            <div className="metric">
              <div className="lbl">Nível de colisão</div>
              <div className="val">22%</div>
              <div className="sub">
                <span className="pill safe">Risco baixo</span>{" "}
                <span className="pill accent">INPI</span>
              </div>
            </div>
            <div className="metric">
              <div className="lbl">Classe sugerida</div>
              <div className="val" style={{ fontSize: 18 }}>
                NCL 30
              </div>
              <div className="sub">Padaria e confeitaria</div>
            </div>
          </div>
          <p className="landing-mockup-caption">Exemplo ilustrativo do resultado</p>
        </div>
      </header>

      <section id="como-funciona" className="landing-section">
        <h2>Como funciona</h2>
        <p className="landing-section-lede">
          Quatro passos, do primeiro clique até você ter a marca registrada.
        </p>
        <div className="landing-steps">
          {PASSOS.map((p) => (
            <div className="landing-step" key={p.n}>
              <div className="landing-step-num">{p.n}</div>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Diferente do escritório tradicional</h2>
        <div className="landing-diff">
          <div className="landing-diff-col">
            <div className="landing-diff-label bad">Do jeito de sempre</div>
            <ul>
              <li>Pedir orçamento por telefone e esperar retorno</li>
              <li>Busca de anterioridade manual, demorada</li>
              <li>Preço decidido caso a caso, sem tabela clara</li>
            </ul>
          </div>
          <div className="landing-diff-col">
            <div className="landing-diff-label good">Com o MarcaSync</div>
            <ul>
              <li>Preço fechado na tela, antes de decidir qualquer coisa</li>
              <li>Busca em tempo real, direto na base do INPI</li>
              <li>Você fala comigo — a mesma pessoa cuida do seu registro do início ao fim</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Benefícios de registrar sua marca</h2>
        <div className="landing-benefits">
          {BENEFICIOS.map((b) => (
            <div className="landing-benefit" key={b.titulo}>
              <h3>{b.titulo}</h3>
              <p>{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="precos" className="landing-section">
        <h2>Preço fechado, sem letra miúda</h2>
        <div className="plans">
          <div className="plan-card">
            <h3>Setup — Análise e Protocolo</h3>
            <div className="price">
              R$ 499 <small>pagamento único</small>
            </div>
            <ul>
              <li>Busca de anterioridade fonética + real no INPI</li>
              <li>Inferência e conferência da classe NCL</li>
              <li>Geração da petição e da guia (GRU)</li>
              <li>Protocolo do pedido no INPI</li>
            </ul>
          </div>
          <div className="plan-card">
            <h3>Monitoramento RPI</h3>
            <div className="price">
              R$ 29 <small>por mês</small>
            </div>
            <ul>
              <li>Leitura semanal automática da RPI</li>
              <li>Alerta de oposição de terceiros</li>
              <li>Alerta de prazos (oposição, decênio)</li>
            </ul>
          </div>
        </div>
        <Link href="/consulta" className="btn" style={{ marginTop: 24 }}>
          Ver se minha marca está livre →
        </Link>
      </section>

      <section id="faq" className="landing-section">
        <h2>Perguntas frequentes</h2>
        <div className="landing-faq">
          {FAQ.map((f) => (
            <FaqItem key={f.p} pergunta={f.p} resposta={f.r} />
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <div className="brand">
            <span className="mark">MarcaSync</span>
          </div>
          <p>Automação do processo de registro de marcas junto ao INPI.</p>
        </div>
        <Link href="/consulta" className="btn secondary">
          Começar consulta →
        </Link>
      </footer>
    </div>
  );
}
