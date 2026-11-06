import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { Account, type User } from './Account';
import { Catalog } from './Catalog';
async function api(path: string, body?: object) {
 const response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
 const data = response.status === 204 ? {} : await response.json();
 if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a solicitação.');
 return data;
}
function App() {
 const isCatalog = location.pathname === '/' || location.pathname === '/catalogo' || location.pathname.startsWith('/produtos/') || location.pathname.startsWith('/gestao-produtos');
 const [user, setUser] = useState<User | null>(null);
 const [loading, setLoading] = useState(true);
 const [mode, setMode] = useState(location.pathname === '/cadastro' ? 'register' : 'login');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState(new URLSearchParams(location.search).get('senha') === 'alterada' ? 'Senha alterada. Entre novamente com a nova senha.' : '');
 useEffect(() => { fetch('/api/me').then(async res => { if (res.ok) { setUser(await res.json()); if (['/login', '/cadastro'].includes(location.pathname)) history.replaceState({}, '', '/minha-conta'); } else if (res.status !== 401) setError('Não foi possível carregar sua conta. Recarregue a página.'); }).catch(() => setError('Não foi possível conectar ao servidor. Recarregue a página.')).finally(() => setLoading(false)); }, []);
 useEffect(() => { const listener = () => { setMode(location.pathname === '/cadastro' ? 'register' : 'login'); setError(''); setNotice(''); }; window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, []);
 function switchMode(next: string) { setMode(next); setError(''); setNotice(''); history.pushState({}, '', next === 'register' ? '/cadastro' : '/login'); }
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setBusy(true); setError(''); setNotice('');
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try { if (mode === 'register') { await api('register', values); switchMode('login'); setNotice('Conta criada! Entre para acessar sua conta.'); form.reset(); } else { await api('login', values); setUser(await api('me')); history.pushState({}, '', '/minha-conta'); } }
  catch (err) { setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.'); } finally { setBusy(false); }
 }
 async function logout() { setBusy(true); setError(''); try { await api('logout', {}); setUser(null); switchMode('login'); setNotice('Você saiu da sua conta.'); } catch { setError('Não foi possível sair. Tente novamente.'); } finally { setBusy(false); } }
 return <><header><a className="brand" href="/">VesteBem<span>ROUPAS & BEM-ESTAR</span></a><nav className="header-nav" aria-label="Navegação principal"><a href="/catalogo">Catálogo</a><a href="/minha-conta">Minha conta</a></nav></header><main><aside><span className="eyebrow">BEM-VINDO À VESTEBEM</span><h1>Vista o que<br/>faz você<br/><em>se sentir bem.</em></h1><p>Um espaço para cuidar da sua conta<br/>com simplicidade e segurança.</p><div className="art" aria-hidden="true"><div className="arch"/><div className="line"/><span>VB</span></div><small>ESSENCIAL É SER VOCÊ.</small></aside><section className="panel" aria-labelledby="title">{loading ? <p role="status">Carregando sua conta…</p> : <div className="card">{isCatalog ? <Catalog user={user}/> : user ? <Account user={user} logout={logout} busy={busy} error={error}/> : <><span className="eyebrow">SUA CONTA VESTEBEM</span><h2 id="title">{mode === 'register' ? 'Crie sua conta' : 'Bom te ver de novo.'}</h2><p className="subtitle">{mode === 'register' ? 'Preencha seus dados para começar.' : 'Entre para acessar seu espaço.'}</p><nav aria-label="Acesso à conta"><button className={mode === 'login' ? 'active' : ''} disabled={busy} onClick={() => switchMode('login')}>Entrar</button><button className={mode === 'register' ? 'active' : ''} disabled={busy} onClick={() => switchMode('register')}>Criar conta</button></nav>{notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}<form key={mode} onSubmit={submit}>{mode === 'register' && <label>Nome<input name="name" autoComplete="name" placeholder="Como podemos te chamar?" required minLength={2} maxLength={100}/></label>}<label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254}/></label><label>Senha<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'Crie uma senha segura' : 'Digite sua senha'} required minLength={mode === 'register' ? 8 : 1} maxLength={128}/></label>{mode === 'register' && <small className="hint">Use de 8 a 128 caracteres.</small>}<button className="submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'register' ? 'Criar minha conta' : 'Entrar na minha conta'}<span aria-hidden="true">→</span></button></form><p className="switch">{mode === 'register' ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button disabled={busy} onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Entre aqui' : 'Cadastre-se'}</button></p><div className="secure">◈ &nbsp; Seus dados ficam protegidos.</div></>}</div>}</section></main><footer><span>© {new Date().getFullYear()} VesteBem</span><span>Feito para você se sentir bem.</span></footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
