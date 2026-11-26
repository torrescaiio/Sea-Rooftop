// ---------------------------------------------------------------------------
// Tokens do conector: JSON cifrado com AES-256-GCM (chave = MCP_SECRET).
// Não há banco de sessões: o próprio token carrega os dados, cifrados e com validade.
// ---------------------------------------------------------------------------
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chaveSecreta } from "./config.ts";

export type TipoToken = "pedido" | "codigo" | "acesso" | "renovacao";

export interface DadosToken {
  tipo: TipoToken;
  uid: string;
  email: string;
  frt: string;          // refresh token do Firebase do usuário
  exp: number;          // validade (segundos desde 1970)
  // só no código de autorização
  redirectUri?: string;
  clientId?: string;
  desafio?: string;     // PKCE code_challenge (S256)
  state?: string;       // só no pedido de autorização
}

const b64url = (b: Buffer) => b.toString("base64url");

export const cifrar = (dados: DadosToken): string => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveSecreta(), iv);
  const corpo = Buffer.concat([c.update(JSON.stringify(dados), "utf8"), c.final()]);
  return b64url(Buffer.concat([iv, c.getAuthTag(), corpo]));
};

export const decifrar = (token: string, tipo: TipoToken): DadosToken | null => {
  try {
    const bruto = Buffer.from(token, "base64url");
    if (bruto.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", chaveSecreta(), bruto.subarray(0, 12));
    d.setAuthTag(bruto.subarray(12, 28));
    const json = Buffer.concat([d.update(bruto.subarray(28)), d.final()]).toString("utf8");
    const dados = JSON.parse(json) as DadosToken;
    if (dados.tipo !== tipo) return null;
    if (!dados.exp || dados.exp < Math.floor(Date.now() / 1000)) return null;
    return dados;
  } catch {
    return null;
  }
};

export const agora = () => Math.floor(Date.now() / 1000);

export const s256 = (verificador: string) => createHash("sha256").update(verificador).digest("base64url");

export const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
