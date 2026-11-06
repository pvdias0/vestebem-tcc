import { useEffect, useState, type FormEvent } from "react";
import {
  api, ApiError, formatarCep, formatarCpf, formatarTelefone, UFS,
  type Endereco, type EnderecoForm, type MinhaContaDados, type Usuario,
} from "./api";
import { BlocoEndereco, Campo, Link, MensagemAviso, useEnvio, type Aviso, type Navegar } from "./ui";

export function Cadastro({ onSucesso, navegar }: { onSucesso: (u: Usuario) => void; navegar: Navegar }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const { enviando, erro, campos, enviar } = useEnvio();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => onSucesso((await api.cadastro(nome, email, senha)).usuario));
  };

  return (
    <section className="cartao estreito">
      <h1>Criar conta</h1>
      <form onSubmit={submit} noValidate>
        <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : null} />
        <Campo id="nome" rotulo="Nome" valor={nome} onChange={setNome} erro={campos.nome} autoComplete="name" />
        <Campo id="email" rotulo="E-mail" tipo="email" valor={email} onChange={setEmail} erro={campos.email} autoComplete="email" />
        <Campo id="senha" rotulo="Senha" tipo="password" valor={senha} onChange={setSenha} erro={campos.senha}
          autoComplete="new-password" dica="Mínimo de 8 caracteres." />
        <button type="submit" className="botao" disabled={enviando}>{enviando ? "Cadastrando…" : "Cadastrar"}</button>
      </form>
      <p className="alternativa">Já tem conta? <Link para="/entrar" navegar={navegar}>Entrar</Link></p>
    </section>
  );
}

export function Login({ onSucesso, navegar }: { onSucesso: (u: Usuario) => void; navegar: Navegar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const { enviando, erro, enviar } = useEnvio();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => onSucesso((await api.login(email, senha)).usuario));
  };

  return (
    <section className="cartao estreito">
      <h1>Entrar</h1>
      <form onSubmit={submit}>
        <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : null} />
        <Campo id="email" rotulo="E-mail" tipo="email" valor={email} onChange={setEmail} autoComplete="email" />
        <Campo id="senha" rotulo="Senha" tipo="password" valor={senha} onChange={setSenha} autoComplete="current-password" />
        <button type="submit" className="botao" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="alternativa">Ainda não tem conta? <Link para="/cadastro" navegar={navegar}>Cadastre-se</Link></p>
    </section>
  );
}

const enderecoVazio: EnderecoForm = {
  destinatario: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};
const paraForm = (e: Endereco): EnderecoForm => ({ ...e, cep: formatarCep(e.cep), complemento: e.complemento ?? "" });

export function MinhaConta({ onSair, onAtualizado, onSessaoExpirada }: {
  onSair: () => void; onAtualizado: (u: Usuario) => void; onSessaoExpirada: () => void;
}) {
  const [conta, setConta] = useState<MinhaContaDados | null>(null);
  const [endereco, setEndereco] = useState<Endereco | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const saida = useEnvio();

  // Dados sempre lidos do backend, apenas da conta da sessão atual.
  useEffect(() => {
    api.minhaConta().then((r) => { setConta(r.usuario); setEndereco(r.endereco); }).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onSessaoExpirada();
      else setErroCarga(e instanceof Error ? e.message : "Erro ao carregar a conta.");
    });
  }, [onSessaoExpirada]);

  if (erroCarga) return <section className="cartao"><MensagemAviso aviso={{ tipo: "erro", texto: erroCarga }} /></section>;
  if (!conta) return <p className="carregando">Carregando…</p>;

  return (
    <div className="pilha">
      <section className="cartao">
        <h1>Minha conta</h1>
        <dl className="dados grade">
          <div><dt>E-mail</dt><dd>{conta.email}</dd></div>
          <div><dt>Perfil</dt><dd>{conta.perfil === "funcionario" ? "Funcionário" : "Cliente"}</dd></div>
        </dl>
        <MensagemAviso aviso={saida.erro ? { tipo: "erro", texto: saida.erro } : null} />
        <button type="button" className="botao secundario compacto" disabled={saida.enviando}
          onClick={() => void saida.enviar(async () => { await api.logout(); onSair(); })}>
          {saida.enviando ? "Saindo…" : "Sair da conta"}
        </button>
      </section>

      <FormDados conta={conta} onSalvo={(u) => { setConta(u); onAtualizado(u); }} />
      {conta.perfil === "cliente" && <FormEndereco endereco={endereco} nomePadrao={conta.nome} onSalvo={setEndereco} />}
      <FormSenha />
    </div>
  );
}

