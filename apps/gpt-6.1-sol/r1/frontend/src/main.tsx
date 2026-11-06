import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, type User } from './api';
import { Workspace } from './Orders';
import { Catalog } from './Catalog';
import './style.css';

function App() {
  const [path, setPath] = useState(location.pathname);
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState(location.pathname === '/cadastro' ? 'register' : 'login');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function navigate(next: string) {
    setPage(next); setError(''); setNotice('');
    history.pushState({}, '', next === 'register' ? '/cadastro' : '/login');
    setPath(location.pathname);
  }
  function expired() { setUser(null); navigate('login'); setError('Sua sessão terminou. Entre novamente.'); }
  useEffect(() => {
    let active = true;
    api('me').then(data => {
      if (!active) return;
      setUser(data.user);
      if (['/login', '/cadastro'].includes(location.pathname)) { history.replaceState({}, '', '/minha-conta'); setPath('/minha-conta'); }
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    const pop = () => { setPath(location.pathname); setPage(location.pathname === '/cadastro' ? 'register' : 'login'); setError(''); setNotice(''); };
    addEventListener('popstate', pop);
    return () => { active = false; removeEventListener('popstate', pop); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api(page, { name: form.get('name'), email: form.get('email'), password: form.get('password') });
      if (page === 'register') { navigate('login'); setNotice('Conta criada com sucesso! Entre com seu e-mail e senha.'); }
      else { history.replaceState({}, '', '/minha-conta'); setPath('/minha-conta'); setUser(result.user); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await api('logout', {}); setUser(null); navigate('login'); setNotice('Você saiu da sua conta.'); }
    catch { setError('Não foi possível sair. Verifique sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  const register = page === 'register';
  const publicCatalog = path === '/' || path === '/produtos' || /^\/produtos\/\d+$/.test(path);
  return <>
    <header><a className="brand" href="/">VesteBem<span>MODA PARA O SEU DIA</span></a><span className="header-label">Seu espaço, seu estilo.</span></header>
    <main className={publicCatalog ? 'public-catalog' : user ? 'authenticated' : ''}>
      <aside><span className="eyebrow">BEM-VINDO À VESTEBEM</span><h1>Vista o que<br/>faz você<br/><em>se sentir bem.</em></h1><p>O seu estilo começa com você.<br/>E o seu espaço aqui também.</p><div className="art" aria-hidden="true"><div className="arch"/><div className="line"/><span>VB.</span></div><small>Simples. Essencial. Do seu jeito.</small></aside>
      <section className="panel" aria-label="Área da conta">
        {publicCatalog ? <Catalog user={user}/> : loading ? <p role="status">Carregando sua conta…</p> : user ? <div className="workspace-container">{error && <p className="error" role="alert">{error}</p>}<Workspace user={user} logout={logout} expired={expired} onName={name => setUser(current => current ? { ...current, name } : null)} passwordChanged={() => { setUser(null); navigate('login'); setNotice('Senha alterada. Entre novamente com sua nova senha.'); }}/></div> : <div className="form-wrap">
          <div className="tabs"><button className={!register ? 'active' : ''} onClick={() => navigate('login')} disabled={busy}>Entrar</button><button className={register ? 'active' : ''} onClick={() => navigate('register')} disabled={busy}>Criar conta</button></div>
          <span className="eyebrow">{register ? 'VAMOS COMEÇAR' : 'BOM TER VOCÊ DE VOLTA'}</span><h2>{register ? 'Seu estilo. Sua conta.' : 'Entre na sua conta'}</h2><p className="intro">{register ? 'Crie seu espaço na VesteBem.' : 'Um espaço feito para você se sentir em casa.'}</p>
          {notice && <p className="notice" role="status">{notice}</p>}
          <form key={page} onSubmit={submit}>
            {register && <label>Nome<input name="name" autoComplete="name" placeholder="Como podemos chamar você?" required minLength={2} maxLength={100} disabled={busy}/></label>}
            <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254} disabled={busy}/></label>
            <label>Senha<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'Crie uma senha segura' : 'Digite sua senha'} required minLength={register ? 8 : 1} maxLength={128} disabled={busy}/></label>
            {register && <small className="hint">Use de 8 a 128 caracteres.</small>}{error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>{busy ? 'Aguarde…' : register ? 'Criar minha conta' : 'Entrar'}<span aria-hidden="true">→</span></button>
          </form>
          <p className="switch">{register ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button disabled={busy} onClick={() => navigate(register ? 'login' : 'register')}>{register ? 'Entrar' : 'Cadastre-se'}</button></p><p className="footnote">Seu próximo capítulo começa com você.</p>
        </div>}
      </section>
    </main>
    <footer><span>© {new Date().getFullYear()} VesteBem</span><span>Feita para vestir a sua essência.</span></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
