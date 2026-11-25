// Typed API client for the AutoFlow backend (see CONTRACT.md).
// All requests use relative /api paths (proxied to http://localhost:4000
// by Vite in dev) with credentials: 'include' — auth lives in the
// httpOnly `autoflow_token` cookie, never in localStorage.
//
// VITE_API_URL (build-time): absolute API origin for split deployments,
// e.g. https://autoflow-api.onrender.com. Empty = same origin (relative
// /api paths — dev and docker-compose). A bare host (Render's fromService
// `host`, e.g. autoflow-api.onrender.com) gets https:// prepended.
const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const API_BASE = rawApiUrl
  ? rawApiUrl.startsWith('http')
    ? rawApiUrl.replace(/\/$/, '')
    : `https://${rawApiUrl.replace(/\/$/, '')}`
  : '';

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    ...opts,
  });
  if (res.status === 204) return undefined as T;
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } }).error;
    throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code);
  }
  return data as T;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  definition?: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: { id: string; source: string; target: string }[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
  definition?: WorkflowDefinition;
}

export interface Integration {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  status: string;
  authType: string;
}

export interface Execution {
  id: string;
  workflowId?: string;
  workflowName?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string | null;
}

export interface ExecutionNodeResult {
  nodeId: string;
  nodeType: string;
  name: string;
  status: string;
  error?: string | null;
}

export interface ExecutionLog {
  id: string;
  nodeId: string;
  level: string;
  message: string;
  data?: unknown;
  createdAt: string;
}

export interface RunResult {
  execution: Execution;
  nodes: ExecutionNodeResult[];
}

export interface DashboardStats {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  executionsByDay: { date: string; success: number; failed: number }[];
  recentActivity: {
    id: string;
    kind: string;
    title: string;
    detail: string;
    createdAt: string;
  }[];
}

export interface SystemStatus {
  api: string;
  db: string;
  uptimeSeconds: number;
  version: string;
}

export const authApi = {
  me: () => api<{ user: User }>('/api/auth/me'),
  login: (email: string, password: string) =>
    api<{ user: User }>('/api/auth/login', {
      body: JSON.stringify({ email, password }),
      method: 'POST',
    }),
  register: (name: string, email: string, password: string) =>
    api<{ user: User }>('/api/auth/register', {
      body: JSON.stringify({ name, email, password }),
      method: 'POST',
    }),
  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (name: string) =>
    api<{ user: User }>('/api/auth/profile', {
      body: JSON.stringify({ name }),
      method: 'PATCH',
    }),
  forgotPassword: (email: string) =>
    api<{ message: string; devResetToken?: string; devResetLink?: string }>(
      '/api/auth/forgot-password',
      { body: JSON.stringify({ email }), method: 'POST' },
    ),
  resetPassword: (token: string, newPassword: string) =>
    api<{ ok: boolean }>('/api/auth/reset-password', {
      body: JSON.stringify({ token, newPassword }),
      method: 'POST',
    }),
};

export const workflowsApi = {
  list: () => api<{ workflows: Workflow[] }>('/api/workflows'),
  create: (name: string, description?: string) =>
    api<{ workflow: Workflow }>('/api/workflows', {
      body: JSON.stringify({ name, description: description || undefined }),
      method: 'POST',
    }),
  get: (id: string) => api<{ workflow: Workflow }>(`/api/workflows/${id}`),
  update: (
    id: string,
    patch: Partial<Pick<Workflow, 'name' | 'description' | 'active'>> & {
      definition?: WorkflowDefinition;
    },
  ) =>
    api<{ workflow: Workflow }>(`/api/workflows/${id}`, {
      body: JSON.stringify(patch),
      method: 'PATCH',
    }),
  remove: (id: string) =>
    api<undefined>(`/api/workflows/${id}`, { method: 'DELETE' }),
  run: (id: string) =>
    api<RunResult>(`/api/workflows/${id}/run`, { method: 'POST' }),
};

export const dashboardApi = {
  stats: () => api<DashboardStats>('/api/dashboard/stats'),
  systemStatus: () => api<SystemStatus>('/api/system/status'),
};

export const templatesApi = {
  list: () => api<{ templates: Template[] }>('/api/templates'),
  get: (id: string) => api<{ template: Template }>(`/api/templates/${id}`),
  import: (id: string, name?: string) =>
    api<{ workflow: Workflow }>(`/api/templates/${id}/import`, {
      body: JSON.stringify({ name: name || undefined }),
      method: 'POST',
    }),
};

export const integrationsApi = {
  list: () => api<{ integrations: Integration[] }>('/api/integrations'),
};

export const executionsApi = {
  list: () => api<{ executions: Execution[] }>('/api/executions'),
  detail: (id: string) =>
    api<{ execution: Execution; logs: ExecutionLog[] }>(`/api/executions/${id}`),
};
