export type User = { id: number; name: string; email: string; role: 'customer' | 'employee' };
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api(path: string, body?: unknown, method?: string) {
  const response = await fetch(`/api/${path}`, { method: method ?? (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new ApiError(data.message ?? 'Não foi possível concluir a solicitação.', response.status);
  return data;
}
