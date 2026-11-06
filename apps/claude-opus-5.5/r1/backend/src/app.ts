import express, { type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { DUMMY_HASH, hashPassword, hashToken, newSessionToken, verifyPassword } from "./auth.js";
import {
  alterarStatus, buscarPedido, criarPedido, isStatus, listarPedidos, ValidacaoError, resolverItens,
} from "./pedidos.js";
import {
  entregaDaConta, lerDadosPessoais, lerEndereco, salvarDadosPessoais, salvarEndereco, validarDadosPessoais, validarEndereco,
} from "./conta.js";
import {
  atualizarProduto, buscarProduto, criarProduto, lerFiltros, listarProdutos, opcoesFiltro, validarProduto,
} from "./produtos.js";

export const SESSION_COOKIE = "vestebem_sessao";
const SESSION_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Perfil = "cliente" | "funcionario";
interface UsuarioPublico { id: number; nome: string; email: string; perfil: Perfil }
interface UsuarioRow extends UsuarioPublico { senha_hash: string }

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignora */ }
    }
  }
  return out;
}

function str(body: unknown, key: string): string {
  const v = (body as Record<string, unknown> | undefined)?.[key];
  return typeof v === "string" ? v : "";
}

export function createApp(db: DatabaseSync, opts: { staticDir?: string; secureCookies?: boolean } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  function createSession(res: Response, usuarioId: number) {
    const token = newSessionToken();
    const expira = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
    db.prepare("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)")
      .run(hashToken(token), usuarioId, expira);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "strict", secure: opts.secureCookies ?? false,
      path: "/", maxAge: SESSION_DAYS * 86_400_000,
    });
  }

  function currentUser(req: Request): UsuarioPublico | null {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) return null;
    const row = db.prepare(
      `SELECT u.id, u.nome, u.email, u.perfil FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expira_em > ?`,
    ).get(hashToken(token), new Date().toISOString()) as UsuarioPublico | undefined;
    return row ? { id: row.id, nome: row.nome, email: row.email, perfil: row.perfil } : null;
  }

  // Proteção simples contra CSRF (além do cookie SameSite=Strict): mutações exigem JSON.
  app.use("/api", (req, _res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD" && !req.is("application/json")) {
      return next(new HttpError(415, "Envie os dados em formato JSON."));
    }
    next();
  });

  app.post("/api/cadastro", async (req, res) => {
    const nome = str(req.body, "nome").trim();
    const email = str(req.body, "email").trim().toLowerCase();
    const senha = str(req.body, "senha");
    const campos: Record<string, string> = {};
    if (!nome) campos.nome = "Informe seu nome.";
    else if (nome.length > 100) campos.nome = "O nome deve ter no máximo 100 caracteres.";
    if (!EMAIL_RE.test(email) || email.length > 254) campos.email = "Informe um e-mail válido.";
    if (senha.length < 8) campos.senha = "A senha deve ter pelo menos 8 caracteres.";
    else if (senha.length > 128) campos.senha = "A senha deve ter no máximo 128 caracteres.";
    if (Object.keys(campos).length) {
      res.status(400).json({ erro: "Verifique os dados informados.", campos });
      return;
    }
    const senhaHash = await hashPassword(senha);
    let id: number;
    try {
      // O perfil nunca vem do cliente: o cadastro público sempre cria 'cliente'.
      const r = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, 'cliente')")
        .run(nome, email, senhaHash);
      id = Number(r.lastInsertRowid);
    } catch (e) {
      if (String((e as Error).message).includes("UNIQUE")) {
        res.status(409).json({ erro: "Já existe uma conta com este e-mail.", campos: { email: "E-mail já cadastrado." } });
        return;
      }
      throw e;
    }
    createSession(res, id);
    res.status(201).json({ usuario: { id, nome, email, perfil: "cliente" } });
  });

  app.post("/api/login", async (req, res) => {
    const email = str(req.body, "email").trim().toLowerCase();
    const senha = str(req.body, "senha");
    const row = db.prepare("SELECT id, nome, email, perfil, senha_hash FROM usuarios WHERE email = ?")
      .get(email) as UsuarioRow | undefined;
    const ok = await verifyPassword(senha, row?.senha_hash ?? (await DUMMY_HASH));
    if (!row || !ok) {
      res.status(401).json({ erro: "E-mail ou senha incorretos." });
      return;
    }
    createSession(res, row.id);
    res.json({ usuario: { id: row.id, nome: row.nome, email: row.email, perfil: row.perfil } });
  });

  app.post("/api/logout", (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) db.prepare("DELETE FROM sessoes WHERE token_hash = ?").run(hashToken(token));
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.status(204).end();
  });

  app.get("/api/minha-conta", (req, res) => {
    res.set("Cache-Control", "no-store");
    const usuario = currentUser(req);
    if (!usuario) {
      res.status(401).json({ erro: "Você precisa entrar para acessar esta página." });
      return;
    }
    // Dados completos (inclui CPF) somente para o próprio usuário.
    res.json({ usuario: { ...usuario, ...lerDadosPessoais(db, usuario.id) }, endereco: lerEndereco(db, usuario.id) });
  });

  // ---------- Pedidos ----------
  // Exige sessão válida; opcionalmente restringe a um perfil.
  const autenticado = (perfil?: Perfil) => (req: Request, res: Response, next: NextFunction) => {
    const u = currentUser(req);
    if (!u) { res.status(401).json({ erro: "Você precisa entrar para continuar." }); return; }
    if (perfil && u.perfil !== perfil) { res.status(403).json({ erro: "Você não tem permissão para esta ação." }); return; }
    res.locals.usuario = u;
    next();
  };
  const usuarioDe = (res: Response) => res.locals.usuario as UsuarioPublico;
  const idDe = (req: Request) => { const n = Number(req.params.id); return Number.isSafeInteger(n) && n > 0 ? n : null; };

  // ---------- Produtos ----------
  // Consultas são públicas e somente leitura; cadastro/atualização exigem funcionário.
  const responderValidacao = (res: Response, e: unknown) => {
    if (e instanceof ValidacaoError) { res.status(400).json({ erro: e.message, campos: e.campos }); return true; }
    return false;
  };

  app.get("/api/produtos", (req, res) => {
    try {
      res.json(listarProdutos(db, lerFiltros(req.query as Record<string, unknown>)));
    } catch (e) { if (!responderValidacao(res, e)) throw e; }
  });

  app.get("/api/produtos/filtros", (_req, res) => { res.json(opcoesFiltro(db)); });

  app.get("/api/produtos/:id", (req, res) => {
    const id = idDe(req);
    const produto = id ? buscarProduto(db, id) : null;
    if (!produto) { res.status(404).json({ erro: "Produto não encontrado." }); return; }
    res.json({ produto });
  });

  app.post("/api/produtos", autenticado("funcionario"), (req, res) => {
    try {
      const id = criarProduto(db, validarProduto(req.body));
      res.status(201).json({ produto: buscarProduto(db, id) });
    } catch (e) { if (!responderValidacao(res, e)) throw e; }
  });

  app.put("/api/produtos/:id", autenticado("funcionario"), (req, res) => {
    try {
      const id = idDe(req);
      const dados = validarProduto(req.body);
      if (!id || !atualizarProduto(db, id, dados)) { res.status(404).json({ erro: "Produto não encontrado." }); return; }
      res.json({ produto: buscarProduto(db, id) });
    } catch (e) { if (!responderValidacao(res, e)) throw e; }
  });

  // ---------- Minha conta: dados pessoais, endereço e senha ----------
  // Rotas sem id: sempre operam sobre o usuário da sessão, impossibilitando alterar dados de outra conta.
  app.put("/api/minha-conta/dados", autenticado(), (req, res) => {
    try {
      const u = usuarioDe(res);
      salvarDadosPessoais(db, u.id, validarDadosPessoais(req.body));
      res.set("Cache-Control", "no-store").json({ usuario: { id: u.id, email: u.email, perfil: u.perfil, ...lerDadosPessoais(db, u.id) } });
    } catch (e) { if (!responderValidacao(res, e)) throw e; }
  });

  app.put("/api/minha-conta/endereco", autenticado("cliente"), (req, res) => {
    try {
      const u = usuarioDe(res);
      salvarEndereco(db, u.id, validarEndereco(req.body));
      res.set("Cache-Control", "no-store").json({ endereco: lerEndereco(db, u.id) });
    } catch (e) { if (!responderValidacao(res, e)) throw e; }
  });

  app.put("/api/minha-conta/senha", autenticado(), async (req, res) => {
    const u = usuarioDe(res);
    const senhaAtual = str(req.body, "senhaAtual");
    const novaSenha = str(req.body, "novaSenha");
    const row = db.prepare("SELECT senha_hash FROM usuarios WHERE id = ?").get(u.id) as { senha_hash: string };
    if (!(await verifyPassword(senhaAtual, row.senha_hash))) {
      res.status(400).json({ erro: "A senha atual está incorreta.", campos: { senhaAtual: "Senha atual incorreta." } });
      return;
    }
    if (novaSenha.length < 8 || novaSenha.length > 128) {
      res.status(400).json({ erro: "Verifique a nova senha.", campos: { novaSenha: "A nova senha deve ter entre 8 e 128 caracteres." } });
      return;
    }
    if (novaSenha === senhaAtual) {
      res.status(400).json({ erro: "Verifique a nova senha.", campos: { novaSenha: "A nova senha deve ser diferente da atual." } });
      return;
    }
    db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(await hashPassword(novaSenha), u.id);
    // Encerra as demais sessões da conta; a sessão atual continua ativa.
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? "";
    db.prepare("DELETE FROM sessoes WHERE usuario_id = ? AND token_hash <> ?").run(u.id, hashToken(token));
    res.status(204).end();
  });

  app.use("/api/pedidos", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  app.post("/api/pedidos", autenticado("cliente"), (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const itens = resolverItens(db, body.itens);
      const entrega = entregaDaConta(db, usuarioDe(res).id);
      if (body.confirmarEndereco !== true) {
        throw new ValidacaoError("Confirme o endereço de entrega para finalizar o pedido.", { confirmarEndereco: "Confirme o endereço de entrega." });
      }
      const id = criarPedido(db, usuarioDe(res).id, itens, entrega);
      res.status(201).json({ pedido: buscarPedido(db, id) });
    } catch (e) {
      if (e instanceof ValidacaoError) { res.status(400).json({ erro: e.message, campos: e.campos }); return; }
      throw e;
    }
  });

  app.get("/api/pedidos", autenticado(), (req, res) => {
    const u = usuarioDe(res);
    const status = isStatus(req.query.status) ? req.query.status : undefined;
    // Cliente vê apenas os próprios pedidos; funcionário vê todos.
    res.json({ pedidos: listarPedidos(db, { clienteId: u.perfil === "cliente" ? u.id : undefined, status }) });
  });

  app.get("/api/pedidos/:id", autenticado(), (req, res) => {
    const u = usuarioDe(res);
    const id = idDe(req);
    const pedido = id ? buscarPedido(db, id, u.perfil === "cliente" ? u.id : undefined) : null;
    // Pedido de outro cliente responde 404, sem revelar que existe.
    if (!pedido) { res.status(404).json({ erro: "Pedido não encontrado." }); return; }
    res.json({ pedido });
  });

  app.patch("/api/pedidos/:id/status", autenticado("funcionario"), (req, res) => {
    const id = idDe(req);
    const status = (req.body as Record<string, unknown> | undefined)?.status;
    if (!isStatus(status)) { res.status(400).json({ erro: "Status inválido." }); return; }
    if (!id || !alterarStatus(db, id, status)) { res.status(404).json({ erro: "Pedido não encontrado." }); return; }
    res.json({ pedido: buscarPedido(db, id) });
  });

  app.use("/api", (_req, res) => { res.status(404).json({ erro: "Rota não encontrada." }); });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    app.use(express.static(dir));
    app.get("/{*rota}", (_req, res) => res.sendFile(path.join(dir, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) { res.status(err.status).json({ erro: err.message }); return; }
    const status = (err as { status?: number }).status;
    if (status && status >= 400 && status < 500) { res.status(status).json({ erro: "Requisição inválida." }); return; }
    console.error(err);
    res.status(500).json({ erro: "Erro interno. Tente novamente." });
  });

  // Remove sessões expiradas ao iniciar.
  db.prepare("DELETE FROM sessoes WHERE expira_em <= ?").run(new Date().toISOString());
  return app;
}
