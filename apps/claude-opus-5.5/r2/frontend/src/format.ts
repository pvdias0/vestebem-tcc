import type { OrderStatus } from './api';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  em_preparacao: 'Em preparação',
  enviado: 'Enviado',
  cancelado: 'Cancelado',
};
export const STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatMoney = (cents: number) => brl.format(cents / 100);

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const formatDate = (iso: string) => dt.format(new Date(iso));

/** Converte "12,50", "12.50" ou "1.234,56" em centavos. Retorna null se inválido ou negativo. */
export function parseMoneyToCents(input: string): number | null {
  let s = input.trim().replace(/^R\$\s*/, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');

export function formatCpf(v: string): string {
  const d = onlyDigits(v);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v;
}

export function formatCep(v: string): string {
  const d = onlyDigits(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : v;
}

export function formatPhone(v: string): string {
  const d = onlyDigits(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
