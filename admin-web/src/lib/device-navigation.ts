export async function resolveDeviceRouteParams<T extends { id: string }>(params: Promise<T> | T): Promise<T> {
  return await params;
}

export function getCreatedDeviceRedirectPath(deviceId: string) {
  return `/devices/${encodeURIComponent(deviceId)}?created=1`;
}
