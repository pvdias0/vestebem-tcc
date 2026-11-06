import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ApiError, formatarCep, formatarTelefone, ROTULO_STATUS, type Endereco, type StatusPedido } from "./api";

export type Aviso = { tipo: "sucesso" | "erro"; texto: string } | null;
export type Navegar = (rota: string, opcoes?: { replace?: boolean; aviso?: Aviso }) => void;

export function Link({ para, navegar, children, className }: { para: string; navegar: Navegar; children: ReactNode; className?: string }) {
  const onClick = (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navegar(para);
  };
  return <a href={para} onClick={onClick} className={className}>{children}</a>;
}

export function Campo(props: {
  id: string; rotulo: string; tipo?: string; valor: string; erro?: string;
  autoComplete: string; onChange: (v: string) => void; dica?: string;
  lista?: string; modoEntrada?: "decimal" | "numeric"; obrigatorio?: boolean;
}) {
  return (
    <div className="campo">
      <label htmlFor={props.id}>{props.rotulo}</label>
      <input
        id={props.id} name={props.id} type={props.tipo ?? "text"} value={props.valor} required={props.obrigatorio ?? true}
        autoComplete={props.autoComplete} list={props.lista} inputMode={props.modoEntrada} aria-invalid={!!props.erro}
        aria-describedby={props.erro ? `${props.id}-erro` : undefined}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.dica && !props.erro && <small className="dica">{props.dica}</small>}
      {props.erro && <small className="erro-campo" id={`${props.id}-erro`}>{props.erro}</small>}
    </div>
  );
}

export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const enviar = async (fn: () => Promise<void>) => {
    setEnviando(true); setErro(""); setCampos({});
    try { await fn(); } catch (e) {
      if (e instanceof ApiError) { setErro(e.message); setCampos(e.campos); } else setErro("Erro inesperado.");
    } finally { setEnviando(false); }
  };
  return { enviando, erro, campos, enviar, setErro };
}

export function Selo({ status }: { status: StatusPedido }) {
  return <span className={`selo selo-${status}`}>{ROTULO_STATUS[status]}</span>;
}

export function MensagemAviso({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return <p className={aviso.tipo === "erro" ? "alerta" : "sucesso"} role={aviso.tipo === "erro" ? "alert" : "status"}>{aviso.texto}</p>;
}

/** Carrega dados do backend. Em 401, chama onSessaoExpirada (se informado). */
export function useCarregar<T>(fn: () => Promise<T>, deps: unknown[], onSessaoExpirada?: () => void) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<{ status: number; texto: string } | null>(null);
  useEffect(() => {
    let ativo = true;
    setErro(null);
    fn().then((d) => { if (ativo) setDados(d); }).catch((e: unknown) => {
      if (!ativo) return;
      if (e instanceof ApiError && e.status === 401) onSessaoExpirada?.();
      setErro({ status: e instanceof ApiError ? e.status : 0, texto: e instanceof Error ? e.message : "Erro inesperado." });
    });
    return () => { ativo = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { dados, setDados, erro };
}

/** Exibe um endereço de entrega (da conta ou copiado no pedido). */
export function BlocoEndereco({ e, telefone }: { e: Endereco; telefone?: string | null }) {
  return (
    <address className="endereco">
      <strong>{e.destinatario}</strong><br />
      {e.logradouro}, {e.numero}{e.complemento ? ` — ${e.complemento}` : ""}<br />
      {e.bairro} — {e.cidade}/{e.uf}<br />
      CEP {formatarCep(e.cep)}
      {telefone && <><br />Telefone: {formatarTelefone(telefone)}</>}
    </address>
  );
}
