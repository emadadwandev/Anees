# Super-Admin Sensor Operations Console

## Goal

Create a separate operations dashboard at `admin.localhost` for pre-shipment testing and infrastructure management of both MQTT devices and AeroSense TCP devices. The console is for platform operators, not caregivers. Caregivers will later use a separate mobile app to assign an existing device to a patient using the device UUID.

## Approved decisions

- Add a new `super_admin` role. Preserve the existing `admin` role and dashboard behavior.
- Deploy a separate `admin-web` frontend service/container with its own NextAuth session boundary.
- Share the existing Nest backend, PostgreSQL, Redis, and device pipelines.
- Super admins create/provision devices; caregivers assign devices to patients in a future mobile app.
- Expose the immutable Anees device UUID prominently and provide copy and printable-label support for physical device boxes.
- Support both MQTT and AeroSense TCP devices in one fleet model.
- Support explicit management states in addition to connectivity status:
  - `enabled`: normal telemetry and clinical processing.
  - `maintenance`: accept telemetry and show it in diagnostics, but suppress clinical alert escalation.
  - `disabled`: stop ingestion/clinical processing while preserving history and configuration.
- Deprovisioning removes a device from active wire-identity resolution without deleting historical data or audit records.
- Expose only approved AeroSense configuration commands; never expose arbitrary function codes.

## Backend and data model

### Identity and state

Add `Role.super_admin` and a `DeviceManagementState` enum with `enabled`, `maintenance`, and `disabled`. Keep `DeviceStatus` for connectivity (`online`, `offline`, and existing compatibility values). A device record continues to hold the shared transport metadata:

- transport: `mqtt` or `aerosense_tcp`
- vendor and external ID/radar ID
- serial, firmware, capabilities, room label
- immutable Anees UUID
- management state and optional state reason/timestamps

New devices are unassigned. Patient assignment is not part of the super-admin API.

### APIs

Add a protected `/v1/super-admin/devices` API surface for:

- listing/filtering fleet devices
- creating MQTT or AeroSense TCP device records
- reading a device and its diagnostics
- changing enabled/maintenance/disabled state with a required reason
- restoring a device state
- deprovisioning a device without destroying history
- reading device audit history
- invoking approved AeroSense read/configuration commands

Every endpoint requires JWT authentication and the `super_admin` role. Authorization is enforced in Nest guards, independent of UI visibility.

### Ingress behavior

- Enabled devices follow the existing MQTT and AeroSense TCP pipelines.
- Maintenance devices may update telemetry, health, and diagnostics, but vendor and derived clinical notifications are suppressed.
- Disabled devices are rejected or ignored before clinical processing, with a bounded operational audit/system event and no medical payload logging.
- State changes invalidate device-resolution caches so MQTT and TCP behavior changes promptly.

### Audit behavior

Audit records include actor, action, device UUID, transport/vendor identity where appropriate, old state, new state, reason, command/requested values, response status, elapsed time, and timestamp. Audit records are immutable through the API.

## Separate admin-web application

Create a separate Next.js application/service with its own session cookie name and secret. It calls the existing backend API and is routed by Traefik at `admin.localhost`.

### Screens

- Login restricted to `super_admin` sessions.
- Fleet overview with totals for MQTT/TCP, enabled/maintenance/disabled, online/offline, and recent errors.
- Device table with UUID, transport, vendor, serial/external ID, assignment state, connectivity, management state, firmware, and last heartbeat.
- Add-device wizard for MQTT and AeroSense TCP provisioning.
- Device detail page with UUID copy/print label, lifecycle controls, diagnostics, recent events, and audit history.
- AeroSense configuration/testing page for approved commands and response timing.
- Immutable audit log page.
- System-health page for listener, MQTT, Redis, database, rejected-frame, and recent error visibility.

The app must not expose patient assignment controls or caregiver workflows.

## Security and operational controls

- Use a separate admin session boundary and require `super_admin` server-side.
- Require a reason for maintenance, disable, restore, and deprovision actions.
- Preserve existing `admin` and caregiver access behavior.
- Never display tokens, password hashes, or raw medical payloads.
- Keep AeroSense TCP protected by private network/VPN/allowlist controls.
- Keep MQTT device behavior unchanged except for the new management-state gate.
- Provide a rollback path that disables the admin service or device ingress without deleting records or affecting MQTT history.

## Testing and acceptance

Backend tests must cover role guards, device CRUD/provisioning, management-state transitions, cache invalidation, ingress gating, maintenance alert suppression, deprovisioning, and audit records. E2E tests must cover both MQTT and AeroSense TCP device creation, UUID retrieval, state changes, and protected access.

Frontend tests/build checks must cover login routing, fleet filtering, UUID display/print actions, state controls, command result/error states, and denial of non-super-admin sessions. Docker Compose and production builds must validate both frontend services and the `admin.localhost` route.

## Explicit non-goals

- Patient assignment from the super-admin dashboard.
- Firmware OTA, factory reset, room-learning, or arbitrary vendor commands.
- A second backend/database for the admin application.
- Changes to existing caregiver/mobile workflows beyond exposing the UUID they will use later.
