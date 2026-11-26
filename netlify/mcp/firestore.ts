// ---------------------------------------------------------------------------
// Acesso ao Firestore pela API REST, com o login do próprio usuário.
// As regras do Firestore (firestore.rules) continuam valendo: o conector só
// enxerga e grava o que o usuário logado poderia no app.
// ---------------------------------------------------------------------------
import { FIREBASE } from "./config.ts";
import { hash } from "./tokens.ts";

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents`;

export class ErroFirestore extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

// ---- Sessão Firebase (refresh token -> ID token) ----
export interface Sessao {
  idToken: string;
  uid: string;
  email: string;
}

const cacheSessao = new Map<string, { sessao: Sessao; expira: number }>();

const cabecalhoOrigem = (): Record<string, string> => {
  const site = process.env.URL; // definido pelo Netlify (endereço público do site)
  return site ? { Referer: site + "/" } : {};
};

const lerEmailDoJwt = (jwt: string): string => {
  try {
    const p = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return String(p.email || "");
  } catch {
    return "";
  }
};

export const abrirSessao = async (refreshToken: string): Promise<Sessao> => {
  const chave = hash(refreshToken);
  const c = cacheSessao.get(chave);
  if (c && c.expira > Date.now()) return c.sessao;

  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...cabecalhoOrigem() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.id_token) {
    throw new ErroFirestore(401, "Login do Firebase expirado ou revogado. Conecte o Claude novamente.");
  }
  const sessao: Sessao = { idToken: j.id_token, uid: j.user_id, email: lerEmailDoJwt(j.id_token) };
  // ID token vale 1 hora; renova com folga
  cacheSessao.set(chave, { sessao, expira: Date.now() + (Number(j.expires_in || 3600) - 300) * 1000 });
  return sessao;
};

// ---- Conversão de valores (JS <-> Firestore) ----
type Valor = Record<string, any>;

export const paraValor = (v: any): Valor => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    if (!isFinite(v)) return { nullValue: null };
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { stringValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValor) } };
  if (typeof v === "object") return { mapValue: { fields: paraCampos(v) } };
  return { stringValue: String(v) };
};

export const paraCampos = (obj: Record<string, any>): Record<string, Valor> => {
  const f: Record<string, Valor> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = paraValor(v);
  return f;
};

export const deValor = (v: Valor): any => {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(deValor);
  if ("mapValue" in v) return deCampos(v.mapValue.fields || {});
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("bytesValue" in v) return "[dados binários]";
  return null;
};

export const deCampos = (f: Record<string, Valor>): Record<string, any> => {
  const o: Record<string, any> = {};
  for (const [k, v] of Object.entries(f)) o[k] = deValor(v);
  return o;
};

const deDocumento = (d: any): Record<string, any> & { id: string } => ({ id: String(d.name).split("/").pop()!, ...deCampos(d.fields || {}) });

// ---- Chamadas ----
const idValido = (s: string) => /^[A-Za-z0-9_\-]{1,200}$/.test(s);

const chamar = async (s: Sessao, url: string, init: RequestInit = {}) => {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${s.idToken}`, "Content-Type": "application/json", ...cabecalhoOrigem() },
  });
  if (r.status === 404) return null;
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || r.statusText;
    if (r.status === 403) throw new ErroFirestore(403, "Sem permissão no Firestore para esta operação.");
    throw new ErroFirestore(r.status, `Erro do Firestore (${r.status}): ${msg}`);
  }
  return j;
};

export const db = {
  get: async (s: Sessao, colecao: string, id: string) => {
    if (!idValido(id)) throw new ErroFirestore(400, "ID inválido.");
    const j = await chamar(s, `${BASE}/${colecao}/${id}`);
    return j ? deDocumento(j) : null;
  },

  // Mesma ordem do app: mais recentes primeiro (documentos sem createdAt ficam de fora, como no app)
  listar: async (s: Sessao, colecao: string, limite = 500) => {
    const j = await chamar(s, `${BASE}:runQuery`, {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: colecao }],
          orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
          limit: limite,
        },
      }),
    });
    return ((j as any[]) || []).filter(x => x.document).map(x => deDocumento(x.document));
  },

  criar: async (s: Sessao, colecao: string, dados: Record<string, any>) => {
    const j = await chamar(s, `${BASE}/${colecao}`, { method: "POST", body: JSON.stringify({ fields: paraCampos(dados) }) });
    return deDocumento(j);
  },

  // Grava/substitui um documento com ID definido (como appDb.set)
  definir: async (s: Sessao, colecao: string, id: string, dados: Record<string, any>) => {
    if (!idValido(id)) throw new ErroFirestore(400, "ID inválido.");
    const j = await chamar(s, `${BASE}/${colecao}/${id}`, { method: "PATCH", body: JSON.stringify({ fields: paraCampos(dados) }) });
    return deDocumento(j);
  },

  // Atualiza só os campos informados (como appDb.update); falha se o documento não existir
  atualizar: async (s: Sessao, colecao: string, id: string, campos: Record<string, any>) => {
    if (!idValido(id)) throw new ErroFirestore(400, "ID inválido.");
    const nomes = Object.keys(campos);
    for (const n of nomes) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) throw new ErroFirestore(400, `Nome de campo inválido: ${n}`);
    const q = new URLSearchParams();
    nomes.forEach(n => q.append("updateMask.fieldPaths", n));
    q.append("currentDocument.exists", "true");
    const j = await chamar(s, `${BASE}/${colecao}/${id}?${q}`, { method: "PATCH", body: JSON.stringify({ fields: paraCampos(campos) }) });
    if (!j) throw new ErroFirestore(404, "Registro não encontrado.");
    return deDocumento(j);
  },

  apagar: async (s: Sessao, colecao: string, id: string) => {
    if (!idValido(id)) throw new ErroFirestore(400, "ID inválido.");
    await chamar(s, `${BASE}/${colecao}/${id}`, { method: "DELETE" });
  },
};

// ---- Permissão: só admin (e, se configurado, só os e-mails da lista) ----
const cacheCargo = new Map<string, { admin: boolean; expira: number }>();

export const ehAdmin = async (s: Sessao): Promise<boolean> => {
  const c = cacheCargo.get(s.uid);
  if (c && c.expira > Date.now()) return c.admin;
  const perfil = await db.get(s, "user_roles", s.uid).catch(() => null);
  const admin = perfil?.role === "admin";
  cacheCargo.set(s.uid, { admin, expira: Date.now() + 5 * 60 * 1000 });
  return admin;
};