function FormDados({ conta, onSalvo }: { conta: MinhaContaDados; onSalvo: (u: MinhaContaDados) => void }) {
  const [nome, setNome] = useState(conta.nome);
  const [cpf, setCpf] = useState(conta.cpf ? formatarCpf(conta.cpf) : "");
  const [telefone, setTelefone] = useState(conta.telefone ? formatarTelefone(conta.telefone) : "");
  const [aviso, setAviso] = useState<Aviso>(null);
  const { enviando, erro, campos, enviar } = useEnvio();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    void enviar(async () => {
      const { usuario } = await api.salvarDados({ nome, cpf, telefone });
      setNome(usuario.nome);
      setCpf(usuario.cpf ? formatarCpf(usuario.cpf) : "");
      setTelefone(usuario.telefone ? formatarTelefone(usuario.telefone) : "");
      onSalvo(usuario);
      setAviso({ tipo: "sucesso", texto: "Dados pessoais atualizados." });
    });
  };

  return (
    <section className="cartao">
      <h2 className="subtitulo topo-secao">Dados pessoais</h2>
      <form onSubmit={submit} noValidate>
        <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : aviso} />
        <Campo id="nome" rotulo="Nome" valor={nome} onChange={setNome} erro={campos.nome} autoComplete="name" />
        <div className="grade-2">
          <Campo id="cpf" rotulo="CPF (opcional)" valor={cpf} onChange={setCpf} erro={campos.cpf} autoComplete="off"
            modoEntrada="numeric" dica="Visível apenas para você." obrigatorio={false} />
          <Campo id="telefone" rotulo="Telefone" tipo="tel" valor={telefone} onChange={setTelefone} erro={campos.telefone}
            autoComplete="tel" dica="Com DDD. Necessário para finalizar pedidos." obrigatorio={false} />
        </div>
        <button type="submit" className="botao compacto" disabled={enviando}>{enviando ? "Salvando…" : "Salvar dados"}</button>
      </form>
    </section>
  );
}

