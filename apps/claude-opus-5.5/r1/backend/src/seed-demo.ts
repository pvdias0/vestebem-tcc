// Prepara dados fictícios de demonstração. Idempotente: pode ser executado várias vezes.
import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth.js";
import { digitosVerificadoresCpf, entregaDaConta, salvarEndereco, type Endereco } from "./conta.js";
import { migrate } from "./db.js";
import { criarPedido, type ItemEntrada, type StatusPedido } from "./pedidos.js";
import { criarProduto, type DadosProduto } from "./produtos.js";

export const SENHA_DEMO = "demo1234";

const p = (nome: string, categoria: string, tamanho: string, preco: number, estoque: number, descricao: string): DadosProduto =>
  ({ nome, categoria, tamanho, precoCentavos: preco, estoque, descricao });

export const PRODUTOS_DEMO: DadosProduto[] = [
  p("Camiseta Básica Algodão Branca", "Camisetas", "M", 4990, 40, "Camiseta 100% algodão, gola careca, corte reto."),
  p("Camiseta Básica Algodão Preta", "Camisetas", "G", 4990, 35, "Camiseta 100% algodão, gola careca, corte reto."),
  p("Camiseta Estampada Coleção D'Água", "Camisetas", "P", 6990, 20, "Estampa exclusiva da Coleção D'Água, inspirada no mar."),
  p("Regata Dry Fit", "Camisetas", "GG", 3990, 0, "Tecido leve de secagem rápida para treinos."),
  p("Calça Jeans Slim", "Calças", "40", 15990, 18, "Jeans com elastano, lavagem média, modelagem slim."),
  p("Calça Jeans Reta", "Calças", "42", 14990, 12, "Jeans tradicional, lavagem escura, modelagem reta."),
  p("Calça Alfaiataria Bege", "Calças", "38", 18990, 8, "Calça de alfaiataria com pregas e cós alto."),
  p("Bermuda Sarja", "Bermudas", "42", 8990, 25, "Bermuda de sarja com bolsos laterais."),
  p("Bermuda Moletom", "Bermudas", "M", 7990, 15, "Moletom leve com cordão de ajuste."),
  p("Vestido Midi Floral", "Vestidos", "P", 18990, 10, "Vestido midi de viscose com estampa floral."),
  p("Vestido Longo Coleção D'Água", "Vestidos", "M", 25990, 6, "Vestido longo fluido, tons de azul da Coleção D'Água."),
  p("Saia Plissada", "Saias", "M", 11990, 14, "Saia midi plissada com cós elástico."),
  p("Jaqueta Corta-Vento", "Casacos", "G", 22990, 9, "Jaqueta impermeável com capuz embutido."),
  p("Jaqueta Jeans Clássica", "Casacos", "M", 24990, 7, "Jaqueta jeans com botões metálicos."),
  p("Moletom Canguru", "Casacos", "GG", 17990, 11, "Moletom felpado com capuz e bolso canguru."),
  p("Meia Esportiva (par)", "Acessórios", "Único", 1590, 100, "Meia de cano médio com reforço no calcanhar."),
  p("Boné Aba Curva", "Acessórios", "Único", 5990, 30, "Boné de algodão com regulagem traseira."),
  p("Cinto de Couro", "Acessórios", "Único", 8990, 0, "Cinto de couro legítimo com fivela prateada."),
];

interface PedidoDemo { itens: [nomeProduto: string, quantidade: number][]; status: StatusPedido; criadoEm: string }
interface UsuarioDemo {
  nome: string; email: string; perfil: "cliente" | "funcionario"; pedidos: PedidoDemo[];
  cpf?: string; telefone?: string; endereco?: Endereco;
}

/** CPF fictício gerado a partir de 9 dígitos, com dígitos verificadores válidos. Não corresponde a pessoas reais conhecidas. */
const cpfFicticio = (base9: string) => base9 + digitosVerificadoresCpf(base9);

