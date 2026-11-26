// ---------------------------------------------------------------------------
// Servidor do conector: OAuth 2.1 (login do Claude) + MCP via HTTP (sem estado).
//
// Rotas:
//   /.well-known/oauth-protected-resource[/mcp]   metadados do recurso
//   /.well-known/oauth-authorization-server       metadados do servidor de login
//   /oauth/register   registro do cliente (Claude)
//   /oauth/authorize  página de login/autorização
//   /oauth/token      troca de código e renovação
//   /mcp              protocolo MCP (JSON-RPC)
// ---------------------------------------------------------------------------
import { randomBytes } from "node:crypto";
import { DURACAO, ESCOPO, carregarChave, emailsPermitidos, redirecionamentoPermitido } from "./config.ts";
import { cifrar, decifrar, agora, s256, type DadosToken } from "./tokens.ts";
import { abrirSessao, ehAdmin, ErroFirestore, type Sessao } from "./firestore.ts";
import { FERRAMENTAS, ferramentaPorNome } from "./ferramentas.ts";
import { ErroValidacao } from "./colecoes.ts";
import { paginaLogin, paginaErro } from "./paginaLogin.ts";

const VERSOES = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

const json = (dados: any, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS, ...extra } });

const html = (corpo: string, status = 200) =>
  new Response(corpo, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });

const erroOAuth = (codigo: string, descricao: string, status = 400) => json({ error: codigo, error_description: descricao }, status);

const origemPublica = (req: Request) => (process.env.MCP_PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, "");

// ---------------------------------------------------------------- metadados
const metadadosRecurso = (base: string) => ({
  resource: `${base}/mcp`,
  authorization_servers: [base],
  scopes_supported: [ESCOPO],
  bearer_methods_supported: ["header"],
  resource_name: "Sea Rooftop · Command Center",
});

