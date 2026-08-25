import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Reavaliado em 25/08/2026: a versão anterior carregava as fontes via <link>
// no <head> em vez de next/font/google porque o ambiente de build original
// bloqueava fonts.googleapis.com em tempo de build. Confirmado nesta sessão
// (rede local sem bloqueio, `curl fonts.googleapis.com` -> 200) que essa
// premissa não se aplica mais aqui — next/font volta a ser a opção certa:
// self-hosting automático dos arquivos de fonte (sem round-trip pro Google
// em runtime), sem FOUC, menos HTML manual. Se este projeto voltar a rodar
// atrás de um proxy que bloqueie fonts.googleapis.com, reverta para <link>
// — não assuma que esta decisão vale para todo ambiente.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-fraunces",
});
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

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
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
