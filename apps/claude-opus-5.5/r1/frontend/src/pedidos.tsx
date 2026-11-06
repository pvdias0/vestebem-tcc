import { useEffect, useState, type FormEvent } from "react";
import {
  api, formatarData, formatarMoeda, ROTULO_STATUS, STATUS,
  type Endereco, type Pedido, type Produto, type ResumoPedido, type StatusPedido, type Usuario,
} from "./api";
import { BlocoEndereco, Link, MensagemAviso, Selo, useCarregar, useEnvio, type Aviso, type Navegar } from "./ui";

type OnSessaoExpirada = () => void;

interface Linha { produto: Produto; quantidade: string }

/** Criação de pedido: o cliente escolhe produtos do catálogo e informa quantidades. Preços vêm do backend. */
export function NovoPedido({ navegar, produtoInicial }: { navegar: Navegar; produtoInicial?: number }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Produto[] | null>(null);
  const [totalResultados, setTotalResultados] = useState(0);
  const [erroBusca, setErroBusca] = useState("");
  const { enviando, erro, campos, enviar } = useEnvio();
  // Dados de entrega da conta (lidos do backend); undefined = carregando.
  const [entrega, setEntrega] = useState<{ endereco: Endereco | null; telefone: string | null } | undefined>(undefined);
  const [confirmado, setConfirmado] = useState(false);
  useEffect(() => {
    api.minhaConta().then((r) => setEntrega({ endereco: r.endereco, telefone: r.usuario.telefone }))
      .catch(() => setEntrega({ endereco: null, telefone: null }));
  }, []);
  const entregaCompleta = !!entrega?.endereco && !!entrega.telefone;

  const adicionar = (p: Produto) =>
    setLinhas((a) => (a.some((l) => l.produto.id === p.id) ? a : [...a, { produto: p, quantidade: "1" }]));

  useEffect(() => {
    if (produtoInicial) api.buscarProduto(produtoInicial).then((r) => { if (r.produto.estoque > 0) adicionar(r.produto); }).catch(() => undefined);
  }, [produtoInicial]);

  const pesquisar = (e?: FormEvent) => {
    e?.preventDefault();
    setErroBusca("");
    const qs = new URLSearchParams();
    if (termo.trim()) qs.set("q", termo.trim());
    api.listarProdutos(qs)
      .then((r) => { setResultados(r.produtos); setTotalResultados(r.total); })
      .catch((err: Error) => setErroBusca(err.message));
  };
  // Mostra a primeira página do catálogo ao abrir a tela.
  useEffect(() => { pesquisar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const alterarQtd = (id: number, q: string) => setLinhas((a) => a.map((l) => (l.produto.id === id ? { ...l, quantidade: q } : l)));
  const remover = (id: number) => setLinhas((a) => a.filter((l) => l.produto.id !== id));
  const subtotal = (l: Linha) => (/^\d+$/.test(l.quantidade.trim()) ? Number(l.quantidade) * l.produto.precoCentavos : null);
  const subtotais = linhas.map(subtotal);
  const total = subtotais.every((s) => s !== null) ? subtotais.reduce<number>((a, s) => a + (s ?? 0), 0) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => {
      const { pedido } = await api.criarPedido(linhas.map((l) => ({ produtoId: l.produto.id, quantidade: l.quantidade })), confirmado);
      navegar(`/pedidos/${pedido.id}`, { aviso: { tipo: "sucesso", texto: `Pedido nº ${pedido.id} criado com sucesso.` } });
    });
  };

  return (
    <section className="cartao">
      <h1>Novo pedido</h1>

      <h2 className="subtitulo">1. Escolha os produtos</h2>
      <form className="busca-produto" role="search" onSubmit={pesquisar}>
        <label htmlFor="busca-produto" className="sr-only">Pesquisar produto</label>
        <input id="busca-produto" type="search" value={termo} maxLength={100} placeholder="Pesquisar por nome ou descrição"
          onChange={(e) => setTermo(e.target.value)} />
        <button type="submit" className="botao compacto">Pesquisar</button>
      </form>
      <MensagemAviso aviso={erroBusca ? { tipo: "erro", texto: erroBusca } : null} />
      {resultados && resultados.length === 0 && <p>Nenhum produto encontrado.</p>}
      {resultados && resultados.length > 0 && (
        <ul className="lista-escolha">
          {resultados.map((p) => {
            const escolhido = linhas.some((l) => l.produto.id === p.id);
            return (
              <li key={p.id}>
                <div>
                  <strong>{p.nome}</strong>
                  <small className="dica"> {p.categoria} · Tam. {p.tamanho} · {p.estoque > 0 ? `${p.estoque} em estoque` : "sem estoque"}</small>
                </div>
                <span className="produto-preco">{formatarMoeda(p.precoCentavos)}</span>
                <button type="button" className="botao secundario compacto" disabled={escolhido || p.estoque === 0} onClick={() => adicionar(p)}>
                  {escolhido ? "Adicionado" : "Adicionar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {resultados && totalResultados > resultados.length && (
        <p className="dica">Mostrando {resultados.length} de {totalResultados} produtos. Refine a pesquisa para encontrar outros.</p>
      )}

      <h2 className="subtitulo">2. Confira as quantidades</h2>
      <form onSubmit={submit} noValidate>
        <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : null} />
        {linhas.length === 0 && <p className="dica">Nenhum produto adicionado. O pedido deve ter pelo menos um item.</p>}
        {linhas.length > 0 && (
          <div className="tabela-container">
            <table className="tabela">
              <thead><tr><th>Produto</th><th>Preço unitário</th><th>Quantidade</th><th>Subtotal</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {linhas.map((l, i) => {
                  const e = (c: string) => campos[`itens.${i}.${c}`];
                  return (
                    <tr key={l.produto.id}>
                      <td data-rotulo="Produto">
                        {l.produto.nome} <small className="dica">({l.produto.tamanho})</small>
                        {e("produtoId") && <small className="erro-campo bloco">{e("produtoId")}</small>}
                      </td>
                      <td data-rotulo="Preço unitário">{formatarMoeda(l.produto.precoCentavos)}</td>
                      <td data-rotulo="Quantidade">
                        <label htmlFor={`qtd-${l.produto.id}`} className="sr-only">Quantidade de {l.produto.nome}</label>
                        <input id={`qtd-${l.produto.id}`} className="qtd" type="number" inputMode="numeric" min={1} step={1}
                          max={l.produto.estoque} value={l.quantidade} aria-invalid={!!e("quantidade")}
                          onChange={(ev) => alterarQtd(l.produto.id, ev.target.value)} />
                        {e("quantidade") && <small className="erro-campo bloco">{e("quantidade")}</small>}
                      </td>
                      <td data-rotulo="Subtotal">{subtotais[i] !== null ? formatarMoeda(subtotais[i]!) : "—"}</td>
                      <td><button type="button" className="botao-link" onClick={() => remover(l.produto.id)}>Remover</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="total">Total estimado: <strong>{total !== null ? formatarMoeda(total) : "—"}</strong></p>
        <p className="dica">O total final é calculado pela loja com os preços cadastrados no momento do pedido.</p>

        <h2 className="subtitulo">3. Entrega</h2>
        {entrega === undefined && <p className="carregando">Carregando dados de entrega…</p>}
        {entrega && !entregaCompleta && (
          <div className="alerta" role="alert">
            {!entrega.endereco && <p className="sem-margem">Você ainda não cadastrou um endereço de entrega.</p>}
            {!entrega.telefone && <p className="sem-margem">Você ainda não cadastrou um telefone de contato.</p>}
            <p className="sem-margem">
              Complete seus dados em <Link para="/minha-conta" navegar={navegar}>Minha conta</Link> para finalizar o pedido.
            </p>
          </div>
        )}
        {entrega?.endereco && entregaCompleta && (
          <>
            <BlocoEndereco e={entrega.endereco} telefone={entrega.telefone} />
            <p className="dica">Para usar outro endereço, altere-o em <Link para="/minha-conta" navegar={navegar}>Minha conta</Link>.</p>
            <label className="confirmacao">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
              Confirmo a entrega neste endereço.
            </label>
            {campos.confirmarEndereco && <small className="erro-campo bloco">{campos.confirmarEndereco}</small>}
          </>
        )}

        <button type="submit" className="botao" disabled={enviando || linhas.length === 0 || !entregaCompleta || !confirmado}>{enviando ? "Enviando…" : "Criar pedido"}</button>
      </form>
    </section>
  );
}

function TabelaPedidos({ pedidos, navegar, mostrarCliente }: { pedidos: ResumoPedido[]; navegar: Navegar; mostrarCliente: boolean }) {
  return (
    <div className="tabela-container">
      <table className="tabela">
        <thead>
          <tr>
            <th>Nº</th>
            {mostrarCliente && <th>Cliente</th>}
            <th>Data</th>
            <th>Peças</th>
            <th>Total</th>
            <th>Status</th>
            <th><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td data-rotulo="Nº">{p.id}</td>
              {mostrarCliente && <td data-rotulo="Cliente">{p.cliente.nome}<br /><small className="dica">{p.cliente.email}</small></td>}
              <td data-rotulo="Data">{formatarData(p.criadoEm)}</td>
              <td data-rotulo="Peças">{p.quantidadeItens}</td>
              <td data-rotulo="Total">{formatarMoeda(p.totalCentavos)}</td>
              <td data-rotulo="Status"><Selo status={p.status} /></td>
              <td><Link para={`/pedidos/${p.id}`} navegar={navegar}>Ver detalhes</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MeusPedidos({ navegar, onSessaoExpirada }: { navegar: Navegar; onSessaoExpirada: OnSessaoExpirada }) {
  const { dados, erro } = useCarregar(() => api.listarPedidos(), [], onSessaoExpirada);
  return (
    <section className="cartao">
      <div className="cabecalho">
        <h1>Meus pedidos</h1>
        <Link para="/pedidos/novo" navegar={navegar} className="botao compacto">Novo pedido</Link>
      </div>
      <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro.texto } : null} />
      {!dados && !erro && <p className="carregando">Carregando…</p>}
      {dados && dados.pedidos.length === 0 && <p>Você ainda não fez nenhum pedido.</p>}
      {dados && dados.pedidos.length > 0 && <TabelaPedidos pedidos={dados.pedidos} navegar={navegar} mostrarCliente={false} />}
    </section>
  );
}

export function PainelPedidos({ navegar, onSessaoExpirada }: { navegar: Navegar; onSessaoExpirada: OnSessaoExpirada }) {
  const [filtro, setFiltro] = useState<StatusPedido | "">("");
  const { dados, erro } = useCarregar(() => api.listarPedidos(filtro || undefined), [filtro], onSessaoExpirada);
  return (
    <section className="cartao">
      <div className="cabecalho">
        <h1>Painel de pedidos</h1>
        <div className="campo inline">
          <label htmlFor="filtro">Status</label>
          <select id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as StatusPedido | "")}>
            <option value="">Todos</option>
            {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
          </select>
        </div>
      </div>
      <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro.texto } : null} />
      {!dados && !erro && <p className="carregando">Carregando…</p>}
      {dados && dados.pedidos.length === 0 && <p>Nenhum pedido encontrado.</p>}
      {dados && dados.pedidos.length > 0 && <TabelaPedidos pedidos={dados.pedidos} navegar={navegar} mostrarCliente />}
    </section>
  );
}

export function DetalhePedido({ id, usuario, navegar, onSessaoExpirada }: {
  id: number; usuario: Usuario; navegar: Navegar; onSessaoExpirada: OnSessaoExpirada;
}) {
  const { dados, setDados, erro } = useCarregar(() => api.buscarPedido(id), [id], onSessaoExpirada);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [novoStatus, setNovoStatus] = useState<StatusPedido | "">("");
  const { enviando, enviar } = useEnvio();
  const pedido: Pedido | undefined = dados?.pedido;
  const funcionario = usuario.perfil === "funcionario";
  const voltar = funcionario ? "/painel" : "/meus-pedidos";

  useEffect(() => { if (pedido) setNovoStatus(pedido.status); }, [pedido]);

  const salvarStatus = (e: FormEvent) => {
    e.preventDefault();
    if (!pedido || !novoStatus || novoStatus === pedido.status) return;
    setAviso(null);
    void enviar(async () => {
      try {
        const r = await api.alterarStatus(pedido.id, novoStatus);
        setDados(r);
        setAviso({ tipo: "sucesso", texto: `Status alterado para "${ROTULO_STATUS[r.pedido.status]}".` });
      } catch (err) {
        setAviso({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro ao alterar status." });
      }
    });
  };

  return (
    <section className="cartao">
      <p><Link para={voltar} navegar={navegar}>← Voltar</Link></p>
      {erro && <MensagemAviso aviso={{ tipo: "erro", texto: erro.status === 404 ? "Pedido não encontrado." : erro.texto }} />}
      {!pedido && !erro && <p className="carregando">Carregando…</p>}
      {pedido && (
        <>
          <div className="cabecalho">
            <h1>Pedido nº {pedido.id}</h1>
            <Selo status={pedido.status} />
          </div>
          <MensagemAviso aviso={aviso} />
          <dl className="dados grade">
            <div><dt>Data de criação</dt><dd>{formatarData(pedido.criadoEm)}</dd></div>
            <div><dt>Cliente</dt><dd>{pedido.cliente.nome} ({pedido.cliente.email})</dd></div>
            <div><dt>Última atualização</dt><dd>{formatarData(pedido.atualizadoEm)}</dd></div>
          </dl>
          <div className="tabela-container">
            <table className="tabela">
              <thead>
                <tr><th>Peça</th><th>Quantidade</th><th>Preço unitário</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {pedido.itens.map((it) => (
                  <tr key={it.id}>
                    <td data-rotulo="Peça">
                      {it.produtoId !== null
                        ? <Link para={`/produtos/${it.produtoId}`} navegar={navegar}>{it.descricao}</Link>
                        : it.descricao}
                    </td>
                    <td data-rotulo="Quantidade">{it.quantidade}</td>
                    <td data-rotulo="Preço unitário">{formatarMoeda(it.precoUnitarioCentavos)}</td>
                    <td data-rotulo="Subtotal">{formatarMoeda(it.subtotalCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="total">Total: <strong>{formatarMoeda(pedido.totalCentavos)}</strong></p>

          <h2 className="subtitulo">Entrega</h2>
          {pedido.entrega
            ? <BlocoEndereco e={pedido.entrega} telefone={pedido.entrega.telefone} />
            : <p className="aviso-neutro">Este pedido não possui informações de entrega registradas (foi criado antes do cadastro de endereços).</p>}
          <p className="dica">Nome e preço unitário registrados no momento da compra.</p>

          {funcionario && (
            <form className="form-status" onSubmit={salvarStatus}>
              <div className="campo inline">
                <label htmlFor="status">Alterar status</label>
                <select id="status" value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as StatusPedido)}>
                  {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
                </select>
              </div>
              <button type="submit" className="botao compacto" disabled={enviando || novoStatus === pedido.status}>
                {enviando ? "Salvando…" : "Salvar status"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
