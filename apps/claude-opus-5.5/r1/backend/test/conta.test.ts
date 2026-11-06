import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { cpfValido, digitosVerificadoresCpf } from "../src/conta.js";
import { migrate, openDatabase } from "../src/db.js";
import { SENHA_DEMO, seedDemo } from "../src/seed-demo.js";

async function servidor(db: DatabaseSync) {
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const req = async (method: string, p: string, body?: unknown, cookie = "") => {
    const r = await fetch(base + p, {
      method, headers: { "Content-Type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    return { status: r.status, text, body: text ? JSON.parse(text) : null, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "" };
  };
  const login = async (email: string, senha = SENHA_DEMO) => req("POST", "/login", { email, senha });
  return { server, req, login };
}

const CPF_A = "529982247" + digitosVerificadoresCpf("529982247"); // CPF de teste (dígitos verificadores calculados)
const enderecoA = {
  destinatario: "Destinatária Teste", cep: "12345-678", logradouro: "Rua de Teste", numero: "10",
  complemento: "", bairro: "Bairro Teste", cidade: "Cidade Teste", uf: "mg",
};

test("validação de CPF", () => {
  assert.ok(cpfValido(CPF_A));
  assert.ok(!cpfValido("11111111111"));
  assert.ok(!cpfValido(CPF_A.slice(0, 10) + ((Number(CPF_A[10]) + 1) % 10)));
});

test("dados pessoais, endereço, entrega nos pedidos e privacidade do CPF", async () => {
  const db = openDatabase(":memory:");
  await seedDemo(db);
  const { server, req, login } = await servidor(db);
  try {
    // Visitante
    assert.equal((await req("PUT", "/minha-conta/dados", { nome: "X" })).status, 401);
    assert.equal((await req("PUT", "/minha-conta/endereco", enderecoA)).status, 401);
    assert.equal((await req("PUT", "/minha-conta/senha", { senhaAtual: "a", novaSenha: "b" })).status, 401);

    const c3 = (await login("cliente3@vestebem.demo")).cookie;
    const c1 = (await login("cliente1@vestebem.demo")).cookie;
    const func = (await login("funcionario@vestebem.demo")).cookie;

    // Consulta da própria conta (inclui CPF, nunca senha)
    const conta1 = await req("GET", "/minha-conta", undefined, c1);
    assert.equal(conta1.body.usuario.email, "cliente1@vestebem.demo");
    assert.match(conta1.body.usuario.cpf, /^\d{11}$/);
    assert.equal(conta1.body.endereco.cidade, "São Paulo");
    assert.ok(!/senha/i.test(conta1.text));
    const cpfCliente1: string = conta1.body.usuario.cpf;

    // Dados pessoais: validação e gravação (formatação aceita, dígitos armazenados)
    for (const inval of [{ nome: "" }, { cpf: "123.456.789-00" }, { cpf: "111.111.111-11" }, { cpf: "abc" }, { telefone: "123" }, { telefone: "(00) 91234-5678" }]) {
      assert.equal((await req("PUT", "/minha-conta/dados", { nome: "Bruna", ...inval }, c3)).status, 400, JSON.stringify(inval));
    }
    const cpfDup = await req("PUT", "/minha-conta/dados", { nome: "Bruna", cpf: cpfCliente1 }, c3);
    assert.equal(cpfDup.status, 400);
    assert.ok(cpfDup.body.campos.cpf);
    const dados = await req("PUT", "/minha-conta/dados", {
      nome: "  Bruna   Teste ", cpf: `${CPF_A.slice(0, 3)}.${CPF_A.slice(3, 6)}.${CPF_A.slice(6, 9)}-${CPF_A.slice(9)}`,
      telefone: "(31) 3333-4444", perfil: "funcionario", email: "outro@ex.com",
    }, c3);
    assert.equal(dados.status, 200);
    assert.deepEqual({ nome: dados.body.usuario.nome, cpf: dados.body.usuario.cpf, telefone: dados.body.usuario.telefone, perfil: dados.body.usuario.perfil, email: dados.body.usuario.email },
      { nome: "Bruna Teste", cpf: CPF_A, telefone: "3133334444", perfil: "cliente", email: "cliente3@vestebem.demo" });

    // Pedido sem endereço é bloqueado
    const itens = [{ produtoId: 1, quantidade: 1 }];
    const semEnd = await req("POST", "/pedidos", { itens, confirmarEndereco: true }, c3);
    assert.equal(semEnd.status, 400);
    assert.ok(semEnd.body.campos.endereco);

    // Endereço: validação e permissão
    for (const inval of [{ cep: "123" }, { uf: "XX" }, { logradouro: "" }, { numero: "" }, { destinatario: " " }]) {
      assert.equal((await req("PUT", "/minha-conta/endereco", { ...enderecoA, ...inval }, c3)).status, 400, JSON.stringify(inval));
    }
    assert.equal((await req("PUT", "/minha-conta/endereco", enderecoA, func)).status, 403);
    const end = await req("PUT", "/minha-conta/endereco", enderecoA, c3);
    assert.equal(end.status, 200);
    assert.equal(end.body.endereco.cep, "12345678");
    assert.equal(end.body.endereco.uf, "MG");
    assert.equal(end.body.endereco.complemento, null);

    // Confirmação obrigatória
    assert.equal((await req("POST", "/pedidos", { itens }, c3)).status, 400);
    assert.equal((await req("POST", "/pedidos", { itens, confirmarEndereco: "sim" }, c3)).status, 400);
    const ped = await req("POST", "/pedidos", { itens, confirmarEndereco: true }, c3);
    assert.equal(ped.status, 201);
    const idPed: number = ped.body.pedido.id;
    assert.deepEqual(ped.body.pedido.entrega, {
      destinatario: "Destinatária Teste", telefone: "3133334444", cep: "12345678", logradouro: "Rua de Teste",
      numero: "10", complemento: null, bairro: "Bairro Teste", cidade: "Cidade Teste", uf: "MG",
    });

    // Alterações posteriores na conta não mudam o pedido
    await req("PUT", "/minha-conta/endereco", { ...enderecoA, destinatario: "Outra Pessoa", logradouro: "Rua Nova", uf: "SP" }, c3);
    await req("PUT", "/minha-conta/dados", { nome: "Nome Novo", telefone: "11988887777" }, c3);
    const depois = (await req("GET", `/pedidos/${idPed}`, undefined, c3)).body.pedido;
    assert.equal(depois.entrega.destinatario, "Destinatária Teste");
    assert.equal(depois.entrega.logradouro, "Rua de Teste");
    assert.equal(depois.entrega.telefone, "3133334444");
    assert.equal(depois.entrega.uf, "MG");
    // CPF pode ser removido pelo próprio cliente (campo opcional)
    assert.equal((await req("GET", "/minha-conta", undefined, c3)).body.usuario.cpf, null);

    // Funcionário vê dados de envio, mas nunca CPF
    const vistaFunc = await req("GET", `/pedidos/${idPed}`, undefined, func);
    assert.equal(vistaFunc.status, 200);
    assert.equal(vistaFunc.body.pedido.entrega.logradouro, "Rua de Teste");
    const listaFunc = await req("GET", "/pedidos", undefined, func);
    for (const t of [vistaFunc.text, listaFunc.text]) {
      assert.ok(!/cpf/i.test(t));
      assert.ok(!t.includes(cpfCliente1) && !t.includes(CPF_A));
    }
    for (const p of listaFunc.body.pedidos as { id: number }[]) {
      const t = (await req("GET", `/pedidos/${p.id}`, undefined, func)).text;
      assert.ok(!/cpf/i.test(t) && !t.includes(cpfCliente1));
    }

    // Cada cliente só vê os próprios dados: a conta do cliente 1 segue intacta
    const c1Depois = (await req("GET", "/minha-conta", undefined, c1)).body;
    assert.equal(c1Depois.usuario.cpf, cpfCliente1);
    assert.equal(c1Depois.endereco.cidade, "São Paulo");
  } finally {
    server.close();
    db.close();
  }
});

test("alteração de senha", async () => {
  const db = openDatabase(":memory:");
  await seedDemo(db);
  const { server, req, login } = await servidor(db);
  try {
    const email = "cliente2@vestebem.demo";
    const sessaoA = (await login(email)).cookie;
    const sessaoB = (await login(email)).cookie;

    const errada = await req("PUT", "/minha-conta/senha", { senhaAtual: "errada123", novaSenha: "novaSenha123" }, sessaoA);
    assert.equal(errada.status, 400);
    assert.ok(errada.body.campos.senhaAtual);
    assert.equal((await req("PUT", "/minha-conta/senha", { senhaAtual: SENHA_DEMO, novaSenha: "curta" }, sessaoA)).status, 400);
    assert.equal((await req("PUT", "/minha-conta/senha", { senhaAtual: SENHA_DEMO, novaSenha: SENHA_DEMO }, sessaoA)).status, 400);

    // Senha anterior continua valendo enquanto não houve alteração
    assert.equal((await login(email)).status, 200);

    const ok = await req("PUT", "/minha-conta/senha", { senhaAtual: SENHA_DEMO, novaSenha: "novaSenha123" }, sessaoA);
    assert.equal(ok.status, 204);
    assert.equal(ok.text, "");

    assert.equal((await login(email)).status, 401); // senha anterior rejeitada
    const nova = await login(email, "novaSenha123");
    assert.equal(nova.status, 200);
    assert.ok(!/senha/i.test(nova.text));

    // Sessão atual continua; outras sessões da conta são encerradas
    assert.equal((await req("GET", "/minha-conta", undefined, sessaoA)).status, 200);
    assert.equal((await req("GET", "/minha-conta", undefined, sessaoB)).status, 401);
  } finally {
    server.close();
    db.close();
  }
});

test("dados pessoais e de entrega persistem após reiniciar", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vestebem-"));
  const arquivo = path.join(dir, "teste.db");
  try {
    let db = openDatabase(arquivo);
    await seedDemo(db);
    let s = await servidor(db);
    const c = (await s.login("cliente3@vestebem.demo")).cookie;
    await s.req("PUT", "/minha-conta/dados", { nome: "Persistente", cpf: CPF_A, telefone: "11912345678" }, c);
    await s.req("PUT", "/minha-conta/endereco", enderecoA, c);
    const id = (await s.req("POST", "/pedidos", { itens: [{ produtoId: 2, quantidade: 1 }], confirmarEndereco: true }, c)).body.pedido.id;
    s.server.close();
    db.close();

    db = openDatabase(arquivo);
    migrate(db);
    s = await servidor(db);
    const c2 = (await s.login("cliente3@vestebem.demo")).cookie;
    const conta = (await s.req("GET", "/minha-conta", undefined, c2)).body;
    assert.equal(conta.usuario.nome, "Persistente");
    assert.equal(conta.usuario.cpf, CPF_A);
    assert.equal(conta.endereco.logradouro, "Rua de Teste");
    assert.equal((await s.req("GET", `/pedidos/${id}`, undefined, c2)).body.pedido.entrega.cidade, "Cidade Teste");
    s.server.close();
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
