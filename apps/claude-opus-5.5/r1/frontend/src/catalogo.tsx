import { useEffect, useState, type FormEvent } from "react";
import {
  api, centavosParaTexto, formatarMoeda, type DadosProduto, type PaginaProdutos, type Produto, type Usuario,
} from "./api";
import { Campo, Link, MensagemAviso, useCarregar, useEnvio, type Navegar } from "./ui";

const CHAVES_FILTRO = ["q", "categoria", "tamanho", "precoMin", "precoMax", "ordem", "direcao"] as const;
type Filtros = Record<(typeof CHAVES_FILTRO)[number], string>;

function lerFiltros(busca: string): Filtros {
  const p = new URLSearchParams(busca);
  return Object.fromEntries(CHAVES_FILTRO.map((k) => [k, p.get(k) ?? ""])) as Filtros;
}

/** Monta a query string (somente com valores preenchidos) para a URL e para a API. */
function montarBusca(f: Filtros, pagina: number): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of CHAVES_FILTRO) if (f[k].trim()) p.set(k, f[k].trim());
  if (pagina > 1) p.set("pagina", String(pagina));
  return p;
}

function Estoque({ estoque }: { estoque: number }) {
  return estoque > 0
    ? <span className="estoque">{estoque} em estoque</span>
    : <span className="estoque esgotado">Sem estoque</span>;
}

