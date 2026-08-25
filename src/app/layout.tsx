import type { Metadata } from "next";
import "./globals.css";

// Carregadas via <link>, não next/font/google: next/font busca as fontes em
// tempo de build, o que quebra em builds offline/atrás de proxy corporativo
// (aconteceu neste próprio ambiente de desenvolvimento). Via <link>, o
// navegador busca em runtime — build nunca depende de rede externa.
export const metadata: Metadata = {
  title: "MarcaSync",
  description:
    "Protótipo funcional da plataforma de automação de registro de marcas no INPI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- regra mira o Pages Router; no App Router, <link> no layout raiz é o padrão correto. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
