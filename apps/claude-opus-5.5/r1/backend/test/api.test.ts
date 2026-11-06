import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { migrate, openDatabase } from "../src/db.js";

test("fluxo completo de conta", async () => {
  const db = openDatabase(":memory:");
  migrate(db);
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post = (p: string, body: unknown, cookie = "") =>
    fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });
  const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  try {
    const cad = await post("/cadastro", { nome: "Ana", email: "Ana@Ex.com", senha: "segredo123", perfil: "admin" });
    assert.equal(cad.status, 201);
    assert.ok(!(await cad.text()).toLowerCase().includes("senha"));
    assert.equal((db.prepare("SELECT perfil FROM usuarios").get() as { perfil: string }).perfil, "cliente");

    assert.equal((await post("/cadastro", { nome: "X", email: "ana@ex.com", senha: "outrasenha" })).status, 409);
    assert.equal((await post("/cadastro", { nome: "", email: "x", senha: "1" })).status, 400);
    assert.equal((await post("/login", { email: "ana@ex.com", senha: "errada123" })).status, 401);
    assert.equal((await post("/login", { email: "nao@ex.com", senha: "errada123" })).status, 401);
    assert.equal((await fetch(base + "/minha-conta")).status, 401);

    const login = await post("/login", { email: "ANA@ex.com", senha: "segredo123" });
    assert.equal(login.status, 200);
    const cookie = cookieOf(login);
    const conta = await fetch(base + "/minha-conta", { headers: { cookie } });
    const contaText = await conta.text();
    assert.ok(!contaText.includes("senha"));
    assert.deepEqual(JSON.parse(contaText).usuario, { id: 1, nome: "Ana", email: "ana@ex.com", perfil: "cliente", cpf: null, telefone: null });

    assert.equal((await post("/logout", {}, cookie)).status, 204);
    assert.equal((await fetch(base + "/minha-conta", { headers: { cookie } })).status, 401);
  } finally {
    server.close();
    db.close();
  }
});
