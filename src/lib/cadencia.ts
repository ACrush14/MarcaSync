/**
 * Com que frequência cada processo é monitorado.
 *
 *  - **Semanal** é o padrão: da contratação até você confirmar que está tudo certo com o protocolo.
 *    É a fase em que as coisas acontecem e têm prazo curto (exame formal, publicação, oposição).
 *  - **Mensal** vale depois que você marca "protocolo OK" no /admin: o pedido está parado na fila do
 *    INPI, e olhar uma vez por mês basta.
 *  - Se, no modo mensal, o INPI mudar a situação ou publicar um despacho, o processo **volta a ser
 *    semanal** sozinho, porque aí pode haver prazo correndo.
 *
 * Funções puras: quem lê e grava o banco são os módulos de monitoramento.
 */

export type ModoMonitoramento = "semanal" | "mensal";

/** Intervalo entre duas verificações. Um dia a menos que 7 e 30 para a rotina diária não "pular" a semana. */
export const INTERVALO_DIAS: Record<ModoMonitoramento, number> = { semanal: 6, mensal: 27 };

export const ROTULO_MODO: Record<ModoMonitoramento, string> = {
  semanal: "semanal",
  mensal: "mensal",
};

const DIA_MS = 86_400_000;

export interface EstadoDoMonitoramento {
  /** Desde quando está no modo mensal (null = semanal). */
  monitoramentoMensalDesde: Date | string | null;
}

export function modoDoMonitoramento(p: EstadoDoMonitoramento): ModoMonitoramento {
  return p.monitoramentoMensalDesde ? "mensal" : "semanal";
}

function comoData(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Já passou o intervalo do modo desde a última verificação? Nunca verificado = devido. */
export function estaDevido(
  modo: ModoMonitoramento,
  ultimaVerificacao: Date | string | null | undefined,
  agora: Date = new Date()
): boolean {
  const ultima = comoData(ultimaVerificacao);
  if (!ultima) return true;
  return agora.getTime() - ultima.getTime() >= INTERVALO_DIAS[modo] * DIA_MS;
}

/**
 * Pode passar para o modo mensal? Só depois de protocolado e com o número do INPI (é o número que
 * o monitoramento acompanha).
 */
export function podeIrParaMensal(p: {
  protocoladoEm: Date | string | null;
  numeroProcesso: string | null;
}): { ok: true } | { ok: false; motivo: string } {
  if (!p.numeroProcesso) {
    return { ok: false, motivo: "Preencha o número do processo no INPI antes." };
  }
  if (!p.protocoladoEm) {
    return { ok: false, motivo: "O pedido ainda não foi protocolado." };
  }
  return { ok: true };
}

/**
 * O texto que o cliente lê sobre a frequência, o mesmo em todo o site.
 */
export const TEXTO_CADENCIA =
  "Leitura semanal enquanto o pedido é protocolado e examinado; depois que está tudo certo, mensal";
