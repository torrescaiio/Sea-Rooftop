// Página de autorização mostrada quando o Claude pede acesso.
// O login acontece no navegador com o Firebase (a senha não passa pelo servidor do conector).
import { FIREBASE } from "./config.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const paginaLogin = (pedido: string, cliente: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Conectar o Claude · Sea Rooftop</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #e2e8f0; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 16px; }
  .card { width: 100%; max-width: 400px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #94a3b8; margin: 0 0 20px; font-size: 14px; }
  label { display: block; font-size: 13px; color: #94a3b8; margin: 12px 0 4px; }
  input { width: 100%; padding: 11px 12px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 15px; }
  button { width: 100%; padding: 12px; border: 0; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px; }
  .prim { background: #0ea5e9; color: #fff; }
  .sec { background: transparent; color: #94a3b8; border: 1px solid #475569; margin-top: 10px; }
  button:disabled { opacity: .6; cursor: default; }
  .lista { background: #0f172a; border-radius: 10px; padding: 12px 14px; font-size: 14px; color: #cbd5e1; margin: 0; }
  .lista li { margin: 4px 0 4px 16px; }
  .erro { color: #fca5a5; font-size: 14px; margin-top: 12px; min-height: 1em; }
  .quem { font-weight: 600; color: #fff; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main class="card">
  <h1>Conectar o Claude</h1>
  <p class="sub">Sea Rooftop · Command Center${cliente ? ` · ${esc(cliente)}` : ""}</p>

  <div id="carregando">Carregando…</div>

  <form id="login" hidden>
    <p class="sub" style="margin:0">Entre com a sua conta do Command Center. Apenas administradores podem conectar o Claude.</p>
    <label for="email">E-mail</label>
    <input id="email" type="email" autocomplete="username" required>
    <label for="senha">Senha</label>
    <input id="senha" type="password" autocomplete="current-password" required>
    <button class="prim" type="submit">Entrar</button>
  </form>

  <div id="autorizar" hidden>
    <p>Conectado como <span class="quem" id="quem"></span>.</p>
    <p class="sub" style="margin:0 0 8px">Ao autorizar, o Claude poderá, em seu nome:</p>
    <ul class="lista">
      <li>consultar equipe, eventos, diárias, reembolsos, rotina, cotações e agenda;</li>
      <li>criar, alterar e apagar registros nesses módulos.</li>
    </ul>
    <button class="prim" id="btnAutorizar">Autorizar</button>
    <button class="sec" id="btnTrocar">Usar outra conta</button>
    <button class="sec" id="btnCancelar">Cancelar</button>
  </div>

  <p class="erro" id="erro"></p>
</main>
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/${FIREBASE.sdkVersion}/firebase-app.js";
  import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/${FIREBASE.sdkVersion}/firebase-auth.js";

  const PEDIDO = ${JSON.stringify(pedido)};
  const app = initializeApp({ apiKey: ${JSON.stringify(FIREBASE.apiKey)}, authDomain: "${FIREBASE.projectId}.firebaseapp.com", projectId: "${FIREBASE.projectId}" });
  const auth = getAuth(app);
  const $ = id => document.getElementById(id);
  const erro = t => { $("erro").textContent = t || ""; };
  const mostrar = id => ["carregando", "login", "autorizar"].forEach(x => $(x).hidden = x !== id);

  onAuthStateChanged(auth, u => {
    if (u) { $("quem").textContent = u.email; mostrar("autorizar"); }
    else mostrar("login");
  });

  $("login").addEventListener("submit", async e => {
    e.preventDefault(); erro("");
    const b = e.submitter; b.disabled = true;
    try { await signInWithEmailAndPassword(auth, $("email").value.trim(), $("senha").value); }
    catch (err) { erro("E-mail ou senha incorretos."); }
    finally { b.disabled = false; $("senha").value = ""; }
  });

  $("btnTrocar").onclick = () => signOut(auth);

  const enviar = async corpo => {
    const r = await fetch(location.pathname, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedido: PEDIDO, ...corpo }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.redirecionar) throw new Error(j.erro || "Não foi possível concluir a autorização.");
    location.href = j.redirecionar;
  };

  $("btnCancelar").onclick = () => enviar({ negar: true }).catch(e => erro(e.message));

  $("btnAutorizar").onclick = async () => {
    erro(""); $("btnAutorizar").disabled = true;
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Sessão encerrada. Entre novamente.");
      await u.getIdToken(true);
      await enviar({ refreshToken: u.refreshToken });
    } catch (e) { erro(e.message); $("btnAutorizar").disabled = false; }
  };
</script>
</body>
</html>`;

export const paginaErro = (msg: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conector do Claude</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:15px/1.5 system-ui,sans-serif;padding:16px}.c{max-width:400px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px}</style></head>
<body><div class="c"><h1 style="font-size:20px;margin:0 0 8px">Não foi possível continuar</h1><p>${esc(msg)}</p></div></body></html>`;
