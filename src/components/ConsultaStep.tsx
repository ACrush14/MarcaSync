"use client";

import { useState } from "react";
import { track } from "@/lib/track";

interface ConsultaStepProps {
  marca: string;
  descricao: string;
  onAnalisar: (dados: { marca: string; descricao: string }) => void;
}

export default function ConsultaStep({ marca, descricao, onAnalisar }: ConsultaStepProps) {
  const [localMarca, setLocalMarca] = useState(marca);
  const [localDescricao, setLocalDescricao] = useState(descricao);

  const podeAnalisar = localMarca.trim().length > 0;

  return (
    <>
      <div className="panel-head">
        <h2>Veja se a sua marca pode ser registrada</h2>
        <p className="help">
          Em segundos você descobre se ela corre risco de colidir com uma já registrada, direto na
          base real do INPI. Não precisa de cadastro: é só dizer o nome e o que você vende.
        </p>
      </div>
      <div className="grid-2">
        <div>
          <div className="field">
            <label htmlFor="in-marca">Nome da marca pretendida</label>
            <input
              type="text"
              id="in-marca"
              autoComplete="off"
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
            onClick={() => {
              track("consulta_enviada");
              onAnalisar({
                marca: localMarca.trim(),
                descricao: localDescricao.trim(),
              });
            }}
          >
            Ver o resultado →
          </button>
        </div>
        <div className="helpbox">
          <h3>O que acontece nesta etapa</h3>
          <ol>
            <li>
              <b>Busca de anterioridade</b> — o nome é comparado foneticamente com marcas já
              depositadas, não só letra por letra.
            </li>
            <li>
              <b>Inferência de classe NCL</b> — a classe de Nice mais provável (hoje cobrimos as 11
              mais comuns)
            </li>
            <li>
              <b>Leitura da RPI</b> — a mesma fonte oficial alimenta o monitoramento semanal caso
              você contrate o acompanhamento.
            </li>
            <li>
              <b>Preço na tela, não em orçamento</b> — depois do resultado você vê o valor do
              registro e do monitoramento, sem precisar falar com ninguém antes.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
