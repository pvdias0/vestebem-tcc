import type { DatabaseSync } from "node:sqlite";
import { ValidacaoError } from "./pedidos.js";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export interface DadosPessoais { nome: string; cpf: string | null; telefone: string | null }
export interface Endereco {
  destinatario: string; cep: string; logradouro: string; numero: string; complemento: string | null;
  bairro: string; cidade: string; uf: string;
}
/** Dados de entrega copiados para o pedido. */
export interface Entrega extends Endereco { telefone: string }

const texto = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const digitos = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

/** Calcula os dois dígitos verificadores de um CPF a partir dos 9 primeiros dígitos. */
export function digitosVerificadoresCpf(base9: string): string {
  const dv = (s: string) => {
    const soma = [...s].reduce((t, d, i) => t + Number(d) * (s.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base9);
  return `${d1}${dv(base9 + d1)}`;
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  return digitosVerificadoresCpf(cpf.slice(0, 9)) === cpf.slice(9);
}

export function validarDadosPessoais(body: unknown): DadosPessoais {
  const o = (body ?? {}) as Record<string, unknown>;
  const campos: Record<string, string> = {};
  const nome = texto(o.nome);
  if (!nome) campos.nome = "Informe seu nome.";
  else if (nome.length > 100) campos.nome = "O nome deve ter no máximo 100 caracteres.";

  const cpfBruto = texto(o.cpf);
  const cpf = digitos(cpfBruto);
  if (cpfBruto && (!/^[\d.\-\s]+$/.test(cpfBruto) || !cpfValido(cpf))) campos.cpf = "CPF inválido.";

  const telBruto = texto(o.telefone);
  const telefone = digitos(telBruto);
  if (telBruto && (!/^[\d()\-\s+]+$/.test(telBruto) || !/^[1-9]{2}\d{8,9}$/.test(telefone))) {
    campos.telefone = "Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.";
  }
  if (Object.keys(campos).length) throw new ValidacaoError("Verifique os dados informados.", campos);
  return { nome, cpf: cpf || null, telefone: telefone || null };
}

export function validarEndereco(body: unknown): Endereco {
  const o = (body ?? {}) as Record<string, unknown>;
  const campos: Record<string, string> = {};
  const obrig = (k: keyof Endereco, rotulo: string, max: number) => {
    const v = texto(o[k]);
    if (!v) campos[k] = `Informe ${rotulo}.`;
    else if (v.length > max) campos[k] = `Máximo de ${max} caracteres.`;
    return v;
  };
  const destinatario = obrig("destinatario", "o destinatário", 100);
  const cepBruto = texto(o.cep);
  const cep = digitos(cepBruto);
  if (!/^\d{8}$/.test(cep) || !/^[\d.\-\s]+$/.test(cepBruto)) campos.cep = "CEP inválido. Use 8 dígitos, ex.: 01234-567.";
  const logradouro = obrig("logradouro", "o logradouro", 150);
  const numero = obrig("numero", "o número (use \"s/n\" se não houver)", 20);
  const complemento = texto(o.complemento);
  if (complemento.length > 100) campos.complemento = "Máximo de 100 caracteres.";
  const bairro = obrig("bairro", "o bairro", 100);
  const cidade = obrig("cidade", "a cidade", 100);
  const uf = texto(o.uf).toUpperCase();
  if (!(UFS as readonly string[]).includes(uf)) campos.uf = "Selecione o estado.";
  if (Object.keys(campos).length) throw new ValidacaoError("Verifique o endereço informado.", campos);
  return { destinatario, cep, logradouro, numero, complemento: complemento || null, bairro, cidade, uf };
}

export function lerDadosPessoais(db: DatabaseSync, usuarioId: number) {
  return db.prepare("SELECT nome, cpf, telefone FROM usuarios WHERE id = ?").get(usuarioId) as unknown as DadosPessoais | undefined;
}

export function salvarDadosPessoais(db: DatabaseSync, usuarioId: number, d: DadosPessoais) {
  try {
    db.prepare("UPDATE usuarios SET nome = ?, cpf = ?, telefone = ? WHERE id = ?").run(d.nome, d.cpf, d.telefone, usuarioId);
  } catch (e) {
    if (String((e as Error).message).includes("UNIQUE")) {
      throw new ValidacaoError("Verifique os dados informados.", { cpf: "Este CPF já está cadastrado em outra conta." });
    }
    throw e;
  }
}

export function lerEndereco(db: DatabaseSync, usuarioId: number): Endereco | null {
  const r = db.prepare(
    "SELECT destinatario, cep, logradouro, numero, complemento, bairro, cidade, uf FROM enderecos WHERE usuario_id = ?",
  ).get(usuarioId) as unknown as Endereco | undefined;
  return r ? { ...r } : null;
}

export function salvarEndereco(db: DatabaseSync, usuarioId: number, e: Endereco) {
  db.prepare(
    `INSERT INTO enderecos (usuario_id, destinatario, cep, logradouro, numero, complemento, bairro, cidade, uf, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(usuario_id) DO UPDATE SET destinatario = excluded.destinatario, cep = excluded.cep,
       logradouro = excluded.logradouro, numero = excluded.numero, complemento = excluded.complemento,
       bairro = excluded.bairro, cidade = excluded.cidade, uf = excluded.uf, atualizado_em = excluded.atualizado_em`,
  ).run(usuarioId, e.destinatario, e.cep, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, new Date().toISOString());
}

/** Monta os dados de entrega a partir da conta atual, ou explica o que falta. */
export function entregaDaConta(db: DatabaseSync, usuarioId: number): Entrega {
  const endereco = lerEndereco(db, usuarioId);
  const telefone = lerDadosPessoais(db, usuarioId)?.telefone ?? null;
  const faltando: Record<string, string> = {};
  if (!endereco) faltando.endereco = "Cadastre um endereço de entrega em \"Minha conta\".";
  if (!telefone) faltando.telefone = "Cadastre um telefone de contato em \"Minha conta\".";
  if (!endereco || !telefone) throw new ValidacaoError("Complete seus dados de entrega antes de finalizar o pedido.", faltando);
  return { ...endereco, telefone };
}
