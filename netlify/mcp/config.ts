// ---------------------------------------------------------------------------
// Conector do Claude (servidor MCP): configuração.
// Os valores públicos do Firebase são os mesmos do app (src/firebase.ts).
// Segredos vêm só de variáveis de ambiente do Netlify, nunca do repositório.
// ---------------------------------------------------------------------------
import { createHash } from "node:crypto";

export const FIREBASE = {
  apiKey: "AIzaSyBpApuPKd44R-cYeWulXfO31zicyEaEOkI",
  projectId: "gen-lang-client-0659252454",
  databaseId: "ai-studio-889f45a6-e68b-47c9-bb87-2fa91d25cdcd",
  sdkVersion: "12.15.0",
};

// Chave usada para cifrar os tokens entregues ao Claude. Trocar este valor no
// Netlify desconecta o Claude na hora (é o "botão de pânico").
export const chaveSecreta = (): Buffer => {
  const s = process.env.MCP_SECRET || "";
  if (s.length < 32) {
    throw new Error("MCP_SECRET não configurado (mínimo de 32 caracteres).");
  }
  return createHash("sha256").update(s).digest();
};

// E-mails autorizados (separados por vírgula). Vazio = qualquer usuário com cargo admin.
export const emailsPermitidos = (): string[] =>
  (process.env.MCP_ALLOWED_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

// Endereços de retorno aceitos no login (apenas o Claude e testes locais).
export const redirecionamentoPermitido = (uri: string): boolean => {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:" && (u.host === "claude.ai" || u.host === "claude.com") && u.pathname === "/api/mcp/auth_callback") {
      return true;
    }
    // Claude Code e ferramentas locais usam um endereço no próprio computador
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
};

export const DURACAO = {
  codigo: 5 * 60,             // código de autorização: 5 minutos
  acesso: 24 * 60 * 60,       // token de acesso: 24 horas
  renovacao: 90 * 24 * 60 * 60, // token de renovação: 90 dias
};

export const ESCOPO = "command-center";
