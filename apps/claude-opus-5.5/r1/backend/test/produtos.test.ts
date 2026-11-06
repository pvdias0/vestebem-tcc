import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { PRODUTOS_DEMO, SENHA_DEMO, seedDemo } from "../src/seed-demo.js";

interface P { id: number; nome: string; descricao: string; categoria: string; tamanho: string; precoCentavos: number; estoque: number }

test("catálogo: paginação, pesquisa, filtros, ordenação e permissões", async () => {
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
  const lista = async (qs: Record<string, string>) => {
    const r = await req("GET", `/produtos?${new URLSearchParams(qs)}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body as { produtos: P[]; total: number; totalPaginas: number; pagina: number };
  };
  const snapshot = () => JSON.stringify(db.prepare("SELECT * FROM produtos ORDER BY id").all());
  const login = async (email: string) => (await req("POST", "/login", { email, senha: SENHA_DEMO })).cookie;

  try {
    const antes = snapshot();
    const N = PRODUTOS_DEMO.length;

    // Paginação de 12 por página (público, sem login)
    const p1 = await lista({});
    assert.equal(p1.total, N);
    assert.equal(p1.produtos.length, 12);
    assert.equal(p1.totalPaginas, Math.ceil(N / 12));
    const p2 = await lista({ pagina: "2" });
    assert.equal(p2.produtos.length, N - 12);
    assert.equal(new Set([...p1.produtos, ...p2.produtos].map((p) => p.id)).size, N);
    assert.equal((await lista({ pagina: "99" })).produtos.length, 0);

    // Pesquisa com apóstrofo, sem diferenciar maiúsculas/acentos, em nome ou descrição
    const agua = await lista({ q: "Coleção D'Água" });
    assert.deepEqual(agua.produtos.map((p) => p.nome).sort(), ["Camiseta Estampada Coleção D'Água", "Vestido Longo Coleção D'Água"]);
    assert.equal((await lista({ q: "colecao d'agua" })).total, 2);
    assert.equal((await lista({ q: "secagem rápida" })).produtos[0]?.nome, "Regata Dry Fit"); // só na descrição
    assert.equal((await lista({ q: "'; DROP TABLE produtos; --" })).total, 0);
    assert.equal((await lista({ q: "100%" })).total, 2); // % é literal, não curinga
    assert.equal((await lista({ q: "_" })).total, 0);

    // Filtros combinados (AND)
    const combinados = await lista({ categoria: "Camisetas", tamanho: "M", precoMin: "40", precoMax: "50,00" });
    assert.deepEqual(combinados.produtos.map((p) => p.nome), ["Camiseta Básica Algodão Branca"]);
    const faixa = await lista({ precoMin: "100", precoMax: "200" });
    assert.ok(faixa.total > 0 && faixa.produtos.every((p) => p.precoCentavos >= 10000 && p.precoCentavos <= 20000));
    const cat = await lista({ categoria: "Casacos", q: "jaqueta" });
    assert.ok(cat.total === 2 && cat.produtos.every((p) => p.categoria === "Casacos" && /jaqueta/i.test(p.nome)));

    // Ordenação
    const precos = (await lista({ ordem: "preco", direcao: "desc", categoria: "Calças" })).produtos.map((p) => p.precoCentavos);
    assert.deepEqual(precos, [...precos].sort((a, b) => b - a));
    const nomes = (await lista({ ordem: "nome", direcao: "asc", categoria: "Camisetas" })).produtos.map((p) => p.nome);
    assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));

    // Parâmetros inválidos
    for (const qs of <Record<string, string>[]>[{ precoMin: "-1" }, { precoMin: "abc" }, { precoMin: "50", precoMax: "10" }, { ordem: "id; DROP" }, { pagina: "0" }, { direcao: "x" }]) {
      assert.equal((await req("GET", `/produtos?${new URLSearchParams(qs)}`)).status, 400, JSON.stringify(qs));
    }

    // Detalhe público e opções de filtro
    assert.equal((await req("GET", "/produtos/1")).body.produto.nome, "Camiseta Básica Algodão Branca");
    assert.equal((await req("GET", "/produtos/9999")).status, 404);
    assert.ok((await req("GET", "/produtos/filtros")).body.categorias.includes("Vestidos"));

    // Consultas não alteram registros
    assert.equal(snapshot(), antes);

    // Permissões de escrita
    const novo = { nome: "Blusa <b>teste</b>", descricao: "Linha 1\nLinha 2", categoria: "Blusas", tamanho: "p", preco: "59,90", estoque: 5 };
    assert.equal((await req("POST", "/produtos", novo)).status, 401);
    const cliente = await login("cliente1@vestebem.demo");
    assert.equal((await req("POST", "/produtos", novo, cliente)).status, 403);
    assert.equal((await req("PUT", "/produtos/1", novo, cliente)).status, 403);
    const func = await login("funcionario@vestebem.demo");
    const criado = await req("POST", "/produtos", novo, func);
    assert.equal(criado.status, 201);
    assert.equal(criado.body.produto.nome, "Blusa <b>teste</b>"); // armazenado como texto
    assert.equal(criado.body.produto.precoCentavos, 5990);
    assert.equal(criado.body.produto.tamanho, "P");

    // Validações de preço e estoque
    for (const inval of [{ preco: "-1" }, { preco: "1,999" }, { estoque: -1 }, { estoque: 1.5 }, { estoque: "abc" }, { nome: "" }]) {
      assert.equal((await req("POST", "/produtos", { ...novo, ...inval }, func)).status, 400, JSON.stringify(inval));
    }
    const atualizado = await req("PUT", `/produtos/${criado.body.produto.id}`, { ...novo, preco: "0", estoque: "0" }, func);
    assert.equal(atualizado.status, 200);
    assert.equal(atualizado.body.produto.precoCentavos, 0);
    assert.equal(atualizado.body.produto.estoque, 0);
    assert.equal((await req("PUT", "/produtos/9999", novo, func)).status, 404);
  } finally {
    server.close();
    db.close();
  }
});
