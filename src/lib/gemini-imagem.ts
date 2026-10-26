/**
 * Chamada ao Gemini para criar UMA imagem (a API de interações, que é a que a documentação do
 * Google usa para os modelos de imagem). A chave (GEMINI_API_KEY) vai só no cabeçalho
 * `x-goog-api-key` e nunca aparece em mensagem de erro nem em log.
 */
import { extrairImagem, type ImagemGerada } from "./logo-ia";

const ENDERECO = "https://generativelanguage.googleapis.com/v1beta/interactions";

/** Modelo padrão; troque com GEMINI_IMAGE_MODEL se o Google mudar o nome ou se quiser outro. */
export const MODELO_PADRAO = "gemini-nano-banana-2.1";

export type ResultadoGemini =
  | ({ ok: true } & ImagemGerada)
  | {
      ok: false;
      /** Para a rota escolher a mensagem: nunca é o texto cru do Google. */
      motivo: "sem-chave" | "recusou" | "limite" | "sem-imagem" | "erro" | "demorou";
    };

export async function gerarImagemGemini(opcoes: {
  prompt: string;
  apiKey: string | undefined;
  modelo?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ResultadoGemini> {
  const { prompt, apiKey, modelo = MODELO_PADRAO, fetchImpl = fetch, timeoutMs = 60_000 } = opcoes;
  if (!apiKey) return { ok: false, motivo: "sem-chave" };

  let resposta: Response;
  try {
    resposta = await fetchImpl(ENDERECO, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ model: modelo, input: [{ type: "text", text: prompt }] }),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const demorou = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, motivo: demorou ? "demorou" : "erro" };
  }

  if (resposta.status === 429) return { ok: false, motivo: "limite" };
  if (!resposta.ok) {
    // 400 costuma ser a política de segurança do modelo recusando o pedido; o resto é erro nosso ou do Google.
    return { ok: false, motivo: resposta.status === 400 ? "recusou" : "erro" };
  }

  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    return { ok: false, motivo: "erro" };
  }
  const imagem = extrairImagem(corpo);
  if (!imagem) return { ok: false, motivo: "sem-imagem" };
  return { ok: true, ...imagem };
}
