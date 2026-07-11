# Task 2: Canonical inbound event contract — evidence

## Scope delivered

- Added `backend/src/aerosense-tcp/protocol/aerosense-frame.ts` with the exact public `AeroSenseProtocol`, `AeroSenseFrame`, and `AeroSenseEvent` contracts.
- Added `backend/src/aerosense-tcp/schemas/aerosense-event.schema.ts` with a Zod discriminated union covering registration, Wavve vital readings, and supported Assure/Wavve alert events.
- Added focused schema tests in `backend/src/aerosense-tcp/schemas/aerosense-event.schema.spec.ts`.

## Test-first evidence

### RED

Command:

```sh
cd backend && npm test -- aerosense-event.schema
```

Result before production code:

```text
FAIL src/aerosense-tcp/schemas/aerosense-event.schema.spec.ts
TS2307: Cannot find module './aerosense-event.schema' or its corresponding type declarations.
Test Suites: 1 failed, 1 total
Tests:       0 total
```

The failure was caused by the missing schema module targeted by the new test.

### GREEN (fresh final run)

Command:

```sh
cd backend && npm test -- aerosense-event.schema
```

Result:

```text
PASS src/aerosense-tcp/schemas/aerosense-event.schema.spec.ts
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Snapshots:   0 total
```

## Requirement checks

- Complete `wavve.vitals` reading parses successfully.
- `validBit` accepts only literal values `0`, `1`, and `2`; tests reject `3` and `-1`.
- Wavve vital and typed event `deviceId` / `patientId` require UUIDs; tests reject malformed IDs.
- Numeric vital fields use `z.number().finite()`; tests reject `Infinity` and `NaN`.
- Registration and typed non-vital events are included in the discriminated union using the specified event kinds.
- No TCP socket, vendor-codec parsing, Redis, Prisma, or dashboard implementation was introduced.
- `git diff --check` completed with exit code 0.

## Concerns

None. Verification was intentionally limited to the required focused Jest invocation.