const metadadosServidor = (base: string) => ({
  issuer: base,
  authorization_endpoint: `${base}/oauth/authorize`,
  token_endpoint: `${base}/oauth/token`,
  registration_endpoint: `${base}/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: [ESCOPO],
});

// ---------------------------------------------------------------- registro (DCR)
const registrar = async (req: Request) => {
  const corpo: any = await req.json().catch(() => null);
  const uris: string[] = Array.isArray(corpo?.redirect_uris) ? corpo.redirect_uris : [];
  if (!uris.length || !uris.every(redirecionamentoPermitido)) {
    return erroOAuth("invalid_redirect_uri", "Endereço de retorno não permitido.");
  }
  return json({
    client_id: "claude-" + randomBytes(9).toString("base64url"),
    client_id_issued_at: agora(),
    client_name: String(corpo?.client_name || "Claude").slice(0, 80),
    redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, 201);
};

// ---------------------------------------------------------------- autorização
const autorizarGet = (req: Request) => {
  const p = new URL(req.url).searchParams;
  const redirectUri = p.get("redirect_uri") || "";
  if (!redirecionamentoPermitido(redirectUri)) return html(paginaErro("Endereço de retorno não permitido."), 400);
  if (p.get("response_type") !== "code") return html(paginaErro("Tipo de resposta não suportado."), 400);
  const desafio = p.get("code_challenge") || "";
  if (!desafio || (p.get("code_challenge_method") || "S256") !== "S256") return html(paginaErro("O pedido precisa usar PKCE (S256)."), 400);
  const pedido = cifrar({
    tipo: "pedido", uid: "", email: "", frt: "", exp: agora() + 15 * 60,
    redirectUri, clientId: p.get("client_id") || "", desafio, state: p.get("state") || "",
  });
  return html(paginaLogin(pedido, p.get("client_name") || ""));
};

const comParametros = (uri: string, params: Record<string, string>) => {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
};

const autorizarPost = async (req: Request) => {
  const corpo: any = await req.json().catch(() => ({}));
  const pedido = decifrar(String(corpo.pedido || ""), "pedido");
  if (!pedido) return json({ erro: "Pedido expirado. Volte ao Claude e tente conectar de novo." }, 400);
  if (corpo.negar) {
    return json({ redirecionar: comParametros(pedido.redirectUri!, { error: "access_denied", state: pedido.state || "" }) });
  }
  const frt = String(corpo.refreshToken || "");
  if (!frt) return json({ erro: "Sessão inválida. Entre novamente." }, 400);

  let sessao: Sessao;
  try {
    sessao = await abrirSessao(frt);
  } catch {
    return json({ erro: "Sessão inválida. Entre novamente." }, 401);
  }
  const negado = await motivoNegado(sessao);
  if (negado) return json({ erro: negado }, 403);

  const codigo = cifrar({
    tipo: "codigo", uid: sessao.uid, email: sessao.email, frt, exp: agora() + DURACAO.codigo,
    redirectUri: pedido.redirectUri, clientId: pedido.clientId, desafio: pedido.desafio,
  });
  console.log(`[mcp] autorização concedida para ${sessao.email}`);
  return json({ redirecionar: comParametros(pedido.redirectUri!, { code: codigo, state: pedido.state || "" }) });
};

const motivoNegado = async (s: Sessao): Promise<string | null> => {
  const lista = emailsPermitidos();
  if (lista.length && !lista.includes(s.email.toLowerCase())) return "Esta conta não está autorizada a conectar o Claude.";
  if (!(await ehAdmin(s))) return "Apenas administradores podem conectar o Claude.";
  return null;
};

// ---------------------------------------------------------------- token
const emitirTokens = (d: DadosToken) => ({
  access_token: cifrar({ tipo: "acesso", uid: d.uid, email: d.email, frt: d.frt, exp: agora() + DURACAO.acesso }),
  token_type: "Bearer",
  expires_in: DURACAO.acesso,
  refresh_token: cifrar({ tipo: "renovacao", uid: d.uid, email: d.email, frt: d.frt, exp: agora() + DURACAO.renovacao }),
  scope: ESCOPO,
});

const token = async (req: Request) => {
  const tipo = req.headers.get("content-type") || "";
  const p: Record<string, string> = tipo.includes("application/json")
    ? await req.json().catch(() => ({}))
    : Object.fromEntries(new URLSearchParams(await req.text()));

  if (p.grant_type === "authorization_code") {
    const c = decifrar(p.code || "", "codigo");
    if (!c) return erroOAuth("invalid_grant", "Código inválido ou expirado.");
    if (p.redirect_uri && p.redirect_uri !== c.redirectUri) return erroOAuth("invalid_grant", "Endereço de retorno diferente do pedido.");
    if (c.clientId && p.client_id && p.client_id !== c.clientId) return erroOAuth("invalid_grant", "Cliente diferente do pedido.");
    if (!p.code_verifier || s256(p.code_verifier) !== c.desafio) return erroOAuth("invalid_grant", "Verificação PKCE falhou.");
    return json(emitirTokens(c));
  }

  if (p.grant_type === "refresh_token") {
    const r = decifrar(p.refresh_token || "", "renovacao");
    if (!r) return erroOAuth("invalid_grant", "Token de renovação inválido ou expirado.");
    // confere se o login do Firebase e o cargo continuam válidos
    try {
      const s = await abrirSessao(r.frt);
      if (await motivoNegado(s)) return erroOAuth("invalid_grant", "Acesso revogado.");
    } catch {
      return erroOAuth("invalid_grant", "Login do Firebase expirado ou revogado.");
    }
    return json(emitirTokens(r));
  }

  return erroOAuth("unsupported_grant_type", "Tipo de concessão não suportado.");
};

// ---------------------------------------------------------------- MCP
const INSTRUCOES =
  "Conector do Command Center do Sea Rooftop (restaurante e rooftop em João Pessoa). " +
  "Use listar_colecoes para ver as coleções e campos, listar_registros para consultar e resumo_do_dia para o panorama do dia. " +
  "Datas no formato AAAA-MM-DD, horário de João Pessoa. Antes de apagar, confirme com o usuário. " +
  "Textos gravados no app devem ser profissionais, sem gíria.";

const naoAutorizado = (base: string, descricao = "Login necessário.") =>
  json({ error: "invalid_token", error_description: descricao }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="${ESCOPO}"`,
  });

