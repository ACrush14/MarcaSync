"use client";

import { useState } from "react";
import TrackView from "./TrackView";
import AvisoAnterioridadeBox from "./AvisoAnterioridadeBox";
import { DOCUMENTOS_INPI, DOCUMENTOS_MARCASYNC } from "@/lib/documentos";
import GarantiaDevolucao from "./GarantiaDevolucao";
import EspecificacaoPicker from "./EspecificacaoPicker";
import ImagemMarcaUpload from "./ImagemMarcaUpload";
import { track } from "@/lib/track";
import type { AvisoAnterioridade } from "@/lib/anterioridade";
import { detectarPalavraEstrangeira } from "@/lib/idioma";
import { CLASS_LABELS } from "@/lib/ncl";
import { REGIMES, REGIMES_PJ, ROTULO_REGIME, calcularGru, type Regime } from "@/lib/gru";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS, fmtReais } from "@/lib/planos";
import {
  APRESENTACOES,
  ROTULO_APRESENTACAO,
  UFS,
  somenteDigitos,
  validarPedido,
  type Apresentacao,
  type PedidoEntrada,
} from "@/lib/pedido";

/** O que o servidor devolve depois de gravar: só valores, nunca os dados pessoais. */
export interface ResumoPedido {
  servicoCentavos: number;
  gruCentavos: number;
  gruComDesconto: boolean;
  especificacaoLivre: boolean;
  totalCentavos: number;
  monitoramento: boolean;
  monitoramentoCentavos: number;
}

interface PedidoStepProps {
  processoId: string | null;
  marca: string;
  classeSugerida: string;
  /** O aviso de marca anterior parecida (nivel "nenhum" quando não há). */
  aviso: AvisoAnterioridade;
  monitoramento: boolean;
  onVoltar: () => void;
  onEnviado: (resumo: ResumoPedido) => void;
}

