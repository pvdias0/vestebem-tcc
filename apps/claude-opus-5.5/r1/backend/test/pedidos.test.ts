import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { MIGRATIONS_DIR, migrate, openDatabase } from "../src/db.js";
import { SENHA_DEMO, seedDemo } from "../src/seed-demo.js";
import { buscarPedido } from "../src/pedidos.js";

async function iniciar() {
  const db = openDatabase(":memory:");
  await seedDemo(db);
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const req = async (method: string, p: string, body?: unknown, cookie = "") => {
    const r = await fetch(base + p, {
      method, headers: { "Content-Type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "" };
  };
  const login = async (email: string) => (await req("POST", "/login", { email, senha: SENHA_DEMO })).cookie;
  return { db, server, req, login };
}

test("regras de pedidos por perfil", async () => {
  const { db, server, req, login } = await iniciar();
  try {
    const c1 = await login("cliente1@vestebem.demo");
    const c2 = await login("cliente2@vestebem.demo");
    const func = await login("funcionario@vestebem.demo");

    // Visitante
    assert.equal((await req("GET", "/pedidos")).status, 401);
    assert.equal((await req("GET", "/pedidos/1")).status, 401);
    assert.equal((await req("POST", "/pedidos", { itens: [{ produtoId: 1, quantidade: 1 }] })).status, 401);

    // Criação: nome e preço vêm do catálogo; total/preço/nome enviados são ignorados
    const novo = await req("POST", "/pedidos", {
      totalCentavos: 1, clienteId: 999, confirmarEndereco: true,
      itens: [{ produtoId: 1, quantidade: 3, precoUnitario: "0,01", descricao: "hack" }, { produtoId: 16, quantidade: "1" }],
    }, c1);
    assert.equal(novo.status, 201);
    assert.equal(novo.body.pedido.totalCentavos, 3 * 4990 + 1590);
    assert.equal(novo.body.pedido.status, "recebido");
    assert.equal(novo.body.pedido.cliente.email, "cliente1@vestebem.demo");
    assert.deepEqual(novo.body.pedido.itens[0], {
      id: novo.body.pedido.itens[0].id, produtoId: 1, descricao: "Camiseta Básica Algodão Branca",
      quantidade: 3, precoUnitarioCentavos: 4990, subtotalCentavos: 14970,
    });
    const idNovo: number = novo.body.pedido.id;

    // Validações
    for (const itens of [
      [], undefined,
      [{ produtoId: 1, quantidade: 0 }],
      [{ produtoId: 1, quantidade: 1.5 }],
      [{ produtoId: 1, quantidade: -2 }],
      [{ produtoId: 9999, quantidade: 1 }],
      [{ quantidade: 1 }],
      [{ produtoId: 4, quantidade: 1 }], // sem estoque
      [{ produtoId: 1, quantidade: 41 }], // acima do estoque
      [{ produtoId: 1, quantidade: 30 }, { produtoId: 1, quantidade: 11 }], // soma acima do estoque
    ]) assert.equal((await req("POST", "/pedidos", { itens }, c1)).status, 400, JSON.stringify(itens));

    // Funcionário não cria pedido
    assert.equal((await req("POST", "/pedidos", { itens: [{ produtoId: 1, quantidade: 1 }] }, func)).status, 403);

    // Alterar o produto depois não muda o pedido
    const prodAntes = (await req("GET", "/produtos/1")).body.produto;
    assert.equal((await req("PUT", "/produtos/1", { ...prodAntes, nome: "Novo nome", preco: "99,00" }, func)).status, 200);
    const pedidoDepois = (await req("GET", `/pedidos/${idNovo}`, undefined, c1)).body.pedido;
    assert.equal(pedidoDepois.itens[0].descricao, "Camiseta Básica Algodão Branca");
    assert.equal(pedidoDepois.itens[0].precoUnitarioCentavos, 4990);
    assert.equal(pedidoDepois.totalCentavos, 3 * 4990 + 1590);

    // Isolamento entre clientes
    const lista1 = (await req("GET", "/pedidos", undefined, c1)).body.pedidos as { id: number; cliente: { email: string } }[];
    assert.equal(lista1.length, 3);
    assert.ok(lista1.every((p) => p.cliente.email === "cliente1@vestebem.demo"));
    assert.equal((await req("GET", `/pedidos/${idNovo}`, undefined, c2)).status, 404);
    assert.equal((await req("GET", `/pedidos/${idNovo}`, undefined, c1)).body.pedido.itens.length, 2);

    // Cliente não altera status
    assert.equal((await req("PATCH", `/pedidos/${idNovo}/status`, { status: "enviado" }, c1)).status, 403);

    // Funcionário vê todos e altera status
    assert.equal((await req("GET", "/pedidos", undefined, func)).body.pedidos.length, 5);
    assert.equal((await req("GET", `/pedidos/${idNovo}`, undefined, func)).status, 200);
    assert.equal((await req("PATCH", `/pedidos/${idNovo}/status`, { status: "pronto" }, func)).status, 400);
    assert.equal((await req("PATCH", `/pedidos/99999/status`, { status: "enviado" }, func)).status, 404);
    const alt = await req("PATCH", `/pedidos/${idNovo}/status`, { status: "em_preparacao" }, func);
    assert.equal(alt.status, 200);
    assert.equal(alt.body.pedido.status, "em_preparacao");
    assert.equal((await req("GET", `/pedidos/${idNovo}`, undefined, c1)).body.pedido.status, "em_preparacao");

    // Cadastro público não cria funcionário
    const cad = await req("POST", "/cadastro", { nome: "Zé", email: "ze@ex.com", senha: "12345678", perfil: "funcionario" });
    assert.equal(cad.body.usuario.perfil, "cliente");
    assert.equal((await req("GET", "/pedidos", undefined, cad.cookie)).body.pedidos.length, 0);
  } finally {
    server.close();
    db.close();
  }
});

test("seed de demonstração é idempotente", async () => {
  const db = openDatabase(":memory:");
  await seedDemo(db);
  await seedDemo(db);
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  assert.equal(n("SELECT COUNT(*) AS n FROM usuarios"), 4);
  assert.equal(n("SELECT COUNT(*) AS n FROM enderecos"), 2);
  assert.equal(n("SELECT COUNT(*) AS n FROM pedidos"), 4);
  assert.equal(n("SELECT COUNT(*) AS n FROM produtos"), 18);
  db.close();
});

test("migration 002 preserva dados de um banco da etapa 1", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE schema_migrations (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL DEFAULT 'x')");
  db.exec(readFileSync(path.join(MIGRATIONS_DIR, "001_criar_usuarios_e_sessoes.sql"), "utf8"));
  db.exec("INSERT INTO schema_migrations (nome) VALUES ('001_criar_usuarios_e_sessoes.sql')");
  db.exec("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('Antigo', 'antigo@ex.com', 'h')");
  db.exec("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ('t', 1, '2999-01-01')");

  assert.deepEqual(migrate(db), ["002_perfis_e_pedidos.sql", "003_catalogo_produtos.sql", "004_dados_pessoais_e_entrega.sql"]);
  assert.deepEqual({ ...db.prepare("SELECT nome, email, perfil FROM usuarios").get() }, { nome: "Antigo", email: "antigo@ex.com", perfil: "cliente" });
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sessoes").get() as { n: number }).n, 1);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  // FK de sessoes continua funcionando após a recriação da tabela
  assert.throws(() => db.exec("INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ('u', 42, 'x')"));
  db.close();
});

test("migration 003 preserva pedidos da etapa 2 sem vínculo com produtos", () => {
  const db = openDatabase(":memory:");
  db.exec("CREATE TABLE schema_migrations (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL DEFAULT 'x')");
  for (const f of ["001_criar_usuarios_e_sessoes.sql", "002_perfis_e_pedidos.sql"]) {
    db.exec(readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    db.prepare("INSERT INTO schema_migrations (nome) VALUES (?)").run(f);
  }
  db.exec("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('Antigo', 'antigo@ex.com', 'h')");
  db.exec("INSERT INTO pedidos (cliente_id, status, total_centavos) VALUES (1, 'enviado', 5970)");
  db.exec("INSERT INTO itens_pedido (pedido_id, descricao, quantidade, preco_unitario_centavos) VALUES (1, 'Camisa manual', 3, 1990)");

  assert.deepEqual(migrate(db), ["003_catalogo_produtos.sql", "004_dados_pessoais_e_entrega.sql"]);
  assert.equal(buscarPedido(db, 1)?.entrega, null);
  const pedido = buscarPedido(db, 1);
  assert.ok(pedido);
  assert.equal(pedido.totalCentavos, 5970);
  assert.equal(pedido.status, "enviado");
  assert.deepEqual({ ...pedido.itens[0] }, {
    id: 1, produtoId: null, descricao: "Camisa manual", quantidade: 3, precoUnitarioCentavos: 1990, subtotalCentavos: 5970,
  });
  db.close();
});