const USUARIOS: UsuarioDemo[] = [
  {
    nome: "Carla Mendes (demo)", email: "cliente1@vestebem.demo", perfil: "cliente",
    cpf: cpfFicticio("900000001"), telefone: "11900000001",
    endereco: {
      destinatario: "Carla Mendes (demo)", cep: "01000000", logradouro: "Rua Fictícia das Flores", numero: "100",
      complemento: "Apto 12", bairro: "Bairro Exemplo", cidade: "São Paulo", uf: "SP",
    },
    pedidos: [
      { status: "enviado", criadoEm: "2026-10-02T14:10:00.000Z",
        itens: [["Camiseta Básica Algodão Branca", 2], ["Calça Jeans Slim", 1]] },
      { status: "recebido", criadoEm: "2026-10-28T09:30:00.000Z", itens: [["Vestido Midi Floral", 1]] },
    ],
  },
  {
    nome: "Rafael Lima (demo)", email: "cliente2@vestebem.demo", perfil: "cliente",
    cpf: cpfFicticio("900000002"), telefone: "21900000002",
    endereco: {
      destinatario: "Rafael Lima (demo)", cep: "20000000", logradouro: "Avenida Imaginária", numero: "s/n",
      complemento: null, bairro: "Centro Demo", cidade: "Rio de Janeiro", uf: "RJ",
    },
    pedidos: [
      { status: "em_preparacao", criadoEm: "2026-10-20T18:45:00.000Z",
        itens: [["Jaqueta Corta-Vento", 1], ["Meia Esportiva (par)", 3]] },
      { status: "cancelado", criadoEm: "2026-09-15T11:00:00.000Z", itens: [["Bermuda Sarja", 1]] },
    ],
  },
  // Cliente sem endereço/telefone, para experimentar o bloqueio na finalização do pedido.
  { nome: "Bruna Sem Endereço (demo)", email: "cliente3@vestebem.demo", perfil: "cliente", pedidos: [] },
  { nome: "Equipe VesteBem (demo)", email: "funcionario@vestebem.demo", perfil: "funcionario", pedidos: [], telefone: "11900000009" },
];

export async function seedDemo(db: DatabaseSync): Promise<string[]> {
  migrate(db);
  const log: string[] = [];

  // Produtos: identificados pelo nome; existentes não são alterados nem duplicados.
  let novos = 0;
  for (const prod of PRODUTOS_DEMO) {
    if (db.prepare("SELECT 1 FROM produtos WHERE nome = ?").get(prod.nome)) continue;
    criarProduto(db, prod);
    novos++;
  }
  log.push(`Produtos de demonstração: ${novos} criado(s), ${PRODUTOS_DEMO.length - novos} já existente(s).`);

  const produtoPorNome = (nome: string) =>
    db.prepare("SELECT id, nome, preco_centavos FROM produtos WHERE nome = ? ORDER BY id LIMIT 1").get(nome) as
      { id: number; nome: string; preco_centavos: number } | undefined;

  for (const u of USUARIOS) {
    const existente = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(u.email) as { id: number } | undefined;
    if (existente) {
      // Contas demo de etapas anteriores: completa apenas o que estiver vazio (nunca sobrescreve alterações do usuário).
      completarDadosDemo(db, existente.id, u);
      log.push(`= ${u.email} já existe (mantido; dados ausentes completados)`);
      continue;
    }
    const hash = await hashPassword(SENHA_DEMO);
    const id = Number(db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)")
      .run(u.nome, u.email, hash, u.perfil).lastInsertRowid);
    completarDadosDemo(db, id, u);
    // Pedidos de demonstração são criados junto com a conta demo; reexecuções não os duplicam.
    for (const ped of u.pedidos) {
      const itens: ItemEntrada[] = ped.itens.map(([nome, quantidade]) => {
        const prod = produtoPorNome(nome);
        if (!prod) throw new Error(`Produto de demonstração ausente: ${nome}`);
        return { produtoId: prod.id, descricao: prod.nome, quantidade, precoUnitarioCentavos: prod.preco_centavos };
      });
      const pid = criarPedido(db, id, itens, entregaDaConta(db, id), ped.criadoEm);
      db.prepare("UPDATE pedidos SET status = ? WHERE id = ?").run(ped.status, pid);
    }
    log.push(`+ ${u.email} (${u.perfil}) criado com ${u.pedidos.length} pedido(s)`);
  }
  return log;
}

function completarDadosDemo(db: DatabaseSync, id: number, u: UsuarioDemo) {
  if (u.cpf) {
    const emUso = db.prepare("SELECT 1 FROM usuarios WHERE cpf = ? AND id <> ?").get(u.cpf, id);
    if (!emUso) db.prepare("UPDATE usuarios SET cpf = ? WHERE id = ? AND cpf IS NULL").run(u.cpf, id);
  }
  if (u.telefone) db.prepare("UPDATE usuarios SET telefone = ? WHERE id = ? AND telefone IS NULL").run(u.telefone, id);
  if (u.endereco && !db.prepare("SELECT 1 FROM enderecos WHERE usuario_id = ?").get(id)) salvarEndereco(db, id, u.endereco);
}
