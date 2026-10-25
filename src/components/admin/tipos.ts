import type { Prontidao } from "@/lib/prontidao";
import type { PrazoAdmin } from "@/components/ProtocoloAdmin";

/** Os formatos dos dados que `GET /api/processos` devolve para o /admin. */

export interface Pagamento {
  id: string;
  tipo: string;
  valorCentavos: number;
  devolvidoCentavos?: number;
  status: string;
  confirmadoEm: string | null;
  confirmadoVia: string | null;
  createdAt?: string;
}

export interface PedidoRegistro {
  tipoRequerente: string;
  regime: string;
  participaEmpresaDoRamo: boolean;
  nome: string;
  documento: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  apresentacao: string;
  elementoNominativo: string | null;
  classeNice: string;
  especificacao: string;
  especificacaoItens: string[];
  especificacaoLivre: boolean;
  palavraEstrangeira: boolean;
  traducao: string | null;
  cienteAnterioridade: boolean;
  atividade: string;
  servicoCentavos: number;
  gruCentavos: number;
  gruComDesconto: boolean;
  aceitoEm: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SituacaoInpi {
  id: string;
  situacao: string;
  origem: string;
  vistaEm: string;
}

export interface AvisoDoProcesso {
  id: string;
  destino: string;
  canal: string;
  assunto: string;
  enviadaEm: string | null;
  erro: string | null;
  createdAt: string;
}

export interface Processo {
  id: string;
  marca: string;
  descricao?: string;
  status: string;
  riscoPct: number | null;
  riscoFonte?: string | null;
  nclCode: string | null;
  nclLabel?: string | null;
  monitoramento: boolean;
  protocolo: string | null;
  numeroProcesso: string | null;
  situacaoInpi?: string | null;
  situacaoVerificadaEm?: string | null;
  monitoramentoMensalDesde?: string | null;
  rpiVerificadaEm?: string | null;
  gruPagaInpiEm?: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  interesse: string;
  proximoContatoEm: string | null;
  ultimoContatoEm: string | null;
  anotacoes: string | null;
  cliente: { nome: string; whatsapp: string; email?: string | null; createdAt?: string };
  pagamentos: Pagamento[];
  pedidoRegistro: PedidoRegistro | null;
  protocoladoEm: string | null;
  prazos: PrazoAdmin[];
  reciboProtocolo: { nomeArquivo: string; tamanho: number } | null;
  imagemMarca: { largura: number; altura: number; ampliada: boolean } | null;
  prontidao: Prontidao | null;
  /** Últimas situações vistas no INPI (mais recente primeiro). */
  situacoes?: SituacaoInpi[];
  /** Últimos avisos do sistema sobre este processo (mais recente primeiro). */
  avisos?: AvisoDoProcesso[];
  _count?: { alertas: number };
}