function FormEndereco({ endereco, nomePadrao, onSalvo }: { endereco: Endereco | null; nomePadrao: string; onSalvo: (e: Endereco) => void }) {
  const [editando, setEditando] = useState(!endereco);
  const [f, setF] = useState<EnderecoForm>(endereco ? paraForm(endereco) : { ...enderecoVazio, destinatario: nomePadrao });
  const [aviso, setAviso] = useState<Aviso>(null);
  const { enviando, erro, campos, enviar } = useEnvio();
  const set = (k: keyof EnderecoForm) => (v: string) => setF((a) => ({ ...a, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    void enviar(async () => {
      const r = await api.salvarEndereco(f);
      onSalvo(r.endereco);
      setF(paraForm(r.endereco));
      setEditando(false);
      setAviso({ tipo: "sucesso", texto: endereco ? "Endereço atualizado." : "Endereço cadastrado." });
    });
  };

  return (
    <section className="cartao">
      <h2 className="subtitulo topo-secao">Endereço de entrega</h2>
      <MensagemAviso aviso={aviso} />
      {!editando && endereco && (
        <>
          <BlocoEndereco e={endereco} />
          <button type="button" className="botao secundario compacto" onClick={() => { setEditando(true); setAviso(null); }}>Alterar endereço</button>
        </>
      )}
      {editando && (
        <form onSubmit={submit} noValidate>
          {!endereco && <p className="dica">Cadastre um endereço para poder finalizar pedidos.</p>}
          <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : null} />
          <Campo id="destinatario" rotulo="Destinatário" valor={f.destinatario} onChange={set("destinatario")} erro={campos.destinatario} autoComplete="shipping name" />
          <div className="grade-2">
            <Campo id="cep" rotulo="CEP" valor={f.cep} onChange={set("cep")} erro={campos.cep} autoComplete="shipping postal-code" modoEntrada="numeric" dica="Ex.: 01234-567" />
            <Campo id="numero" rotulo="Número" valor={f.numero} onChange={set("numero")} erro={campos.numero} autoComplete="off" dica='Use "s/n" se não houver.' />
          </div>
          <Campo id="logradouro" rotulo="Logradouro" valor={f.logradouro} onChange={set("logradouro")} erro={campos.logradouro} autoComplete="shipping address-line1" />
          <Campo id="complemento" rotulo="Complemento (opcional)" valor={f.complemento} onChange={set("complemento")} erro={campos.complemento} autoComplete="shipping address-line2" obrigatorio={false} />
          <div className="grade-2">
            <Campo id="bairro" rotulo="Bairro" valor={f.bairro} onChange={set("bairro")} erro={campos.bairro} autoComplete="off" />
            <Campo id="cidade" rotulo="Cidade" valor={f.cidade} onChange={set("cidade")} erro={campos.cidade} autoComplete="shipping address-level2" />
            <div className="campo">
              <label htmlFor="uf">Estado</label>
              <select id="uf" value={f.uf} onChange={(e) => set("uf")(e.target.value)} aria-invalid={!!campos.uf}>
                <option value="">Selecione</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {campos.uf && <small className="erro-campo">{campos.uf}</small>}
            </div>
          </div>
          <div className="acoes">
            <button type="submit" className="botao compacto" disabled={enviando}>{enviando ? "Salvando…" : "Salvar endereço"}</button>
            {endereco && (
              <button type="button" className="botao secundario compacto" onClick={() => { setEditando(false); setF(paraForm(endereco)); }}>Cancelar</button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function FormSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState("");
  const { enviando, erro, campos, enviar } = useEnvio();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    setErroConfirmacao("");
    if (nova !== confirmacao) { setErroConfirmacao("A confirmação não corresponde à nova senha."); return; }
    void enviar(async () => {
      await api.alterarSenha(atual, nova);
      setAtual(""); setNova(""); setConfirmacao("");
      setAviso({ tipo: "sucesso", texto: "Senha alterada. Use a nova senha nos próximos acessos; outras sessões abertas foram encerradas." });
    });
  };

  return (
    <section className="cartao">
      <h2 className="subtitulo topo-secao">Alterar senha</h2>
      <form onSubmit={submit} noValidate>
        <MensagemAviso aviso={erro ? { tipo: "erro", texto: erro } : aviso} />
        <Campo id="senha-atual" rotulo="Senha atual" tipo="password" valor={atual} onChange={setAtual} erro={campos.senhaAtual} autoComplete="current-password" />
        <div className="grade-2">
          <Campo id="senha-nova" rotulo="Nova senha" tipo="password" valor={nova} onChange={setNova} erro={campos.novaSenha}
            autoComplete="new-password" dica="Mínimo de 8 caracteres." />
          <Campo id="senha-confirmacao" rotulo="Confirme a nova senha" tipo="password" valor={confirmacao} onChange={setConfirmacao}
            erro={erroConfirmacao || undefined} autoComplete="new-password" />
        </div>
        <button type="submit" className="botao compacto" disabled={enviando}>{enviando ? "Alterando…" : "Alterar senha"}</button>
      </form>
    </section>
  );
}
