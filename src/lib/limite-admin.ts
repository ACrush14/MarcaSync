import { prisma } from "@/lib/db";

//quantas vezes pode tentar antes do bloqueio
export const MAX_FALHAS = 5;

//conta para 15 minutos, 15 minutos * 60 segundos * 1000 milésimos
export const JANELA_SENHA_COOLDOWN = 15 * 60 * 1000;

//descobre o IP a de que quem fez o pedido
//o cabeçalho `x-forwarded-for` traz o IP real do visitante
//e a propria vercel reescreve, então o visitante não consegue forjar

export function ipDoPedido(request: Request): string {
  const lista = request.headers.get("x-forwarded-for");
  //se não tem lista retorna local? Como assim retorna local?
  if (!lista) return "local";
  //Lista vai ser separada com uma virgula
  return lista.split(",")[0]?.trim() || "local";

  // Se IP não existe na tabela, adiciona na tabela com um contador de 15 minutos
  // Se IP já existe na tabela, o contador continua de onde estiver
}

//Se o IP já está na tabela, e tentar o admin, sobe um contador.
//Se já passou do limite, retorna 429

//o instante começa de agora menos 15 minutos, é o inicioJanela
//new date transforma em algo que o banco entende
//pergunta ao banco quantas linhas da tabela tem esse IP e foram criadas a
//partir do começo da janela. gte é Maior ou Igual
//se o numero for de 5 ou mais falhas, devolve true, por isso <boolean>
export async function estaBloqueado(ip: string): Promise<boolean> {
  const inicioJanela = new Date(Date.now() - JANELA_SENHA_COOLDOWN);
  const falhas = await prisma.tentativaAdmin.count({
    where: { ip, createdAt: { gte: inicioJanela } },
  });
  return falhas >= MAX_FALHAS;
}

//Anota uma senha errada deste IP, inserindo uma linha na tabela
//cria a linha com o IP

export async function registrarFalha(ip: string): Promise<void> {
  await prisma.tentativaAdmin.create({ data: { ip } });
}
