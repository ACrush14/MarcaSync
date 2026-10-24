/**
 * Freio simples para as rotas públicas que gravam dados ou chamam serviços de fora
 * (criar processo, enviar pedido, enviar imagem, buscar no INPI). Conta pedidos por IP numa
 * janela de tempo, na memória da instância.
 *
 * É um freio "de melhor esforço": na Vercel cada instância tem a sua memória, então um atacante
 * que cai em várias instâncias passa de vez em quando. Serve para barrar o abuso comum (um
 * script em laço, um formulário enviado mil vezes). Um limite compartilhado entre instâncias
 * exigiria uma tabela no banco ou um Redis; se o abuso aparecer, é o próximo passo.
 */
export interface Regra {
  /** Quantos pedidos cada IP pode fazer na janela. */
  max: number;
  /** Tamanho da janela, em milissegundos. */
  janelaMs: number;
}

export interface Decisao {
  permitido: boolean;
  /** Segundos até poder tentar de novo (só quando barrado). */
  tentarEmSegundos: number;
}

/** Máximo de chaves guardadas, para a memória não crescer sem limite. */
const MAX_CHAVES = 5_000;

const registros = new Map<string, number[]>();

export function verificarLimite(
  chave: string,
  regra: Regra,
  agora: number = Date.now()
): Decisao {
  const inicio = agora - regra.janelaMs;
  const recentes = (registros.get(chave) ?? []).filter((t) => t > inicio);

  if (recentes.length >= regra.max) {
    registros.set(chave, recentes);
    const maisAntigo = recentes[0] ?? agora;
    return {
      permitido: false,
      tentarEmSegundos: Math.max(1, Math.ceil((maisAntigo + regra.janelaMs - agora) / 1000)),
    };
  }

  recentes.push(agora);
  registros.delete(chave); // reinsere no fim: o Map mantém a ordem de inserção
  registros.set(chave, recentes);

  if (registros.size > MAX_CHAVES) {
    // Descarta as chaves menos recentes (as primeiras do Map).
    const sobra = registros.size - MAX_CHAVES;
    let i = 0;
    for (const k of registros.keys()) {
      if (i++ >= sobra) break;
      registros.delete(k);
    }
  }
  return { permitido: true, tentarEmSegundos: 0 };
}

/** Só para os testes. */
export function zerarLimites(): void {
  registros.clear();
}

/** Regras de cada rota pública. Valores pensados para uso humano com folga. */
export const REGRAS = {
  criarProcesso: { max: 12, janelaMs: 60_000 },
  enviarPedido: { max: 15, janelaMs: 60_000 },
  enviarImagem: { max: 10, janelaMs: 60_000 },
  buscar: { max: 30, janelaMs: 60_000 },
} as const satisfies Record<string, Regra>;

/**
 * Atalho para as rotas: devolve a resposta 429 pronta quando o IP passou do limite, ou null
 * quando pode seguir. `rota` separa os contadores (um IP pode usar cada rota dentro do seu limite).
 */
export function barrarSeExceder(
  request: Request,
  rota: keyof typeof REGRAS
): Response | null {
  const lista = request.headers.get("x-forwarded-for");
  const ip = lista?.split(",")[0]?.trim() || "local";
  const decisao = verificarLimite(`${rota}:${ip}`, REGRAS[rota]);
  if (decisao.permitido) return null;
  return Response.json(
    { error: "Muitos pedidos em pouco tempo. Aguarde um instante e tente de novo." },
    { status: 429, headers: { "Retry-After": String(decisao.tentarEmSegundos) } }
  );
}
