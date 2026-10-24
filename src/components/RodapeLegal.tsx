import Link from "next/link";
import { EMPRESA, linhaEmpresa } from "@/lib/empresa";
import { linkContatoWhatsapp } from "@/lib/whatsapp";

/**
 * Linha de rodapé com os links das páginas legais e os dados da empresa. Fica em um arquivo
 * próprio porque aparece na página inicial, no passo a passo da consulta e nas próprias
 * páginas legais.
 */
export default function RodapeLegal() {
  return (
    <p className="footer-note" style={{ marginTop: 16 }}>
      <Link href="/termos">Termos de uso</Link> ·{" "}
      <Link href="/privacidade">Política de privacidade</Link>
      {EMPRESA.emailContato && (
        <>
          {" "}
          · <a href={`mailto:${EMPRESA.emailContato}`}>{EMPRESA.emailContato}</a>
        </>
      )}
      {linkContatoWhatsapp && (
        <>
          {" "}
          ·{" "}
          <a href={linkContatoWhatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </>
      )}
      <br />
      {linhaEmpresa()}
    </p>
  );
}
