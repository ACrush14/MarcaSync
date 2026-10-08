function obterSessaoId(): string {
  try {
    const valor = localStorage.getItem("marcasync_sessao");
    if (valor) return valor;

    const novo = crypto.randomUUID();
    localStorage.setItem("marcasync_sessao", novo);
    return novo;
  } catch {
    return crypto.randomUUID();
  }
}

export function track(nome: string, dados?: Record<string, unknown>): void {
  //1) se não tiver no navegador, sair sem fazer nada
  if (typeof window === "undefined") return;

  const corpo = {
    sessaoId: obterSessaoId(),
    nome: nome,
    pagina: window.location.pathname,
    dados: dados,
  };

  fetch("/api/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    keepalive: true,
  }).catch(() => {});
}
