export type DeviceManagementState = 'enabled' | 'maintenance' | 'disabled';
export type DeviceTransport = 'mqtt' | 'aerosense_tcp';

export interface AdminDevice {
  id: string;
  serial: string;
  firmwareVersion: string;
  roomLabel: string;
  transport: string;
  deviceType: string;
  managementState: DeviceManagementState;
  managementStateReason: string | null;
  status: string;
  userId: string | null;
  deprovisionedAt: string | null;
}

export interface FleetSummary {
  total: number;
  transports: { mqtt: number; aerosenseTcp: number };
  managementStates: Record<DeviceManagementState, number>;
  connectivity: { online: number; offline: number };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded';
  checkedAt: string;
  dependencies: Record<'database' | 'redis' | 'mqtt' | 'aerosenseTcp', 'healthy' | 'unhealthy'>;
  metrics: { rejectedFrames: number | null };
}

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  timestamp: string;
}

type Fetcher = typeof fetch;

/** Keep admin UI data intentionally narrow: no credentials, payloads, or capabilities. */
export function normalizeDevice(input: Record<string, unknown>): AdminDevice {
  return {
    id: String(input.id ?? ''),
    serial: String(input.serial ?? ''),
    firmwareVersion: String(input.firmwareVersion ?? ''),
    roomLabel: String(input.roomLabel ?? ''),
    transport: String(input.transport ?? ''),
    deviceType: String(input.deviceType ?? ''),
    managementState: (input.managementState ?? 'enabled') as DeviceManagementState,
    managementStateReason: typeof input.managementStateReason === 'string' ? input.managementStateReason : null,
    status: String(input.status ?? 'offline'),
    userId: typeof input.userId === 'string' ? input.userId : null,
    deprovisionedAt: typeof input.deprovisionedAt === 'string' ? input.deprovisionedAt : null,
  };
}

function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    return response.json().catch(() => ({})).then((body) => {
      throw new Error(typeof body?.message === 'string' ? body.message : `Admin API request failed (${response.status})`);
    });
  }
  return response.json() as Promise<T>;
}

export function createAdminApi(token: string, fetcher: Fetcher = fetch) {
  const baseUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
  const request = (path: string, init: RequestInit = {}) =>
    fetcher(`${baseUrl}/v1/super-admin${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

  return {
    async listDevices(params: Record<string, string> = {}) {
      const query = new URLSearchParams(params).toString();
      const rows = await readJson<unknown[]>(await request(`/devices${query ? `?${query}` : ''}`));
      return rows.map((row) => normalizeDevice(row as Record<string, unknown>));
    },
    async getDevice(id: string) {
      return normalizeDevice(await readJson<Record<string, unknown>>(await request(`/devices/${encodeURIComponent(id)}`)));
    },
    async getSummary() {
      return readJson<FleetSummary>(await request('/devices/summary'));
    },
    async createDevice(input: {
      serial: string;
      firmwareVersion: string;
      roomLabel: string;
      deviceType: 'fall_sensor' | 'sleep_sensor';
      transport: DeviceTransport;
      vendor?: string;
      externalId?: string;
    }) {
      return normalizeDevice(await readJson<Record<string, unknown>>(await request('/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })));
    },
    async getHealth() {
      return readJson<SystemHealth>(await request('/system/health'));
    },
    async getAudit(params: Record<string, string> = {}) {
      const query = new URLSearchParams(params).toString();
      return readJson<AuditEntry[]>(await request(`/audit${query ? `?${query}` : ''}`));
    },
    async transitionDevice(id: string, state: DeviceManagementState, reason: string) {
      return normalizeDevice(await readJson<Record<string, unknown>>(await request(`/devices/${encodeURIComponent(id)}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, reason }),
      })));
    },
    async deprovisionDevice(id: string, reason: string) {
      return normalizeDevice(await readJson<Record<string, unknown>>(await request(`/devices/${encodeURIComponent(id)}/deprovision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })));
    },
    async executeCommand(id: string, command: string, values: Record<string, unknown>) {
      return readJson<{ ok?: boolean; value?: unknown }>(await request(`/devices/${encodeURIComponent(id)}/aerosense/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, values }),
      }));
    },
  };
}

export async function getAdminApi() {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'super_admin') {
    throw new Error('Super-admin session required');
  }
  return createAdminApi(session.accessToken);
}
