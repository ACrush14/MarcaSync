import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    // src/generated/** é código gerado pelo `prisma generate` — não é nosso
    // pra lintar, e é regenerado do zero a cada `npx prisma generate`.
    ignores: [".next/**", "node_modules/**", "src/generated/**"],
  },
];
