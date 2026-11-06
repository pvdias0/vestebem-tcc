import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { OrderStatus, Role, Shipping } from './api';
import { useAuth } from './auth';
import { formatCep, formatPhone, STATUS_LABELS } from './format';

/** Protege uma rota: exige login e, opcionalmente, um perfil específico. */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Carregando…</p>;
  if (!user) return <Navigate to="/entrar" replace />;
  if (role && user.role !== role)
    return (
      <section className="card">
        <h1>Acesso negado</h1>
        <p>Esta página não está disponível para o seu perfil.</p>
      </section>
    );
  return <>{children}</>;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

/** Mostra a mensagem de sucesso passada via navegação (state.flash). */
export function Flash() {
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  return flash ? <div className="success" role="status">{flash}</div> : null;
}

/** Bloco com os dados de entrega (destinatário, telefone e endereço). */
export function ShippingInfo({ shipping }: { shipping: Shipping }) {
  return (
    <address className="shipping">
      <strong>{shipping.recipient}</strong>
      <br />
      {shipping.street}, {shipping.number}
      {shipping.complement && ` — ${shipping.complement}`}
      <br />
      {shipping.district} — {shipping.city}/{shipping.state}
      <br />
      CEP {formatCep(shipping.cep)}
      {shipping.phone && (
        <>
          <br />
          Telefone: {formatPhone(shipping.phone)}
        </>
      )}
    </address>
  );
}
