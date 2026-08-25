"use client";

import { useState } from "react";

interface ConsultaStepProps {
  marca: string;
  descricao: string;
  onAnalisar: (marca: string, descricao: string) => void;
}

export default function ConsultaStep({ marca, descricao, onAnalisar }: ConsultaStepProps) {
  const [localMarca, setLocalMarca] = useState(marca);
  const [localDescricao, setLocalDescricao] = useState(descricao);

  return (
    <>
      <div className="panel-head">
        <h2>Nova consulta de viabilidade</h2>
        <p className="help">
          Informe a marca pretendida e descreva o produto ou serviço. O sistema cruza o
          nome com uma base de marcas por som (não apenas grafia) e infere a classe de
          Nice automaticamente a partir da descrição.
        </p>
      </div>
      <div className="grid-2">
        <div>
          <div className="field">
            <label htmlFor="in-marca">Nome da marca pretendida</label>
            <input
              type="text"
              id="in-marca"
              value={localMarca}
              onChange={(e) => setLocalMarca(e.target.value)}
              placeholder="Ex.: Doce Ponto"
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
            onClick={() =>
              onAnalisar(localMarca.trim() || "Marca sem nome", localDescricao.trim())
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
              <b>Leitura da RPI</b> — a mesma base usada aqui alimenta o monitoramento
              semanal caso você contrate o acompanhamento.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
