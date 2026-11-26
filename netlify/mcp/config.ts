// ---------------------------------------------------------------------------
// Conector do Claude (servidor MCP): configuração.
// Os valores públicos do Firebase são os mesmos do app (src/firebase.ts).
// Segredos vêm só de variáveis de ambiente do Netlify, nunca do repositório.
// ---------------------------------------------------------------------------
import { createHash, randomBytes } from "node:crypto";

export const FIREBASE = {
  apiKey: "AIzaSyBpApuPKd44R-cYeWulXfO31zicyEaEOkI",
  projectId: "gen-lang-client-0659252454",
  databaseId: "ai-studio-889f45a6-e68b-47c9-bb87-2fa91d25cdcd",
  sdkVersion: "12.15.0",
};

// Chave usada para cifrar os tokens entregues ao Claude.
// Se MCP_SECRET existir no Netlify, ela é usada. Senão, o conector gera uma chave
// aleatória na primeira vez e guarda no Netlify Blobs (loja "conector-claude").
// Apagar essa chave (ou trocar MCP_SECRET) desconecta o Claude na hora.
let chaveCarregada: Buffer | null = null;

const derivar = (s: string) => createHash("sha256").update(s).digest();

export const carregarChave = async (): Promise<void> => {
  if (chaveCarregada) return;
  const env = process.env.MCP_SECRET || "";
  if (env.length >= 32) {
    chaveCarregada = derivar(env);
    return;
  }
  const { getStore } = await import("@netlify/blobs");
  let s: string | null = null;
  try {
    const loja = getStore({ name: "conector-claude", consistency: "strong" });
    s = await loja.get("chave");
    if (!s) {
      await loja.set("chave", randomBytes(48).toString("base64url"));
      s = await loja.get("chave"); // relê a que ficou gravada
    }
  } catch (e) {
    console.error("[mcp] Netlify Blobs indisponível:", e);
  }
  if (!s || s.length < 32) throw new Error("Não foi possível obter a chave do conector.");
  chaveCarregada = derivar(s);
};

export const chaveSecreta = (): Buffer => {
  if (!chaveCarregada) throw new Error("Chave do conector não carregada.");
  return chaveCarregada;
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
