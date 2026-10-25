"use client";

import { Fragment } from "react";
import { camposEmarcas } from "@/lib/campos-emarcas";
import { fmtDataHora, fmtDocumento, fmtEndereco, linhasDoTitular } from "@/lib/admin-dados";
import { fmtReais } from "@/lib/planos";
import type { Prontidao } from "@/lib/prontidao";
import type { PedidoRegistro } from "./tipos";

/**
 * Os dados do pedido de registro: quem é o titular e o que o e-INPI vai receber, na ordem em que o
 * e-Marcas os pede (Manual de Marcas do INPI, itens 3.1 e 3.5.2), mais a checklist "pronto para
 * protocolar". Serve para você conferir, e é o que o robô usa para preencher. Só aparece aqui, na
 * área com senha: CPF/CNPJ e endereço não saem desta tela.
 */
export default function PedidoDetalhe({
  pedido: d,
  processoId,
  prontidao,
  temImagem,
  marca,
  rotulo,
  aberto,
}: {
  pedido: PedidoRegistro;
  processoId: string;
  prontidao: Prontidao | null;
  temImagem: boolean;
  marca: string;
  rotulo: string;
  /** Começa aberto (o botão "abrir tudo" do painel). */
  aberto: boolean;
}) {
  const titular = linhasDoTitular(d);
  const linhas: Array<[string, string]> = [
    ...titular,
    ["Endereço completo", fmtEndereco(d)],
    ...camposEmarcas(d)
      .filter(([nome]) => nome !== "Natureza jurídica (e-INPI)") // já aparece acima, com o enquadramento
      .map(([nome, valor]): [string, string] => [
      nome,
      nome === "CPF/CNPJ"
        ? fmtDocumento(d.documento)
        : (valor ?? "— (não se aplica a este pedido)"),
    ]),
    ["Itens da especificação", d.especificacaoItens.join(" | ")],
    ["Complemento", d.complemento ?? "—"],
    ["Viu o aviso de marca anterior parecida", d.cienteAnterioridade ? "Sim" : "Não"],
    [
      "GRU a emitir",
      `serviço ${d.especificacaoLivre ? "394 (especificação livre)" : "389 (especificação pré-aprovada)"}, ${fmtReais(d.gruCentavos)}${d.gruComDesconto ? " (com 50% de desconto)" : ""}; confirme o valor na tela de emissão`,
    ],
    ["Serviço MarcaSync", fmtReais(d.servicoCentavos)],
    ["Total cobrado do cliente", fmtReais(d.servicoCentavos + d.gruCentavos)],
    ["Aceites dados em", fmtDataHora(d.aceitoEm)],
    ["Pedido criado em", fmtDataHora(d.createdAt)],
    ["Pedido atualizado em", fmtDataHora(d.updatedAt)],
  ];
  return (
    <details open={aberto} key={aberto ? "aberto" : "fechado"} style={{ margin: "4px 0 8px" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{rotulo}</summary>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(150px, 230px) 1fr",
          gap: "4px 12px",
          fontSize: 12.5,
          marginTop: 8,
        }}
        aria-label={`Dados do pedido da marca ${marca}`}
      >
        {linhas.map(([nome, valor]) => (
          <Fragment key={nome}>
            <dt style={{ color: "var(--ink-dim)" }}>{nome}</dt>
            <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{valor}</dd>
          </Fragment>
        ))}
      </dl>
      {temImagem && (
        <p style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          Imagem da marca:{" "}
          <a href={`/api/processos/${processoId}/imagem`} target="_blank" rel="noreferrer">
            JPG pronto para o e-Marcas
          </a>
          {" · "}
          <a
            href={`/api/processos/${processoId}/imagem?tipo=original`}
            target="_blank"
            rel="noreferrer"
          >
            arquivo original
          </a>
        </p>
      )}
      <p style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 4px" }}>
        {prontidao?.pronto ? "Pronto para protocolar" : "Antes de protocolar"}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
        {(prontidao?.itens ?? []).map((i) => (
          <li key={i.id} style={{ marginBottom: 3 }}>
            <strong>
              {i.estado === "ok" ? "✓" : i.estado === "atencao" ? "Conferir:" : "Falta:"} {i.titulo}
            </strong>
            {i.estado !== "ok" && (
              <span style={{ color: "var(--ink-dim)" }}>
                {" "}
                ({i.quem === "cliente" ? "cliente" : "você"}) {i.detalhe}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
