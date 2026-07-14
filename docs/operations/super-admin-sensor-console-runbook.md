# Super-admin sensor console runbook

The internal operations console is served at `http://admin.localhost` and is intentionally separate from the caregiver dashboard at `http://web.localhost`. It manages the shared MQTT and AeroSense TCP fleet; it does not assign a device to a patient. Patient assignment remains a caregiver mobile-app workflow.

## Local startup

From the repository root:

```bash
cp admin-web/.env.example admin-web/.env # optional for local overrides
docker compose up -d --build backend admin-web traefik
open http://admin.localhost
```

The Compose service supplies the development defaults directly. Set a unique `ADMIN_NEXTAUTH_SECRET` and cookie name in a real environment; never reuse the caregiver web session secret or cookie.

Local development seed credentials are `super_admin@anees.dev` / `superadmin123`. They are for this development database only and must be replaced or disabled before any shared or production deployment. An ordinary `admin` or caregiver account is rejected by the admin app and receives no console session.

## Provisioning workflow

1. Sign in as the super-admin and choose **Add device**.
2. Enter the hardware serial, firmware, room, device type, transport, and (for AeroSense) the radar/external ID.
3. Confirm the response UUID. New devices are created `enabled` but `Unassigned`; the immutable UUID is visible in the fleet table and detail page.
4. Print the UUID label and attach it to the physical box. The caregiver uses that UUID in the mobile app to assign a patient later.
5. Verify the device appears online/diagnostic-only as it connects. Do not add patient identifiers in this console.

## Lifecycle meanings

- **Enabled**: telemetry may be decoded, stored, and used for clinical alerts for an assigned patient.
- **Maintenance**: diagnostics, heartbeat, and approved raw operational telemetry continue; clinical vital publication and alert escalation are suppressed.
- **Disabled**: clinical and diagnostic ingress is rejected and a bounded `device.ingress_suppressed` operational event is recorded.
- **Deprovisioned**: the device is permanently excluded from normal fleet views and ingress. Use a new provisioning record for replacement hardware.

Every state change requires a reason and creates an immutable audit record. Review `/audit` after a change or command test.

## AeroSense command allowlist

The test panel exposes exactly these commands and no arbitrary function-code selector:

```text
wavve.report_interval.set       { ticks }
wavve.report_interval.get       {}
wavve.bed_exit_timer.set        { seconds }
wavve.bed_exit_timer.get        {}
assure.installation_height.set  { meters }
assure.installation_height.get  {}
assure.fall_buffer_time.set     { seconds }
assure.fall_buffer_time.get     {}
assure.working_range.set        { meters }
assure.working_range.get        {}
assure.fall_mode.set             { mode: high_sensitivity | low_false_alert }
assure.fall_mode.get             {}
```

Command audit entries retain the requested values, `responseStatus`, elapsed milliseconds, and a bounded error name. Raw command responses and medical payloads are never returned by the admin API.

## Network and rollback

AeroSense devices connect to the backend TCP listener on the configured private sensor port (development default `8899`). Expose that port only through the private sensor network or an authenticated VPN; do not publish it directly to the public internet. MQTT should likewise use the private broker/TLS boundary used by the deployment.

For an emergency rollback, disable the `admin-web` service/router and transition affected devices to `disabled` through an existing authenticated backend path. The ingress policy remains enforced independently of the dashboard. Restore the service and device state only after checking `/health`, backend logs, and the audit feed.

## Verification checklist

```bash
docker compose config
npm --prefix admin-web test
npm --prefix admin-web run type-check
npm --prefix admin-web run build
docker exec anees-backend sh -lc 'npm test -- --runInBand'
```

Confirm `admin.localhost` shows the super-admin login, `web.localhost` remains the caregiver application, and an admin/caregiver token receives `403` from `/v1/super-admin/*`.

## Acceptance evidence (2026-07-14)

Verified in the local Docker development stack:

- `docker compose config` — PASS; `admin-web` is on `anees-net` and Traefik has the `admin.localhost` router.
- Backend unit suite — PASS, 33 suites / 103 tests; `npm run build` — PASS.
- `super-admin.e2e-spec.ts` — PASS, provisioning, UUID/assignment state, lifecycle audit, and admin `403`.
- `aerosense-tcp.e2e-spec.ts` — PASS, Wavve registration/vital persistence and live cache.
- `mqtt-pipeline.e2e-spec.ts` — PASS, DSP persistence, DLQ rejection, and heartbeat.
- Admin web — PASS, 3 Vitest files / 4 tests, TypeScript check, and standalone Next build.
- `curl -H 'Host: admin.localhost' http://127.0.0.1/` — `307 Location: /login` when unauthenticated.