/** Máscaras simples, só para facilitar a digitação: o servidor valida os dígitos de novo. */
function mascararDocumento(v: string, pj: boolean): string {
  const d = somenteDigitos(v).slice(0, pj ? 14 : 11);
  if (pj) {
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function mascararCep(v: string): string {
  const d = somenteDigitos(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

const CLASSES = Array.from({ length: 45 }, (_, i) => String(i + 1));

/** Um campo do formulário: rótulo, a entrada e (se houver) a ajuda ou a mensagem de erro. */
function Campo({
  id,
  rotulo,
  ajuda,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  ajuda?: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={`campo-${id}`}>{rotulo}</label>
      {children}
      {ajuda && !erro && (
        <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>{ajuda}</p>
      )}
      {erro && (
        <p
          id={`erro-${id}`}
          role="alert"
          style={{ fontSize: 13, color: "var(--risk)", marginTop: 6 }}
        >
          {erro}
        </p>
      )}
    </div>
  );
}

/**
 * Passo "Dados do pedido": o cliente já viu o resultado e o plano e decidiu seguir. Aqui ele
 * informa o que o e-Marcas do INPI pede (titular, endereço, marca, classe, atividade) e dá os
 * aceites. Nada que pague ou protocole acontece aqui: o formulário só grava os dados e gera
 * as cobranças pendentes. O pagamento e o protocolo são feitos por mim, depois da conversa.
 *
 * Este formulário NÃO pede login nem senha do gov.br ou do e-INPI, e diz isso na tela.
 */
export default function PedidoStep({
  processoId,
  marca,
  classeSugerida,
  aviso,
  monitoramento,
  onVoltar,
  onEnviado,
}: PedidoStepProps) {
  const [f, setF] = useState({
    tipoRequerente: "pf",
    regime: "pessoa_natural" as Regime,
    participaEmpresaDoRamo: false,
    nome: "",
    documento: "",
    email: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    apresentacao: "nominativa" as Apresentacao,
    elementoNominativo: marca,
    classeNice: /^\d{1,2}$/.test(classeSugerida) ? String(Number(classeSugerida)) : "",
    especificacaoItens: [] as string[],
    palavraEstrangeira: null as boolean | null,
    traducao: "",
    atividade: "",
    declaracaoAtividade: false,
    declaracaoVeracidade: false,
    aceiteProcuracao: false,
    aceiteLgpd: false,
    aceiteTermos: false,
    cienciaDocumentosInpi: false,
    cienteAnterioridade: false,
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  // Algum item da especificação está fora da lista do INPI (a taxa passa a ser a da GRU 394)?
  const [especificacaoLivre, setEspecificacaoLivre] = useState(false);
  const [imagemGuardada, setImagemGuardada] = useState(false);

  const pj = f.tipoRequerente === "pj";
  const gru = calcularGru(f.regime, f.participaEmpresaDoRamo, especificacaoLivre);
  const precisaImagem = f.apresentacao !== "nominativa";
  const avisoAtivo = aviso.nivel !== "nenhum";
  const suspeitaIdioma = detectarPalavraEstrangeira(f.elementoNominativo);
  const total = SETUP_CENTAVOS + gru.centavos;

  function set<K extends keyof typeof f>(campo: K, valor: (typeof f)[K]) {
    setF((antes) => ({ ...antes, [campo]: valor }));
    setErros((antes) => {
      if (!antes[campo as string]) return antes;
      const { [campo as string]: _, ...resto } = antes;
      return resto;
    });
  }

  function trocarTipo(tipo: "pf" | "pj") {
    setF((antes) => ({
      ...antes,
      tipoRequerente: tipo,
      regime: tipo === "pf" ? "pessoa_natural" : "microempresa",
      participaEmpresaDoRamo: false,
      documento: "",
    }));
    setErros({});
  }

  async function enviar() {
    setErroGeral(null);
    const entrada: PedidoEntrada = { ...f, monitoramento };
    const local = validarPedido(entrada);
    const faltas: Record<string, string> = local.ok ? {} : { ...local.erros };
    if (precisaImagem && !imagemGuardada) faltas.imagem = "Envie a imagem da marca.";
    if (avisoAtivo && !f.cienteAnterioridade) {
      faltas.cienteAnterioridade = "Confirme que leu o aviso de marca anterior.";
    }
    if (Object.keys(faltas).length > 0) {
      setErros(faltas);
      const primeiro = Object.keys(faltas)[0];
      document.getElementById(`campo-${primeiro}`)?.focus();
      return;
    }
    if (!processoId) {
      setErroGeral(
        "Ainda não consegui registrar a sua consulta. Volte ao resultado e tente de novo."
      );
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`/api/processos/${processoId}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrada),
      });
      const corpo = await res.json();
      if (!res.ok) {
        if (corpo?.erros) setErros(corpo.erros as Record<string, string>);
        throw new Error(corpo?.error ?? "Não consegui enviar.");
      }
      track("pedido_enviado");
      onEnviado(corpo.resumo as ResumoPedido);
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Falha de rede. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const attrs = (id: string) => ({
    id: `campo-${id}`,
    "aria-invalid": !!erros[id],
    "aria-describedby": erros[id] ? `erro-${id}` : undefined,
  });

  return (
    <>
      <TrackView nome="pedido_visto" />
      <div className="panel-head">
        <h2>Dados para o pedido de registro</h2>
        <p className="help">
          É o que o INPI pede para protocolar a marca &quot;{marca}&quot;. Leva uns 5 minutos. Nada
          é pago nem protocolado agora: eu confiro tudo com você antes. Este formulário <b>nunca</b>{" "}
          pede a sua senha do gov.br ou do INPI.
        </p>
      </div>

      <AvisoAnterioridadeBox aviso={aviso} />

      <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 8px" }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>
          Quem vai ser o titular da marca
        </legend>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="tipo" checked={!pj} onChange={() => trocarTipo("pf")} />
            Pessoa física (CPF)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name="tipo" checked={pj} onChange={() => trocarTipo("pj")} />
            Pessoa jurídica (CNPJ)
          </label>
        </div>
      </fieldset>

      <div className="grid-2">
        <div>
          {pj && (
            <Campo
              id="regime"
              erro={erros.regime}
              rotulo="Natureza jurídica"
              ajuda="É a mesma opção que vai no cadastro do e-INPI e define o desconto na taxa do INPI."
            >
              <select
                {...attrs("regime")}
                value={f.regime}
                onChange={(e) => set("regime", e.target.value as Regime)}
              >
                {REGIMES.filter((r) => REGIMES_PJ.includes(r)).map((r) => (
                  <option key={r} value={r}>
                    {ROTULO_REGIME[r]}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {!pj && (
            <div className="field">
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={f.participaEmpresaDoRamo}
                  onChange={(e) => set("participaEmpresaDoRamo", e.target.checked)}
                />
                <span>
                  Sou sócio(a) de uma empresa do mesmo ramo desta marca
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink-dim)" }}>
                    Quem é sócio de empresa do ramo perde o desconto de 50% na taxa do INPI.
                  </span>
                </span>
              </label>
            </div>
          )}
          <Campo
            id="nome"
            erro={erros.nome}
            rotulo={pj ? "Razão social" : "Nome completo"}
            ajuda="Completo, sem abreviações."
          >
            <input
              {...attrs("nome")}
              type="text"
              autoComplete={pj ? "organization" : "name"}
              value={f.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
          </Campo>
          <Campo id="documento" erro={erros.documento} rotulo={pj ? "CNPJ" : "CPF"}>
            <input
              {...attrs("documento")}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={f.documento}
              onChange={(e) => set("documento", mascararDocumento(e.target.value, pj))}
              placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"}
            />
          </Campo>
          <Campo
            id="email"
            erro={erros.email}
            rotulo="E-mail"
            ajuda="O INPI pode entrar em contato por ele."
          >
            <input
              {...attrs("email")}
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Campo>
          <Campo id="cep" erro={erros.cep} rotulo="CEP">
            <input
              {...attrs("cep")}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={f.cep}
              onChange={(e) => set("cep", mascararCep(e.target.value))}
              placeholder="00000-000"
            />
          </Campo>
          <Campo id="logradouro" erro={erros.logradouro} rotulo="Rua ou avenida">
            <input
              {...attrs("logradouro")}
              type="text"
              autoComplete="address-line1"
              value={f.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
            />
          </Campo>
          <div className="grid-2">
            <Campo id="numero" erro={erros.numero} rotulo="Número">
              <input
                {...attrs("numero")}
                type="text"
                value={f.numero}
                onChange={(e) => set("numero", e.target.value)}
              />
            </Campo>
            <Campo id="complemento" erro={erros.complemento} rotulo="Complemento (opcional)">
              <input
                {...attrs("complemento")}
                type="text"
                autoComplete="address-line2"
                value={f.complemento}
                onChange={(e) => set("complemento", e.target.value)}
              />
            </Campo>
          </div>
          <Campo id="bairro" erro={erros.bairro} rotulo="Bairro">
            <input
              {...attrs("bairro")}
              type="text"
              value={f.bairro}
              onChange={(e) => set("bairro", e.target.value)}
            />
          </Campo>
          <div className="grid-2">
            <Campo id="cidade" erro={erros.cidade} rotulo="Cidade">
              <input
                {...attrs("cidade")}
                type="text"
                autoComplete="address-level2"
                value={f.cidade}
                onChange={(e) => set("cidade", e.target.value)}
              />
            </Campo>
            <Campo id="uf" erro={erros.uf} rotulo="Estado">
              <select {...attrs("uf")} value={f.uf} onChange={(e) => set("uf", e.target.value)}>
                <option value="">Escolha</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        </div>

        <div>
          <Campo id="apresentacao" erro={erros.apresentacao} rotulo="Como a marca se apresenta">
            <select
              {...attrs("apresentacao")}
              value={f.apresentacao}
              onChange={(e) => set("apresentacao", e.target.value as Apresentacao)}
            >
              {APRESENTACOES.map((a) => (
                <option key={a} value={a}>
                  {ROTULO_APRESENTACAO[a]}
                </option>
              ))}
            </select>
          </Campo>
          {precisaImagem && (
            <ImagemMarcaUpload
              processoId={processoId}
              onGuardada={setImagemGuardada}
              erro={erros.imagem}
            />
          )}
          {f.apresentacao !== "figurativa" && (
            <Campo
              id="elementoNominativo"
              rotulo="Nome da marca"
              ajuda="Exatamente como deve constar no registro."
            >
              <input
                {...attrs("elementoNominativo")}
                type="text"
                value={f.elementoNominativo}
                onChange={(e) => set("elementoNominativo", e.target.value)}
              />
            </Campo>
          )}
          {f.apresentacao !== "figurativa" && (
            <fieldset className="field" style={{ border: 0, padding: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 6 }}>
                O nome tem palavra em outro idioma?
              </legend>
              <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: "0 0 6px" }}>
                O INPI pede a tradução de qualquer palavra estrangeira. Palavra inventada, que não
                existe em nenhum idioma, não precisa.
              </p>
              {suspeitaIdioma.suspeita && f.palavraEstrangeira === null && (
                <p role="note" style={{ fontSize: 13, margin: "0 0 6px" }}>
                  <b>
                    {suspeitaIdioma.palavras.map((p) => `"${p}"`).join(", ")}{" "}
                    {suspeitaIdioma.palavras.length > 1 ? "podem ser" : "pode ser"} de outro idioma.
                  </b>{" "}
                  Veja se é.
                </p>
              )}
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    id="campo-palavraEstrangeira"
                    type="radio"
                    name="palavraEstrangeira"
                    checked={f.palavraEstrangeira === true}
                    onChange={() => set("palavraEstrangeira", true)}
                  />
                  Sim
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="palavraEstrangeira"
                    checked={f.palavraEstrangeira === false}
                    onChange={() => {
                      set("palavraEstrangeira", false);
                      set("traducao", "");
                    }}
                  />
                  Não
                </label>
              </div>
              {erros.palavraEstrangeira && (
                <p role="alert" style={{ fontSize: 13, color: "var(--risk)", marginTop: 6 }}>
                  {erros.palavraEstrangeira}
                </p>
              )}
              {f.palavraEstrangeira === true && (
                <Campo
                  id="traducao"
                  erro={erros.traducao}
                  rotulo="Tradução para o português"
                  ajuda={'Ex.: "Sweet Shop" = "Loja de doces".'}
                >
                  <input
                    {...attrs("traducao")}
                    type="text"
                    value={f.traducao}
                    onChange={(e) => set("traducao", e.target.value)}
                  />
                </Campo>
              )}
            </fieldset>
          )}
          <Campo
            id="classeNice"
            rotulo="Classe de Nice"
            ajuda="Cada pedido no INPI tem uma classe só. A sugerida vem da sua descrição."
          >
            <select
              {...attrs("classeNice")}
              value={f.classeNice}
              onChange={(e) => {
                set("classeNice", e.target.value);
                // A lista é por classe: ao trocar, a especificação recomeça.
                set("especificacaoItens", []);
                setEspecificacaoLivre(false);
              }}
            >
              <option value="">Escolha</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {CLASS_LABELS[c] ? ` — ${CLASS_LABELS[c]}` : ""}
                </option>
              ))}
            </select>
          </Campo>
          <EspecificacaoPicker
            classe={f.classeNice}
            itens={f.especificacaoItens}
            onChange={(itens) => set("especificacaoItens", itens)}
            onAnalise={setEspecificacaoLivre}
            erro={erros.especificacao}
          />
          <Campo
            id="atividade"
            rotulo="Qual atividade você exerce hoje"
            ajuda="O INPI só aceita marca de quem exerce de fato a atividade (art. 128 da Lei 9.279/96)."
          >
            <textarea
              {...attrs("atividade")}
              rows={3}
              value={f.atividade}
              onChange={(e) => set("atividade", e.target.value)}
              placeholder="Ex.: confeitaria artesanal, vendendo bolos sob encomenda desde 2023."
            />
          </Campo>
        </div>
      </div>

      <div className="helpbox" style={{ margin: "20px 0" }}>
        <h3>Quanto você paga</h3>
        <table style={{ width: "100%", fontSize: 14 }}>
          <tbody>
            <tr>
              <td>Serviço MarcaSync (análise, petição e protocolo)</td>
              <td className="tab-nums" style={{ textAlign: "right" }}>
                {fmtReais(SETUP_CENTAVOS)}
              </td>
            </tr>
            <tr>
              <td>
                Taxa do INPI (GRU {especificacaoLivre ? "394, texto livre" : "389, lista do INPI"}
                ), 1 classe
                {gru.comDesconto ? " — com 50% de desconto" : ""}
              </td>
              <td className="tab-nums" style={{ textAlign: "right" }}>
                {fmtReais(gru.centavos)}
              </td>
            </tr>
            <tr style={{ fontWeight: 600 }}>
              <td>Total para registrar</td>
              <td className="tab-nums" style={{ textAlign: "right" }}>
                {fmtReais(total)}
              </td>
            </tr>
            {monitoramento && (
              <tr style={{ color: "var(--ink-dim)" }}>
                <td>Monitoramento, depois da publicação</td>
                <td className="tab-nums" style={{ textAlign: "right" }}>
                  {fmtReais(MONITORAMENTO_CENTAVOS)}/mês
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ fontSize: 12.5, color: "var(--ink-dim)", marginTop: 8 }}>
          A taxa do INPI é a oficial e vai direto para o INPI: eu a pago com o valor exato que o
          sistema deles mostrar na hora de gerar a guia. Se esse valor for diferente do acima, eu te
          aviso antes de qualquer pagamento.
        </p>
      </div>

      <GarantiaDevolucao />

      {avisoAtivo && (
        <div className="field" style={{ marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              {...attrs("cienteAnterioridade")}
              type="checkbox"
              checked={f.cienteAnterioridade}
              onChange={(e) => set("cienteAnterioridade", e.target.checked)}
            />
            <span style={{ fontSize: 13.5 }}>
              Li o aviso acima: sei que há uma marca parecida no meu ramo e que o INPI pode
              indeferir o pedido, e a taxa em regra não é devolvida.
            </span>
          </label>
          {erros.cienteAnterioridade && (
            <p
              id="erro-cienteAnterioridade"
              role="alert"
              style={{ fontSize: 13, color: "var(--risk)", marginTop: 4 }}
            >
              {erros.cienteAnterioridade}
            </p>
          )}
        </div>
      )}

      <div className="helpbox" style={{ margin: "0 0 16px" }}>
        <h3>Leia antes de pagar</h3>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 8 }}>
          Abra os documentos abaixo (cada link abre em outra aba) e marque as confirmações no fim
          do formulário. Sem elas não dá para seguir para o pagamento.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
          {[...DOCUMENTOS_MARCASYNC, ...DOCUMENTOS_INPI].map((d) => (
            <li key={d.url} style={{ marginBottom: 4 }}>
              <a href={d.url} target="_blank" rel="noopener noreferrer">
                {d.rotulo}
              </a>
              {d.externo ? " (INPI e órgãos oficiais)" : " (MarcaSync)"}
            </li>
          ))}
        </ul>
      </div>

      <div className="field">
        {(
          [
            [
              "aceiteTermos",
              "Li e aceito os Termos de uso e a Política de privacidade do MarcaSync, inclusive a garantia de devolução.",
            ],
            [
              "cienciaDocumentosInpi",
              "Li, ou tive acesso, ao Manual de Marcas, à Tabela de Retribuições e à lista de produtos e serviços do INPI. Sei que quem decide o registro é o INPI e que a taxa paga ao INPI, em regra, não é devolvida por ele.",
            ],
            [
              "declaracaoAtividade",
              "Declaro, sob as penas da lei, que exerço de forma efetiva e lícita a atividade acima, compatível com os produtos ou serviços da marca.",
            ],
            [
              "declaracaoVeracidade",
              "Declaro que todas as informações deste formulário são verdadeiras.",
            ],
            [
              "aceiteProcuracao",
              "Autorizo o MarcaSync a me representar como procurador junto ao INPI para este pedido. Vou receber a procuração para assinar.",
            ],
            [
              "aceiteLgpd",
              "Concordo que meus dados (incluindo CPF ou CNPJ e endereço) sejam usados só para protocolar e acompanhar este pedido e falar comigo sobre ele.",
            ],
          ] as const
        ).map(([campo, texto]) => (
          <div key={campo} style={{ marginBottom: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                {...attrs(campo)}
                type="checkbox"
                checked={f[campo]}
                onChange={(e) => set(campo, e.target.checked)}
              />
              <span style={{ fontSize: 13.5 }}>{texto}</span>
            </label>
            {erros[campo] && (
              <p
                id={`erro-${campo}`}
                role="alert"
                style={{ fontSize: 13, color: "var(--risk)", marginTop: 4 }}
              >
                {erros[campo]}
              </p>
            )}
          </div>
        ))}
      </div>

      {erroGeral && (
        <p role="alert" style={{ fontSize: 13.5, color: "var(--risk)", marginBottom: 12 }}>
          {erroGeral}
        </p>
      )}

      <div className="cta-row">
        <button className="btn ghost" onClick={onVoltar} disabled={enviando}>
          ← Voltar ao plano
        </button>
        <button className="btn" onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando…" : "Confirmar e continuar →"}
        </button>
      </div>
    </>
  );
}
