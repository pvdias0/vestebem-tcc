export type Product = { id: number; name: string; description: string; category: string; size: string; priceCents: number; stock: number };
export type ProductPage = { items: Product[]; page: number; pageSize: number; total: number; totalPages: number };
export const money = (cents: number) => (cents/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function parsePrice(value: string) { const normalized = value.trim().replace(',', '.'); if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN; const [whole,fraction=''] = normalized.split('.'); return Number(whole)*100+Number(fraction.padEnd(2,'0')); }
export async function catalogApi<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 const response = await fetch('/api/'+path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
 const data = await response.json();
 if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a solicitação.');
 return data as T;
}
