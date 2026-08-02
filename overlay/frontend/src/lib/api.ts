export class ApiError extends Error {
  status: number;
  code: string;
  command: string;
  output: string;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = String(details.code ?? '');
    this.command = String(details.command ?? (details.details as Record<string, unknown> | undefined)?.command ?? '');
    this.output = String(details.output ?? (details.details as Record<string, unknown> | undefined)?.output ?? '');
  }
}

type RuntimeHooks = {
  getCSRF: () => string;
  onUnauthorized: () => void;
  elevate: () => Promise<void>;
};

const hooks: RuntimeHooks = {
  getCSRF: () => '',
  onUnauthorized: () => undefined,
  elevate: async () => {
    throw new ApiError('需要二次验证', 403);
  },
};

export function configureApi(next: Partial<RuntimeHooks>) {
  Object.assign(hooks, next);
}

function buildHeaders(options: RequestInit) {
  const headers = new Headers(options.headers ?? {});
  const body = options.body;
  if (body && !(body instanceof FormData) && !(body instanceof Blob) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options.method ?? 'GET').toUpperCase();
  const csrf = hooks.getCSRF();
  if (method !== 'GET' && method !== 'HEAD' && csrf) headers.set('X-CSRF-Token', csrf);
  return headers;
}

async function parseError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return new ApiError(String(body.error ?? `请求失败（${response.status}）`), response.status, body);
}

export async function api<T = Record<string, unknown>>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options),
    credentials: 'same-origin',
  });
  if (response.status === 401) hooks.onUnauthorized();
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return {} as T;
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return (await response.text()) as T;
  return (await response.json()) as T;
}

export async function secureApi<T = Record<string, unknown>>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    return await api<T>(url, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403 || !error.message.includes('二次验证')) throw error;
    await hooks.elevate();
    return api<T>(url, options);
  }
}

export async function apiBlob(url: string, options: RequestInit = {}, elevated = false): Promise<Blob> {
  const run = async () => {
    const response = await fetch(url, {
      ...options,
      headers: buildHeaders(options),
      credentials: 'same-origin',
    });
    if (response.status === 401) hooks.onUnauthorized();
    if (!response.ok) throw await parseError(response);
    return response.blob();
  };
  try {
    return await run();
  } catch (error) {
    if (!elevated || !(error instanceof ApiError) || error.status !== 403 || !error.message.includes('二次验证')) throw error;
    await hooks.elevate();
    return run();
  }
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

export function errorText(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  if (!(error instanceof ApiError)) return error.message;
  return [
    error.message,
    error.command ? `执行命令：\n${error.command}` : '',
    error.output ? `命令输出：\n${error.output}` : '',
  ].filter(Boolean).join('\n\n');
}
