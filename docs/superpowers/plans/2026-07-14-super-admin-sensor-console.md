# Super-Admin Sensor Operations Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate `admin.localhost` operations console and protected backend API for provisioning, testing, enabling, maintaining, disabling, and deprovisioning MQTT and AeroSense TCP devices before caregiver assignment.

**Architecture:** Extend the existing NestJS/PostgreSQL/Redis backend with a `super_admin` role, a device management state separate from online/offline connectivity, cache-aware lifecycle services, ingress gates, immutable audit records, and approved AeroSense command endpoints. Add an `admin-web` Next.js service in this monorepo with an independent NextAuth cookie/secret, routed by Traefik to the shared backend.

**Tech Stack:** NestJS 10, Prisma 5/PostgreSQL, Redis, Jest/Supertest, Next.js 14/React 18/NextAuth beta, TypeScript, Docker Compose, Traefik.

## Global Constraints

- The existing `admin`, caregiver, and care-receiver workflows must keep working unchanged.
- New devices are created unassigned; patient assignment remains a future caregiver-mobile workflow.
- `enabled`, `maintenance`, and `disabled` are management states; `online`/`offline` remains connectivity state.
- Lifecycle actions require a non-empty reason and create immutable audit records.
- Disabled devices must not enter clinical processing; maintenance telemetry is diagnostic-only and suppresses clinical escalation.
- Deprovisioning removes active wire-identity resolution without deleting device, telemetry, history, or audit records.
- Only the approved AeroSense command allowlist may be exposed; arbitrary function codes are forbidden.
- Never return secrets, password hashes, tokens, or raw medical payloads from the admin API/UI.
- Do not stage or modify unrelated user-owned folders such as `.codex/`, `.pnpm-store/`, or `docs/Areosense/`.
- Canonical backend tests run inside the development container only after `docker exec anees-backend sh -lc 'test -d node_modules && test -x node_modules/.bin/jest'` succeeds.

---