/** Barra de pesquisa/filtros/ordenação. Os valores ficam na URL, então podem ser compartilhados e voltados. */
function BarraFiltros({ inicial, onAplicar }: { inicial: Filtros; onAplicar: (f: Filtros) => void }) {
  const [f, setF] = useState<Filtros>(inicial);
  const [opcoes, setOpcoes] = useState<{ categorias: string[]; tamanhos: string[] }>({ categorias: [], tamanhos: [] });
  useEffect(() => { setF(inicial); }, [inicial]);
  useEffect(() => { api.filtrosProdutos().then(setOpcoes).catch(() => undefined); }, []);
  const set = (k: keyof Filtros, v: string) => setF((a) => ({ ...a, [k]: v }));
  const ordenacao = `${f.ordem || "nome"}:${f.direcao || "asc"}`;
  const limpar = () => onAplicar(lerFiltros(""));

  return (
    <form className="filtros" role="search" onSubmit={(e) => { e.preventDefault(); onAplicar(f); }}>
      <div className="campo pesquisa">
        <label htmlFor="f-q">Pesquisar</label>
        <input id="f-q" type="search" value={f.q} maxLength={100} placeholder="Nome ou descrição"
          onChange={(e) => set("q", e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="f-cat">Categoria</label>
        <select id="f-cat" value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
          <option value="">Todas</option>
          {opcoes.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-tam">Tamanho</label>
        <select id="f-tam" value={f.tamanho} onChange={(e) => set("tamanho", e.target.value)}>
          <option value="">Todos</option>
          {opcoes.tamanhos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-min">Preço mínimo (R$)</label>
        <input id="f-min" inputMode="decimal" value={f.precoMin} placeholder="0,00" onChange={(e) => set("precoMin", e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="f-max">Preço máximo (R$)</label>
        <input id="f-max" inputMode="decimal" value={f.precoMax} placeholder="0,00" onChange={(e) => set("precoMax", e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="f-ord">Ordenar por</label>
        <select id="f-ord" value={ordenacao} onChange={(e) => {
          const [ordem = "nome", direcao = "asc"] = e.target.value.split(":");
          setF((a) => ({ ...a, ordem, direcao }));
        }}>
          <option value="nome:asc">Nome (A–Z)</option>
          <option value="nome:desc">Nome (Z–A)</option>
          <option value="preco:asc">Menor preço</option>
          <option value="preco:desc">Maior preço</option>
        </select>
      </div>
      <div className="filtros-acoes">
        <button type="submit" className="botao compacto">Aplicar</button>
        <button type="button" className="botao secundario compacto" onClick={limpar}>Limpar</button>
      </div>
    </form>
  );
}

function Paginacao({ dados, irPara }: { dados: PaginaProdutos; irPara: (p: number) => void }) {
  if (dados.totalPaginas <= 1) return null;
  return (
    <nav className="paginacao" aria-label="Paginação">
      <button type="button" className="botao secundario compacto" disabled={dados.pagina <= 1} onClick={() => irPara(dados.pagina - 1)}>
        ← Anterior
      </button>
      <span>Página {dados.pagina} de {dados.totalPaginas}</span>
      <button type="button" className="botao secundario compacto" disabled={dados.pagina >= dados.totalPaginas} onClick={() => irPara(dados.pagina + 1)}>
        Próxima →
      </button>
    </nav>
  );
}

/** Lógica comum do catálogo público e do painel de produtos: filtros e página vêm da URL. */
function useCatalogo(caminho: string, busca: string, navegar: Navegar) {
  const filtros = lerFiltros(busca);
  const pagina = Math.max(1, Number(new URLSearchParams(busca).get("pagina")) || 1);
  const consulta = montarBusca(filtros, pagina);
  const r = useCarregar(() => api.listarProdutos(consulta), [consulta.toString()]);
  const ir = (f: Filtros, p: number) => {
    const qs = montarBusca(f, p).toString();
    navegar(qs ? `${caminho}?${qs}` : caminho);
  };
  // Mantém a referência estável enquanto a URL não muda (evita resetar o formulário a cada render).
  const [inicial, setInicial] = useState(filtros);
  useEffect(() => { setInicial(lerFiltros(busca)); }, [busca]);
  return { ...r, inicial, aplicar: (f: Filtros) => ir(f, 1), irPara: (p: number) => ir(filtros, p) };
}

export function Catalogo({ busca, navegar }: { busca: string; navegar: Navegar }) {
  const { dados, erro, inicial, aplicar, irPara } = useCatalogo("/catalogo", busca, navegar);
  return (
    <section className="cartao largo">
      <h1>Catálogo</h1>
      <BarraFiltros inicial={inicial} onAplicar={aplicar} />
      <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro.texto } : null} />
      {!dados && !erro && <p className="carregando">Carregando…</p>}
      {dados && (
        <>
          <p className="dica" aria-live="polite">{dados.total} produto(s) encontrado(s).</p>
          {dados.produtos.length === 0 && <p>Nenhum produto corresponde aos critérios informados.</p>}
          <ul className="grade-produtos">
            {dados.produtos.map((p) => (
              <li key={p.id} className="produto-cartao">
                <span className="produto-categoria">{p.categoria} · Tam. {p.tamanho}</span>
                <h2><Link para={`/produtos/${p.id}`} navegar={navegar}>{p.nome}</Link></h2>
                <p className="produto-preco">{formatarMoeda(p.precoCentavos)}</p>
                <Estoque estoque={p.estoque} />
              </li>
            ))}
          </ul>
          <Paginacao dados={dados} irPara={irPara} />
        </>
      )}
    </section>
  );
}

export function DetalheProduto({ id, usuario, navegar }: { id: number; usuario: Usuario | null; navegar: Navegar }) {
  const { dados, erro } = useCarregar(() => api.buscarProduto(id), [id]);
  const p: Produto | undefined = dados?.produto;
  return (
    <section className="cartao">
      <p><Link para="/catalogo" navegar={navegar}>← Voltar ao catálogo</Link></p>
      {erro && <MensagemAviso aviso={{ tipo: "erro", texto: erro.status === 404 ? "Produto não encontrado." : erro.texto }} />}
      {!p && !erro && <p className="carregando">Carregando…</p>}
      {p && (
        <>
          <h1>{p.nome}</h1>
          <p className="produto-preco grande">{formatarMoeda(p.precoCentavos)}</p>
          <dl className="dados grade">
            <div><dt>Categoria</dt><dd>{p.categoria}</dd></div>
            <div><dt>Tamanho</dt><dd>{p.tamanho}</dd></div>
            <div><dt>Disponibilidade</dt><dd><Estoque estoque={p.estoque} /></dd></div>
            <div><dt>Código</dt><dd>{p.id}</dd></div>
          </dl>
          <h2 className="subtitulo">Descrição</h2>
          {/* Renderizado como texto (React escapa o conteúdo); quebras de linha preservadas via CSS. */}
          <p className="descricao-texto">{p.descricao || "Sem descrição."}</p>
          <div className="acoes">
            {usuario?.perfil === "cliente" && p.estoque > 0 && (
              <Link para={`/pedidos/novo?produto=${p.id}`} navegar={navegar} className="botao compacto">Pedir este produto</Link>
            )}
            {!usuario && <p className="dica"><Link para="/entrar" navegar={navegar}>Entre</Link> como cliente para fazer um pedido.</p>}
            {usuario?.perfil === "funcionario" && (
              <Link para={`/painel/produtos/${p.id}/editar`} navegar={navegar} className="botao secundario compacto">Editar produto</Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function PainelProdutos({ busca, navegar }: { busca: string; navegar: Navegar }) {
  const { dados, erro, inicial, aplicar, irPara } = useCatalogo("/painel/produtos", busca, navegar);
  return (
    <section className="cartao largo">
      <div className="cabecalho">
        <h1>Produtos</h1>
        <Link para="/painel/produtos/novo" navegar={navegar} className="botao compacto">Cadastrar produto</Link>
      </div>
      <BarraFiltros inicial={inicial} onAplicar={aplicar} />
      <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro.texto } : null} />
      {!dados && !erro && <p className="carregando">Carregando…</p>}
      {dados && dados.produtos.length === 0 && <p>Nenhum produto encontrado.</p>}
      {dados && dados.produtos.length > 0 && (
        <div className="tabela-container">
          <table className="tabela">
            <thead>
              <tr><th>Cód.</th><th>Nome</th><th>Categoria</th><th>Tamanho</th><th>Preço</th><th>Estoque</th><th><span className="sr-only">Ações</span></th></tr>
            </thead>
            <tbody>
              {dados.produtos.map((p) => (
                <tr key={p.id}>
                  <td data-rotulo="Cód.">{p.id}</td>
                  <td data-rotulo="Nome">{p.nome}</td>
                  <td data-rotulo="Categoria">{p.categoria}</td>
                  <td data-rotulo="Tamanho">{p.tamanho}</td>
                  <td data-rotulo="Preço">{formatarMoeda(p.precoCentavos)}</td>
                  <td data-rotulo="Estoque">{p.estoque}</td>
                  <td><Link para={`/painel/produtos/${p.id}/editar`} navegar={navegar}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dados && <Paginacao dados={dados} irPara={irPara} />}
    </section>
  );
}

const vazio: DadosProduto = { nome: "", descricao: "", categoria: "", tamanho: "", preco: "", estoque: "0" };

export function FormProduto({ id, navegar }: { id?: number; navegar: Navegar }) {
  const [d, setD] = useState<DadosProduto>(vazio);
  const [carregado, setCarregado] = useState(id === undefined);
  const [erroCarga, setErroCarga] = useState("");
  const [opcoes, setOpcoes] = useState<{ categorias: string[]; tamanhos: string[] }>({ categorias: [], tamanhos: [] });
  const { enviando, erro, campos, enviar } = useEnvio();

  useEffect(() => { api.filtrosProdutos().then(setOpcoes).catch(() => undefined); }, []);
  useEffect(() => {
    if (id === undefined) return;
    api.buscarProduto(id).then(({ produto: p }) => {
      setD({ nome: p.nome, descricao: p.descricao, categoria: p.categoria, tamanho: p.tamanho,
        preco: centavosParaTexto(p.precoCentavos), estoque: String(p.estoque) });
      setCarregado(true);
    }).catch((e: Error) => setErroCarga(e.message));
  }, [id]);

  const set = (k: keyof DadosProduto) => (v: string) => setD((a) => ({ ...a, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => {
      const { produto } = id === undefined ? await api.criarProduto(d) : await api.atualizarProduto(id, d);
      navegar("/painel/produtos", {
        aviso: { tipo: "sucesso", texto: `Produto "${produto.nome}" ${id === undefined ? "cadastrado" : "atualizado"} com sucesso.` },
      });
    });
  };

  return (
    <section className="cartao">
      <p><Link para="/painel/produtos" navegar={navegar}>← Voltar aos produtos</Link></p>
      <h1>{id === undefined ? "Cadastrar produto" : `Editar produto nº ${id}`}</h1>
      {erroCarga && <MensagemAviso aviso={{ tipo: "erro", texto: erroCarga }} />}
      {!carregado && !erroCarga && <p className="carregando">Carregando…</p>}
      {carregado && (
        <form onSubmit={submit} noValidate>
          <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : null} />
          <Campo id="nome" rotulo="Nome" valor={d.nome} onChange={set("nome")} erro={campos.nome} autoComplete="off" />
          <div className="campo">
            <label htmlFor="descricao">Descrição</label>
            <textarea id="descricao" rows={5} maxLength={2000} value={d.descricao} aria-invalid={!!campos.descricao}
              onChange={(e) => set("descricao")(e.target.value)} />
            <small className="dica">Texto simples (sem formatação). Máximo de 2000 caracteres.</small>
            {campos.descricao && <small className="erro-campo">{campos.descricao}</small>}
          </div>
          <div className="grade-2">
            <Campo id="categoria" rotulo="Categoria" valor={d.categoria} onChange={set("categoria")} erro={campos.categoria}
              autoComplete="off" lista="lista-categorias" />
            <Campo id="tamanho" rotulo="Tamanho" valor={d.tamanho} onChange={set("tamanho")} erro={campos.tamanho}
              autoComplete="off" lista="lista-tamanhos" dica="Ex.: P, M, G, 40, Único" />
            <Campo id="preco" rotulo="Preço (R$)" valor={d.preco} onChange={set("preco")} erro={campos.preco}
              autoComplete="off" modoEntrada="decimal" dica="Ex.: 59,90" />
            <Campo id="estoque" rotulo="Quantidade em estoque" tipo="number" valor={d.estoque} onChange={set("estoque")}
              erro={campos.estoque} autoComplete="off" modoEntrada="numeric" />
          </div>
          <datalist id="lista-categorias">{opcoes.categorias.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="lista-tamanhos">{opcoes.tamanhos.map((t) => <option key={t} value={t} />)}</datalist>
          <button type="submit" className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Salvar produto"}</button>
        </form>
      )}
    </section>
  );
}
