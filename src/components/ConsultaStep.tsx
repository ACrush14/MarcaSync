"use client";

import { useState } from "react";

interface ConsultaStepProps {
  nomeCliente: string;
  whatsapp: string;
  marca: string;
  descricao: string;
  onAnalisar: (dados: {
    nomeCliente: string;
    whatsapp: string;
    marca: string;
    descricao: string;
  }) => void;
}

export default function ConsultaStep({
  nomeCliente,
  whatsapp,
  marca,
  descricao,
  onAnalisar,
}: ConsultaStepProps) {
  const [localNome, setLocalNome] = useState(nomeCliente);
  const [localWhatsapp, setLocalWhatsapp] = useState(whatsapp);
  const [localMarca, setLocalMarca] = useState(marca);
  const [localDescricao, setLocalDescricao] = useState(descricao);

  const podeAnalisar = localNome.trim() && localWhatsapp.trim() && localMarca.trim();

  return (
    <>
      <div className="panel-head">
        <h2>Nova consulta de viabilidade</h2>
        <p className="help">
          Descubra em segundos se sua marca corre risco de colidir com uma já
          registrada — direto na base real do INPI, com preço fechado desde já. Sem
          esperar orçamento por telefone ou WhatsApp.
        </p>
      </div>
      <div className="grid-2">
        <div>
          <div className="field">
            <label htmlFor="in-nome">Seu nome</label>
            <input
              type="text"
              id="in-nome"
              autoComplete="off"
              value={localNome}
              onChange={(e) => setLocalNome(e.target.value)}
              placeholder="Ex.: Ana Ramos"
            />
          </div>
          <div className="field">
            <label htmlFor="in-whatsapp">Seu WhatsApp</label>
            <input
              type="text"
              id="in-whatsapp"
              autoComplete="off"
              value={localWhatsapp}
              onChange={(e) => setLocalWhatsapp(e.target.value)}
              placeholder="Ex.: (85) 91234-5678"
            />
          </div>
          <div className="field">
            <label htmlFor="in-marca">Nome da marca pretendida</label>
            <input
              type="text"
              id="in-marca"
              value={localMarca}
              onChange={(e) => setLocalMarca(e.target.value)}
              placeholder="Ex.: Kaza Doce"
            />
          </div>
          <div className="field">
            <label htmlFor="in-desc">Descreva o produto ou serviço</label>
            <textarea
              id="in-desc"
              value={localDescricao}
              onChange={(e) => setLocalDescricao(e.target.value)}
              placeholder="Ex.: confeitaria artesanal, venda de bolos sob encomenda..."
            />
          </div>
          <button
            className="btn"
            disabled={!podeAnalisar}
            onClick={() =>
              onAnalisar({
                nomeCliente: localNome.trim(),
                whatsapp: localWhatsapp.trim(),
                marca: localMarca.trim() || "Marca sem nome",
                descricao: localDescricao.trim(),
              })
            }
          >
            Analisar viabilidade →
          </button>
        </div>
        <div className="helpbox">
          <h3>O que acontece nesta etapa</h3>
          <ol>
            <li>
              <b>Busca de anterioridade</b> — o nome é comparado foneticamente com marcas
              já depositadas, não só letra por letra.
            </li>
            <li>
              <b>Inferência de classe NCL</b> — a descrição é lida e mapeada para uma das
              45 classes de Nice, sem exigir que você saiba o número de cor.
            </li>
            <li>
              <b>Leitura da RPI</b> — a mesma fonte oficial alimenta o monitoramento
              semanal caso você contrate o acompanhamento.
            </li>
            <li>
              <b>Preço na tela, não em orçamento</b> — o valor do registro e do
              monitoramento aparece já no próximo passo, sem precisar falar com
              ninguém antes.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
