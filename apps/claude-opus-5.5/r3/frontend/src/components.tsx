import { useLocation } from 'react-router';
import { STATUS_LABELS, type Address, type OrderStatus } from './api';
import { formatCep, formatPhone } from './format';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

/** Mostra mensagem de sucesso passada via navigate(..., { state: { flash } }). */
export function Flash() {
  const flash = (useLocation().state as { flash?: string } | null)?.flash;
  return flash ? <p className="success" role="status">{flash}</p> : null;
}

/** Endereço formatado em texto (sem HTML vindo do usuário). */
export function AddressBlock({ address, phone }: { address: Address; phone?: string | null }) {
  const a = address;
  return (
    <address className="address">
      <strong>{a.recipient}</strong><br />
      {a.street}, {a.number}{a.complement ? ` — ${a.complement}` : ''}<br />
      {a.district} — {a.city}/{a.state}<br />
      CEP {formatCep(a.cep)}
      {phone && <><br />Telefone: {formatPhone(phone)}</>}
    </address>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1 && page <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2);
  return (
    <nav className="pagination" aria-label="Paginação">
      <button className="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Anterior</button>
      {pages.map((p, i) => (
        <span key={p} className="page-group">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="ellipsis">…</span>}
          <button className={p === page ? 'page current' : 'page secondary'} aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}>{p}</button>
        </span>
      ))}
      <button className="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Próxima ›</button>
    </nav>
  );
}
