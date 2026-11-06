export type Perfil = "cliente" | "funcionario";
export interface Usuario { id: number; nome: string; email: string; perfil: Perfil }
/** Dados completos da própria conta (CPF só é retornado ao próprio usuário). */
export interface MinhaContaDados extends Usuario { cpf: string | null; telefone: string | null }
export interface Endereco {
  destinatario: string; cep: string; logradouro: string; numero: string; complemento: string | null;
  bairro: string; cidade: string; uf: string;
}
export interface Entrega extends Endereco { telefone: string }
export type EnderecoForm = { [K in keyof Endereco]: string };
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export type StatusPedido = "recebido" | "em_preparacao" | "enviado" | "cancelado";
export const STATUS: StatusPedido[] = ["recebido", "em_preparacao", "enviado", "cancelado"];
export const ROTULO_STATUS: Record<StatusPedido, string> = {
  recebido: "Recebido",
  em_preparacao: "Em preparação",
  enviado: "Enviado",
  cancelado: "Cancelado",
};

export interface ItemPedido { id: number; produtoId: number | null; descricao: string; quantidade: number; precoUnitarioCentavos: number; subtotalCentavos: number }
export interface ResumoPedido {
  id: number;
  cliente: { id: number; nome: string; email: string };
  status: StatusPedido;
  totalCentavos: number;
  criadoEm: string;
  atualizadoEm: string;
  quantidadeItens: number;
}
export interface Pedido extends ResumoPedido { itens: ItemPedido[]; entrega: Entrega | null }
export interface ItemNovo { produtoId: number; quantidade: string }

export interface Produto {
  id: number; nome: string; descricao: string; categoria: string; tamanho: string;
  precoCentavos: number; estoque: number; criadoEm: string; atualizadoEm: string;
}
export interface PaginaProdutos { produtos: Produto[]; total: number; pagina: number; totalPaginas: number; porPagina: number }
export interface DadosProduto { nome: string; descricao: string; categoria: string; tamanho: string; preco: string; estoque: string }

export class ApiError extends Error {
  constructor(public status: number, message: string, public campos: Record<string, string> = {}) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { erro?: string; campos?: Record<string, string> };
  if (!res.ok) throw new ApiError(res.status, data.erro ?? "Erro inesperado.", data.campos);
  return data as T;
}

export const api = {
  cadastro: (nome: string, email: string, senha: string) =>
    request<{ usuario: Usuario }>("/cadastro", { method: "POST", body: JSON.stringify({ nome, email, senha }) }),
  login: (email: string, senha: string) =>
    request<{ usuario: Usuario }>("/login", { method: "POST", body: JSON.stringify({ email, senha }) }),
  logout: () => request<void>("/logout", { method: "POST", body: "{}" }),
  minhaConta: () => request<{ usuario: MinhaContaDados; endereco: Endereco | null }>("/minha-conta"),
  salvarDados: (d: { nome: string; cpf: string; telefone: string }) =>
    request<{ usuario: MinhaContaDados }>("/minha-conta/dados", { method: "PUT", body: JSON.stringify(d) }),
  salvarEndereco: (e: EnderecoForm) =>
    request<{ endereco: Endereco }>("/minha-conta/endereco", { method: "PUT", body: JSON.stringify(e) }),
  alterarSenha: (senhaAtual: string, novaSenha: string) =>
    request<void>("/minha-conta/senha", { method: "PUT", body: JSON.stringify({ senhaAtual, novaSenha }) }),
  listarPedidos: (status?: StatusPedido) =>
    request<{ pedidos: ResumoPedido[] }>(`/pedidos${status ? `?status=${status}` : ""}`),
  buscarPedido: (id: number) => request<{ pedido: Pedido }>(`/pedidos/${id}`),
  criarPedido: (itens: ItemNovo[], confirmarEndereco: boolean) =>
    request<{ pedido: Pedido }>("/pedidos", { method: "POST", body: JSON.stringify({ itens, confirmarEndereco }) }),
  listarProdutos: (params: URLSearchParams) => request<PaginaProdutos>(`/produtos?${params}`),
  filtrosProdutos: () => request<{ categorias: string[]; tamanhos: string[] }>("/produtos/filtros"),
  buscarProduto: (id: number) => request<{ produto: Produto }>(`/produtos/${id}`),
  criarProduto: (d: DadosProduto) => request<{ produto: Produto }>("/produtos", { method: "POST", body: JSON.stringify(d) }),
  atualizarProduto: (id: number, d: DadosProduto) =>
    request<{ produto: Produto }>(`/produtos/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  alterarStatus: (id: number, status: StatusPedido) =>
    request<{ pedido: Pedido }>(`/pedidos/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatarMoeda = (centavos: number) => moeda.format(centavos / 100);
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
export const formatarData = (iso: string) => dataHora.format(new Date(iso));

/** Centavos -> texto editável ("19,90"). */
export const centavosParaTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export const formatarCpf = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
export const formatarCep = (c: string) => c.replace(/^(\d{5})(\d{3})$/, "$1-$2");
export const formatarTelefone = (t: string) =>
  t.length === 11 ? t.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : t.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
