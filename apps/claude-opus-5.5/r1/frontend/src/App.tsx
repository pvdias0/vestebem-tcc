import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type Usuario } from "./api";
import { Catalogo, DetalheProduto, FormProduto, PainelProdutos } from "./catalogo";
import { Cadastro, Login, MinhaConta } from "./conta";
import { DetalhePedido, MeusPedidos, NovoPedido, PainelPedidos } from "./pedidos";
import { Link, MensagemAviso, type Aviso, type Navegar } from "./ui";

const inicioPara = (u: Usuario | null) => (u?.perfil === "funcionario" ? "/painel" : u ? "/meus-pedidos" : "/catalogo");
const local = () => ({ caminho: window.location.pathname, busca: window.location.search });

const SO_VISITANTE = ["/entrar", "/cadastro"];
const PUBLICAS = /^\/(catalogo|produtos\/\d+)$/;
const SO_CLIENTE = ["/meus-pedidos", "/pedidos/novo"];
const SO_FUNCIONARIO = /^\/painel(\/.*)?$/;

export function App() {
  const [{ caminho, busca }, setLocal] = useState(local);
  // undefined = carregando; null = visitante
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [aviso, setAviso] = useState<Aviso>(null);

  const navegar: Navegar = useCallback((r, opcoes = {}) => {
    if (opcoes.replace) window.history.replaceState(null, "", r);
    else window.history.pushState(null, "", r);
    setLocal(local());
    setAviso(opcoes.aviso ?? null);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPop = () => { setLocal(local()); setAviso(null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    api.minhaConta().then((r) => setUsuario(r.usuario)).catch(() => setUsuario(null));
  }, []);

  const sessaoExpirada = useCallback(() => {
    setUsuario(null);
    navegar("/entrar", { replace: true, aviso: { tipo: "erro", texto: "Sua sessão terminou. Entre novamente." } });
  }, [navegar]);

  // Redirecionamentos conforme autenticação e perfil.
  const publica = PUBLICAS.test(caminho);
  const destino: string | null =
    usuario === undefined ? null
    : caminho === "/" ? inicioPara(usuario)
    : publica ? null
    : !usuario ? (SO_VISITANTE.includes(caminho) ? null : "/entrar")
    : SO_VISITANTE.includes(caminho) ? inicioPara(usuario)
    : (SO_FUNCIONARIO.test(caminho) && usuario.perfil !== "funcionario") ? inicioPara(usuario)
    : (SO_CLIENTE.includes(caminho) && usuario.perfil !== "cliente") ? inicioPara(usuario)
    : null;

  useEffect(() => {
    if (destino) navegar(destino, { replace: true, aviso });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino, navegar]);

  const entrou = (u: Usuario) => { setUsuario(u); navegar(inicioPara(u), { replace: true }); };
  const saiu = () => { setUsuario(null); navegar("/entrar", { replace: true, aviso: { tipo: "sucesso", texto: "Você saiu da sua conta." } }); };

  const idPedido = /^\/pedidos\/(\d+)$/.exec(caminho)?.[1];
  const idProduto = /^\/produtos\/(\d+)$/.exec(caminho)?.[1];
  const idEdicao = /^\/painel\/produtos\/(\d+)\/editar$/.exec(caminho)?.[1];
  const produtoInicial = Number(new URLSearchParams(busca).get("produto")) || undefined;

  let conteudo: ReactNode;
  if (usuario === undefined || destino) conteudo = <p className="carregando">Carregando…</p>;
  else if (caminho === "/catalogo") conteudo = <Catalogo busca={busca} navegar={navegar} />;
  else if (idProduto) conteudo = <DetalheProduto key={idProduto} id={Number(idProduto)} usuario={usuario} navegar={navegar} />;
  else if (!usuario) conteudo = caminho === "/cadastro"
    ? <Cadastro onSucesso={entrou} navegar={navegar} />
    : <Login onSucesso={entrou} navegar={navegar} />;
  else if (caminho === "/minha-conta") conteudo = <MinhaConta onSair={saiu} onAtualizado={(u) => setUsuario({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil })} onSessaoExpirada={sessaoExpirada} />;
  else if (caminho === "/meus-pedidos") conteudo = <MeusPedidos navegar={navegar} onSessaoExpirada={sessaoExpirada} />;
  else if (caminho === "/pedidos/novo") conteudo = <NovoPedido key={busca} navegar={navegar} produtoInicial={produtoInicial} />;
  else if (caminho === "/painel") conteudo = <PainelPedidos navegar={navegar} onSessaoExpirada={sessaoExpirada} />;
  else if (caminho === "/painel/produtos") conteudo = <PainelProdutos busca={busca} navegar={navegar} />;
  else if (caminho === "/painel/produtos/novo") conteudo = <FormProduto key="novo" navegar={navegar} />;
  else if (idEdicao) conteudo = <FormProduto key={idEdicao} id={Number(idEdicao)} navegar={navegar} />;
  else if (idPedido) conteudo = <DetalhePedido key={idPedido} id={Number(idPedido)} usuario={usuario} navegar={navegar} onSessaoExpirada={sessaoExpirada} />;
  else conteudo = (
    <section className="cartao estreito">
      <h1>Página não encontrada</h1>
      <p><Link para={inicioPara(usuario)} navegar={navegar}>Ir para o início</Link></p>
    </section>
  );

  const links: [string, string][] = !usuario
    ? [["/catalogo", "Catálogo"], ["/entrar", "Entrar"], ["/cadastro", "Criar conta"]]
    : usuario.perfil === "funcionario"
      ? [["/catalogo", "Catálogo"], ["/painel", "Pedidos"], ["/painel/produtos", "Produtos"], ["/minha-conta", "Minha conta"]]
      : [["/catalogo", "Catálogo"], ["/meus-pedidos", "Meus pedidos"], ["/pedidos/novo", "Novo pedido"], ["/minha-conta", "Minha conta"]];

  return (
    <>
      <header className="topo">
        <div className="topo-conteudo">
          <Link para="/catalogo" navegar={navegar} className="marca">VesteBem</Link>
          {usuario !== undefined && (
            <nav className="menu" aria-label="Navegação principal">
              {links.map(([para, rotulo]) => (
                <Link key={para} para={para} navegar={navegar} className={caminho === para ? "ativo" : undefined}>{rotulo}</Link>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="principal">
        <div className="conteudo">
          <MensagemAviso aviso={aviso} />
          {conteudo}
        </div>
      </main>
      <footer className="rodape">© {new Date().getFullYear()} VesteBem</footer>
    </>
  );
}
