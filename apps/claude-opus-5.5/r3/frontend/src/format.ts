const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatMoney = (cents: number) => money.format(cents / 100);
export const formatDate = (iso: string) => date.format(new Date(iso));

/** Converte "49,90", "49.90" ou "1.234,50" em centavos. Retorna null se inválido. */
export function parseMoneyToCents(text: string): number | null {
  let t = text.trim().replace(/^R\$\s*/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Centavos -> texto para campo de formulário ("49,90"). */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

const onlyDigits = (v: string) => v.replace(/\D/g, '');
export const formatCpf = (v: string) => onlyDigits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export const formatCep = (v: string) => onlyDigits(v).replace(/^(\d{5})(\d{3})$/, '$1-$2');
export function formatPhone(v: string): string {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v;
}
