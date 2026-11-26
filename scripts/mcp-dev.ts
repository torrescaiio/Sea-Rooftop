// Servidor local para testar o conector sem publicar: npx tsx scripts/mcp-dev.ts
// Precisa de MCP_SECRET no ambiente. Porta padrão 8788.
process.env.TZ = "America/Fortaleza";
import { createServer } from "node:http";
import { tratar } from "../netlify/mcp/servidor.ts";

const porta = Number(process.env.PORT || 8788);

createServer(async (req, res) => {
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${porta}`;
    const url = `http://${host}${req.url}`;
    const partes: Buffer[] = [];
    for await (const p of req) partes.push(p as Buffer);
    const corpo = partes.length ? Buffer.concat(partes) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const r = await tratar(new Request(url, { method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : corpo }));
    res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
    res.end(Buffer.from(await r.arrayBuffer()));
    console.log(req.method, req.url?.split("?")[0], r.status);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end("erro");
  }
}).listen(porta, () => console.log(`Conector local em http://localhost:${porta}/mcp`));
