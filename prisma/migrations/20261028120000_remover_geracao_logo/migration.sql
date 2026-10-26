-- A criação de logo por IA foi descartada (a chave do Gemini não gera imagem): a tabela, que nunca
-- teve uso em produção, sai. A migration anterior (geracao_logo_ia) fica no histórico.
-- DropForeignKey
ALTER TABLE "GeracaoLogo" DROP CONSTRAINT "GeracaoLogo_processoId_fkey";

-- DropTable
DROP TABLE "GeracaoLogo";