const sessaoDoPedido = async (req: Request): Promise<Sessao | null> => {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const d = decifrar(m[1].trim(), "acesso");
  if (!d) return null;
  const s = await abrirSessao(d.frt);
  if (s.uid !== d.uid) return null;
  if (await motivoNegado(s)) return null;
  return s;
};

const respostaRpc = (id: any, result: any) => ({ jsonrpc: "2.0", id, result });
const erroRpc = (id: any, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const tratarMensagem = async (s: Sessao, m: any): Promise<any | null> => {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return erroRpc(m?.id, -32600, "Requisição inválida.");
  const ehNotificacao = m.id === undefined || m.id === null;
  if (ehNotificacao) return null;

  switch (m.method) {
    case "initialize": {
      const pedida = m.params?.protocolVersion;
      return respostaRpc(m.id, {
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "sea-rooftop-command-center", title: "Sea Rooftop · Command Center", version: "1.0.0" },
        instructions: INSTRUCOES,
      });
    }
    case "ping":
      return respostaRpc(m.id, {});
    case "tools/list":
      return respostaRpc(m.id, {
        tools: FERRAMENTAS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } })),
      });
    case "tools/call": {
      const f = ferramentaPorNome.get(m.params?.name);
      if (!f) return erroRpc(m.id, -32602, `Ferramenta desconhecida: ${m.params?.name}`);
      try {
        const r = await f.executar(s, m.params?.arguments || {});
        console.log(`[mcp] ${s.email} ${f.name} ok`);
        return respostaRpc(m.id, { content: [{ type: "text", text: JSON.stringify(r, null, 1) }] });
      } catch (e: any) {
        const msg = e instanceof ErroValidacao || e instanceof ErroFirestore ? e.message : "Erro inesperado: " + (e?.message || e);
        console.log(`[mcp] ${s.email} ${f.name} erro: ${msg}`);
        return respostaRpc(m.id, { content: [{ type: "text", text: msg }], isError: true });
      }
    }
    case "resources/list":
      return respostaRpc(m.id, { resources: [] });
    case "prompts/list":
      return respostaRpc(m.id, { prompts: [] });
    default:
      return erroRpc(m.id, -32601, `Método não suportado: ${m.method}`);
  }
};

const mcp = async (req: Request, base: string) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, { Allow: "POST" });
  let s: Sessao | null = null;
  try {
    s = await sessaoDoPedido(req);
  } catch (e: any) {
    return naoAutorizado(base, e?.message || "Login expirado.");
  }
  if (!s) return naoAutorizado(base);

  const corpo = await req.json().catch(() => undefined);
  if (corpo === undefined) return json(erroRpc(null, -32700, "JSON inválido."), 400);
  if (Array.isArray(corpo)) {
    const r = (await Promise.all(corpo.map(m => tratarMensagem(s!, m)))).filter(Boolean);
    return r.length ? json(r) : new Response(null, { status: 202, headers: CORS });
  }
  const r = await tratarMensagem(s, corpo);
  return r ? json(r) : new Response(null, { status: 202, headers: CORS });
};

// ---------------------------------------------------------------- roteador
export const tratar = async (req: Request): Promise<Response> => {
  const base = origemPublica(req);
  const caminho = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    if (caminho.startsWith("/.well-known/oauth-protected-resource")) return json(metadadosRecurso(base));
    if (caminho.startsWith("/.well-known/oauth-authorization-server") || caminho.startsWith("/.well-known/openid-configuration")) {
      return json(metadadosServidor(base));
    }
    await carregarChave();
    if (caminho === "/oauth/register" && req.method === "POST") return await registrar(req);
    if (caminho === "/oauth/authorize" && req.method === "GET") return autorizarGet(req);
    if (caminho === "/oauth/authorize" && req.method === "POST") return await autorizarPost(req);
    if (caminho === "/oauth/token" && req.method === "POST") return await token(req);
    if (caminho === "/mcp") return await mcp(req, base);
    return json({ error: "Não encontrado." }, 404);
  } catch (e: any) {
    console.error("[mcp] erro:", e);
    const configuracao = String(e?.message || "").includes("chave do conector");
    return json({ error: "server_error", error_description: configuracao ? e.message : "Erro interno." }, 500);
  }
};
