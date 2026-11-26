// Conector do Claude (servidor MCP) publicado como Netlify Function.
// Lógica em netlify/mcp/. Guia de instalação em docs/CONECTOR-CLAUDE.md.
process.env.TZ = "America/Fortaleza"; // mesmo fuso de João Pessoa (datas do dia)

import { tratar } from "../mcp/servidor.ts";

export default async (req: Request) => tratar(req);

export const config = {
  path: [
    "/mcp",
    "/oauth/register",
    "/oauth/authorize",
    "/oauth/token",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/*",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/*",
    "/.well-known/openid-configuration",
  ],
};