### Task 1: Add the super-admin role and device lifecycle fields

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260714130000_super_admin_device_lifecycle/migration.sql`
- Modify: `backend/prisma/seed.ts`
- Test: `backend/src/devices/device-lifecycle.schema.spec.ts`

**Interfaces:**
- Produces Prisma enums `Role.super_admin` and `DeviceManagementState.enabled|maintenance|disabled`.
- Produces a nullable `Device.userId`/`User.devices` relation so provisioning can create an unassigned device; caregiver assignment later sets `userId` through the existing mobile-facing workflow.
- Produces `Device.managementState`, `managementStateReason`, `managementStateChangedAt`, and nullable `deprovisionedAt` fields.
- Keeps `Device.status` as connectivity status and preserves existing rows with `management_state = enabled`.

- [ ] **Step 1: Write the failing schema contract test**

```ts
import { DeviceManagementState, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

describe('device lifecycle schema', () => {
  afterAll(async () => prisma.$disconnect());

  it('exports the super-admin role and independent management states', () => {
    expect(Role.super_admin).toBe('super_admin');
    expect(DeviceManagementState).toEqual({
      enabled: 'enabled', maintenance: 'maintenance', disabled: 'disabled',
    });
  });

  it('allows a provisioned device to exist without a patient assignment', async () => {
    const device = await prisma.device.create({
      data: { serial: 'schema-unassigned', firmwareVersion: '0.0.0', roomLabel: 'Staging' },
    });
    expect(device.userId).toBeNull();
    expect(device.managementState).toBe(DeviceManagementState.enabled);
    await prisma.device.delete({ where: { id: device.id } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `docker exec anees-backend sh -lc 'test -d node_modules && test -x node_modules/.bin/jest && npm test -- --runInBand device-lifecycle.schema.spec.ts'`

Expected: FAIL because the generated Prisma client has no `super_admin` or `DeviceManagementState`.

- [ ] **Step 3: Add the Prisma model changes and migration**

Add `super_admin` to `Role`, add the new enum, make the assignment relation optional, and add these mapped fields to `Device`:

```prisma
userId                    String?                @map("user_id")
user                      User?                  @relation(fields: [userId], references: [id])
managementState          DeviceManagementState @default(enabled) @map("management_state")
managementStateReason    String?                @map("management_state_reason")
managementStateChangedAt DateTime               @default(now()) @map("management_state_changed_at")
deprovisionedAt          DateTime?              @map("deprovisioned_at")
```

The migration must first drop the existing `devices_user_id_fkey` constraint, alter `user_id` to nullable, recreate the nullable foreign key with the existing delete behavior, then add the enum and lifecycle columns with defaults/nullability. It must create indexes on `(management_state, deprovisioned_at)` and `(user_id, status)`, and leave existing device UUIDs intact. Update the seed with a deterministic `super_admin@anees.dev` account and password `superadmin123`; this credential is development-only and must be labelled as such in the runbook.

The migration's assignment portion is explicit:

```sql
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_user_id_fkey";
ALTER TABLE "devices" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Generate Prisma and run the contract test**

Run: `docker exec anees-backend sh -lc 'npx prisma generate && npx prisma migrate deploy && npm test -- --runInBand device-lifecycle.schema.spec.ts'`

Expected: PASS, including the real PostgreSQL create/read round-trip for an unassigned device.

- [ ] **Step 5: Apply the migration and commit**

Run: `docker exec anees-backend npx prisma migrate deploy`; then:

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/seed.ts backend/src/devices/device-lifecycle.schema.spec.ts
git commit -m "feat: add super admin device lifecycle schema"
```

### Task 2: Implement lifecycle transitions, filtering, and cache invalidation

**Files:**
- Modify: `backend/src/devices/devices.service.ts`
- Modify: `backend/src/devices/devices.module.ts`
- Modify: `backend/src/devices/device-health.service.ts`
- Modify: `backend/src/mqtt/mqtt-consumer.service.ts`
- Modify: `backend/src/mqtt/hardware-device.service.ts`
- Modify: `backend/src/aerosense-tcp/aerosense-session.service.ts`
- Create: `backend/src/devices/dto/super-admin-device.dto.ts`
- Create: `backend/src/devices/device-lifecycle.service.ts`
- Test: `backend/src/devices/device-lifecycle.service.spec.ts`

**Interfaces:**
- `DeviceLifecycleService.list(filter)` returns sanitized fleet rows with assignment and connectivity fields.
- `DeviceLifecycleService.create(input, actorId)` creates an unassigned device with a generated immutable Anees UUID.
- `DeviceLifecycleService.transition(deviceId, state, reason, actorId)` validates the reason, updates state atomically, invalidates all identity cache keys, and writes an audit record.
- `DeviceLifecycleService.deprovision(deviceId, reason, actorId)` sets `deprovisionedAt`, invalidates identity caches, and preserves history.
- `DevicesService.resolveDeviceById`, `resolveDeviceBySerial`, and `resolveAeroSenseDevice` ignore deprovisioned devices and return management state to ingress callers.

- [ ] **Step 1: Write failing transition tests**

Cover: missing reason rejection, enabled→maintenance, maintenance→disabled, restore to enabled, deprovision preserving row, audit details containing old/new state and reason, and Redis deletion of `device:id:*`, `device:serial:*`, and `device:aerosense:*` keys.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand devices/device-lifecycle.service.spec.ts'`

Expected: FAIL because the service and methods do not exist.

- [ ] **Step 3: Implement the service and DTO validation**

Use `class-validator` DTOs with explicit transport/device-type unions. Create devices with `userId: null` and derive `assignmentState` as `unassigned` when null and `assigned` otherwise. Add an explicit `requireAssignedPatient(device)` helper for patient-dependent MQTT/TCP paths; unassigned devices may update diagnostics/heartbeat but must not publish patient vitals, sleep records, or alerts. Update existing destructuring and offline-notification code to branch on nullable `userId` rather than asserting it is always present. Return only `id`, UUID, serial, transport, vendor, external ID, assignment state, firmware, status, management state, timestamps, and capabilities.

- [ ] **Step 4: Run tests and build**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand devices/device-lifecycle.service.spec.ts && npm run build'`

Expected: PASS and a successful Nest build.

- [ ] **Step 5: Commit**

```bash
git add backend/src/devices
git commit -m "feat: add device lifecycle service"
```

### Task 3: Add the protected super-admin API and audit endpoints

**Files:**
- Create: `backend/src/super-admin/super-admin.module.ts`
- Create: `backend/src/super-admin/super-admin.controller.ts`
- Create: `backend/src/super-admin/super-admin.service.ts`
- Create: `backend/src/super-admin/dto/device-filter.dto.ts`
- Create: `backend/src/super-admin/dto/device-state.dto.ts`
- Create: `backend/src/super-admin/dto/device-command.dto.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/super-admin/super-admin.controller.spec.ts`

**Interfaces:**
- `GET /v1/super-admin/devices`
- `POST /v1/super-admin/devices`
- `GET /v1/super-admin/devices/:id`
- `GET /v1/super-admin/devices/summary` (server-side fleet totals for transport, assignment, management state, connectivity, and recent errors)
- `POST /v1/super-admin/devices/:id/state`
- `POST /v1/super-admin/devices/:id/restore`
- `POST /v1/super-admin/devices/:id/deprovision`
- `GET /v1/super-admin/devices/:id/audit`
- `GET /v1/super-admin/audit` (global immutable audit feed with actor/action/device filters and bounded pagination)
- `GET /v1/super-admin/system/health` (listener, MQTT, Redis, database, rejected-frame counters, and recent error summaries)
- `POST /v1/super-admin/devices/:id/aerosense/commands`

The command endpoint accepts exactly these twelve names and no other function-code selector:

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
assure.fall_mode.set             { mode: "high_sensitivity" | "low_false_alert" }
assure.fall_mode.get             {}
```

`GET /system/health` reads the existing `MetricsService` registry and explicit dependency probes (Redis `PING`, Prisma `SELECT 1`, MQTT client connection state, and AeroSense listener/session gauges) and returns bounded status/count fields rather than raw Prometheus text. `GET /audit` returns `actorId`, action, resource/device UUID, timestamp, and sanitized `details` with cursor pagination; it never exposes credentials or medical payloads.

Every route uses `JwtAuthGuard`, `RolesGuard`, and `@Roles(Role.super_admin)`. The controller obtains the actor from `@CurrentUser()` and passes request IP to the audit service.

- [ ] **Step 1: Write failing controller tests**

Assert a super-admin reaches list/create/summary/state/audit/system-health routes, an `admin` receives 403, create responses contain the immutable UUID and `assignmentState: "unassigned"`, state mutation rejects an empty reason, and command requests accept only the twelve names above. Add a command audit assertion that a successful and failed command each create one immutable `AuditLog` row whose `details` contains `requestedValues`, `responseStatus` (`succeeded` or `failed`), `elapsedMs` as a non-negative number, and an optional bounded `errorName`, with no raw response payload.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand super-admin/super-admin.controller.spec.ts'`

Expected: FAIL because the module/controller are absent.

- [ ] **Step 3: Implement controller, DTOs, and service orchestration**

Delegate lifecycle operations to `DeviceLifecycleService`, diagnostics to existing device health/metrics services, and AeroSense command execution to the existing `AeroSenseCommandService`. Map each of the twelve names to its explicit existing method; reject unknown names with `BadRequestException`. Add `getFleetSummary`, `getGlobalAudit`, and `getSystemHealth` service methods with bounded filters/limits. Reuse the existing command audit shape and add tests around both success and failure paths.

- [ ] **Step 4: Run tests and API build**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand super-admin/super-admin.controller.spec.ts && npm run build'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/super-admin backend/src/app.module.ts
git commit -m "feat: expose super admin device API"
```

### Task 4: Gate MQTT and AeroSense ingress by management state

**Files:**
- Modify: `backend/src/mqtt/mqtt-consumer.service.ts`
- Modify: `backend/src/mqtt/hardware-device.service.ts`
- Modify: `backend/src/aerosense-tcp/aerosense-session.service.ts`
- Modify: `backend/src/aerosense-tcp/aerosense-event.service.ts`
- Modify: `backend/src/alerts/alert-orchestration.service.ts`
- Create: `backend/src/devices/device-ingress-policy.service.ts`
- Test: `backend/src/devices/device-ingress-policy.service.spec.ts`
- Test: `backend/src/mqtt/mqtt-consumer.management-state.spec.ts`
- Test: `backend/src/aerosense-tcp/aerosense-management-state.spec.ts`

**Interfaces:**
- `DeviceIngressPolicy.acceptTelemetry(device)` returns `true` for enabled/maintenance and `false` for disabled/deprovisioned.
- `DeviceIngressPolicy.allowClinicalProcessing(device)` returns `true` only for enabled devices.
- `AeroSenseSession.patientId` and MQTT/DSP patient targets are nullable; an unassigned device is diagnostic-only until caregiver assignment sets `userId`.

- [ ] **Step 1: Write failing policy and pipeline tests**

Cover MQTT and TCP disabled rejection, maintenance heartbeat/diagnostic persistence, maintenance suppression of fall/vital clinical alerts, and a bounded `device.ingress_suppressed` system event without medical payload data.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand devices/device-ingress-policy.service.spec.ts mqtt/mqtt-consumer.management-state.spec.ts aerosense-tcp/aerosense-management-state.spec.ts'`

Expected: FAIL because policy and gates are absent.

- [ ] **Step 3: Implement the policy and insert gates before clinical processing**

Resolve the device once, reject deprovisioned/disabled devices before payload decoding that could persist medical data, continue health/diagnostic updates for maintenance and unassigned devices, and short-circuit alert orchestration when `managementState !== enabled` or `userId === null`. Invalidate resolver caches through the lifecycle service after every transition. Make offline notifications conditional on `userId` so unassigned staging devices never publish patient alerts.

- [ ] **Step 4: Run all backend unit tests and build**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand && npm run build'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/mqtt backend/src/aerosense-tcp backend/src/alerts backend/src/devices
git commit -m "feat: enforce device management state at ingress"
```

### Task 5: Add backend end-to-end coverage for provisioning and access control

**Files:**
- Modify: `backend/test/aerosense-tcp.e2e-spec.ts`
- Create: `backend/test/super-admin.e2e-spec.ts`
- Modify: `backend/test/jest-e2e.json`
- Modify: `docker-compose.yml` only if test dependencies need a stable test command

- [ ] **Step 1: Write the E2E scenarios**

Use the development-only seeded super-admin/admin credentials and Supertest to verify login, MQTT and AeroSense TCP creation, UUID retrieval, summary/system-health/global-audit routes, state transitions, deprovisioning, and 403 responses for `admin` and caregiver tokens. Use fixed fake device identities and clean them by unique serial/external ID; do not imply these seed credentials are suitable for production.

- [ ] **Step 2: Run E2E tests against the running stack**

First run: `docker exec anees-backend sh -lc 'test -d node_modules && test -x node_modules/.bin/jest'`; then run: `docker exec anees-backend sh -lc 'npm run test:e2e -- --runInBand'`.

Expected: PASS with both transports covered and no medical payloads returned by admin endpoints.

- [ ] **Step 3: Fix only test-isolation/runtime issues and rerun**

Keep test data namespaced with `e2e-` identifiers and verify the existing development seed remains unchanged.

- [ ] **Step 4: Commit**

```bash
git add backend/test docker-compose.yml
git commit -m "test: cover super admin device operations"
```

### Task 6: Scaffold the independent `admin-web` Next.js application and session boundary

**Files:**
- Create: `admin-web/package.json`
- Create: `admin-web/tsconfig.json`
- Create: `admin-web/next.config.mjs`
- Create: `admin-web/Dockerfile`
- Create: `admin-web/.env.example`
- Create: `admin-web/src/auth.ts`
- Create: `admin-web/src/lib/api.ts`
- Create: `admin-web/src/app/layout.tsx`
- Create: `admin-web/src/app/page.tsx`
- Create: `admin-web/src/app/(auth)/login/page.tsx`
- Create: `admin-web/src/app/(auth)/login/actions.ts`
- Create: `admin-web/src/app/globals.css`
- Test: `admin-web/src/lib/api.test.ts`

**Interfaces:**
- Admin session cookie name is distinct from the existing web app.
- Credentials login calls `/v1/auth/login` through `INTERNAL_API_URL`, accepts only `user.role === "super_admin"`, and redirects other roles to `/unauthorized`.
- API helper attaches the access token server-side and exposes typed methods for the super-admin endpoints.

- [ ] **Step 1: Write failing API/auth tests**

Assert non-super-admin login is rejected, API methods send bearer tokens, and device list responses are normalized without secrets or raw payload fields.

- [ ] **Step 2: Run the tests to verify failure**

Run: `npm --prefix admin-web test -- --runInBand` after adding the minimal Jest/Vitest configuration.

Expected: FAIL because the app and helpers do not exist.

- [ ] **Step 3: Implement the app scaffold and server-side auth**

Use NextAuth Credentials with `ADMIN_NEXTAUTH_SECRET`, `ADMIN_NEXTAUTH_URL`, `ADMIN_AUTH_COOKIE`, and `INTERNAL_API_URL`. Add middleware that protects every route except login and returns unauthorized for a non-super-admin session.

- [ ] **Step 4: Run type-check and build**

Run: `npm --prefix admin-web run type-check && npm --prefix admin-web run build`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin-web
git commit -m "feat: scaffold super admin web app"
```

### Task 7: Build the fleet, device detail, lifecycle, UUID label, audit, and AeroSense test screens

**Files:**
- Create: `admin-web/src/app/(console)/layout.tsx`
- Create: `admin-web/src/app/(console)/page.tsx`
- Create: `admin-web/src/app/(console)/devices/page.tsx`
- Create: `admin-web/src/app/(console)/devices/new/page.tsx`
- Create: `admin-web/src/app/(console)/devices/[id]/page.tsx`
- Create: `admin-web/src/app/(console)/devices/[id]/label/print/page.tsx`
- Create: `admin-web/src/app/(console)/audit/page.tsx`
- Create: `admin-web/src/app/(console)/health/page.tsx`
- Create: `admin-web/src/components/device-state-control.tsx`
- Create: `admin-web/src/components/device-table.tsx`
- Create: `admin-web/src/components/device-uuid-card.tsx`
- Create: `admin-web/src/components/aerosense-command-panel.tsx`
- Create: `admin-web/src/components/system-health-grid.tsx`
- Test: `admin-web/src/components/device-state-control.test.tsx`
- Test: `admin-web/src/components/device-uuid-card.test.tsx`

**Interfaces:**
- The overview page calls `GET /v1/super-admin/devices/summary` for server-side totals and recent errors, rather than counting an unbounded device list in the browser.
- The audit page calls `GET /v1/super-admin/audit` with cursor/action/device filters.
- The health page calls `GET /v1/super-admin/system/health` and renders dependency status plus bounded metric summaries.

- [ ] **Step 1: Write failing component tests**

Cover fleet filters (transport, management state, connectivity), UUID copy/print actions, required reason validation, confirmation for disable/deprovision, command pending/success/error states, and the absence of patient-assignment controls.

- [ ] **Step 2: Run focused frontend tests and verify failure**

Run: `npm --prefix admin-web test -- --runInBand`.

Expected: FAIL because the console components do not exist.

- [ ] **Step 3: Implement screens and typed API calls**

Keep UUID visible in the table/detail header, render assignment as read-only “Unassigned” or assigned metadata, provide browser print CSS for the physical label, and expose only the approved AeroSense command selector and typed fields.

- [ ] **Step 4: Run component tests, type-check, and production build**

Run: `npm --prefix admin-web test -- --runInBand && npm --prefix admin-web run type-check && npm --prefix admin-web run build`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add admin-web/src
git commit -m "feat: add super admin device console"
```

### Task 8: Wire Docker Compose, Traefik, environment, and operational documentation

**Files:**
- Modify: `docker-compose.yml`
- Modify: `infra/traefik/dynamic.yml`
- Create: `admin-web/.env.example`
- Modify: `.env.example` if present
- Create: `docs/operations/super-admin-sensor-console-runbook.md`
- Test: `admin-web/Dockerfile` production build and Compose config validation

- [ ] **Step 1: Add the service and route**

Add an `admin-web` development service on the shared `anees-net`, mount `./admin-web/src`, expose internal port `3003`, and add a Traefik router/service for `Host(\`admin.localhost\`)` targeting `http://admin-web:3003`.

- [ ] **Step 2: Add isolated environment values**

Document `ADMIN_NEXTAUTH_URL=http://admin.localhost`, a unique `ADMIN_NEXTAUTH_SECRET`, `ADMIN_AUTH_COOKIE=anees-admin-session`, and `INTERNAL_API_URL=http://backend:3000`. Do not reuse the web app session secret/cookie.

- [ ] **Step 3: Add the runbook**

Document local startup, development-only seeded super-admin login, provisioning workflow, UUID label printing, lifecycle meanings, the exact twelve-command allowlist above, private TCP exposure requirements, rollback by disabling the admin service or device ingress, and audit verification. Explicitly state that the seeded password must be replaced or disabled outside local development.

- [ ] **Step 4: Validate Compose and both production builds**

Run: `docker compose config`; `docker compose build backend web admin-web`; and `docker compose up -d --force-recreate admin-web traefik`.

Expected: valid configuration, successful images, and `curl -H 'Host: admin.localhost' http://127.0.0.1/` returning the admin login page.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml infra/traefik/dynamic.yml admin-web/.env.example docs/operations/super-admin-sensor-console-runbook.md
git commit -m "chore: deploy super admin console at admin.localhost"
```

### Task 9: Run the full acceptance gate and record handoff evidence

**Files:**
- Modify: `docs/operations/super-admin-sensor-console-runbook.md` with verified commands and timestamps

- [ ] **Step 1: Run backend unit, E2E, and build checks**

Run: `docker exec anees-backend sh -lc 'npm test -- --runInBand && npm run test:e2e -- --runInBand && npm run build'`.

- [ ] **Step 2: Run admin-web checks**

Run: `npm --prefix admin-web test -- --runInBand && npm --prefix admin-web run type-check && npm --prefix admin-web run build`.

- [ ] **Step 3: Verify routes and role denial manually**

Verify `web.localhost` still accepts admin/caregiver credentials, `admin.localhost` accepts only the seeded super-admin, an admin receives unauthorized, and the dashboard can provision one MQTT and one AeroSense TCP device, copy/print each UUID, transition states, invoke an allowlisted command, and inspect audit entries.

- [ ] **Step 4: Commit the verification record**

```bash
git add docs/operations/super-admin-sensor-console-runbook.md
git commit -m "docs: record super admin console acceptance checks"
```

## Self-review

- Spec coverage: role/schema (Task 1), lifecycle/cache/audit (Task 2), protected API and command allowlist (Task 3), MQTT/TCP ingress and maintenance suppression (Task 4), backend acceptance (Task 5), separate session-bound admin app (Task 6), all required screens and UUID print support (Task 7), deployment/routing/rollback documentation (Task 8), and final acceptance evidence (Task 9).
- Placeholder scan: no `TBD`, `TODO`, or unspecified “add appropriate handling” steps are used; commands, paths, states, and interfaces are explicit.
- Type consistency: `DeviceManagementState`, `DeviceLifecycleService`, `DeviceIngressPolicy`, and `/v1/super-admin/devices` are introduced before consumers; frontend API methods precede console screens.
