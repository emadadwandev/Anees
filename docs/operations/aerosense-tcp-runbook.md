# AeroSense Direct TCP Runbook

This runbook covers AeroSense Assure and Wavve sensors that connect directly to the Anees TCP listener. It does not replace the MQTT device workflow.

## Before a pilot

1. Register each radar in Anees before powering it on. Set `transport` to `aerosense_tcp`, use the upper-case hexadecimal radar ID as `externalId`, and record its vendor, room, firmware, and patient assignment.
2. Record the sensor firmware, configured server address and port, radar ID, room, and installer in the pilot deployment record.
3. Obtain and retain a packet capture for every enabled message type. Verify it with the protocol fixtures before enabling alerts for a resident.
4. Use a protected path only: private network, VPN, or an approved edge tunnel. Never expose the listener directly to the public internet.
5. Set `TCP_ALLOWED_CIDRS` to the sensor network CIDRs in the backend environment. A blank allowlist is allowed only for local development.

## Local connectivity check

The development stack exposes the listener on TCP port `8899`.

```sh
docker compose up -d backend postgres redis
nc -vz 127.0.0.1 8899
docker compose logs --tail=100 backend
```

After registration, confirm the device status is online, the firmware and last-seen timestamp are updated, and the Grafana **IoT Pipeline** dashboard shows the protocol-specific active-sensor and frame-rate series.

## Safe configuration

Only administrators may use the AeroSense configuration endpoints. Every successful and failed command is recorded in `audit_log.details` with its requested values, result, and elapsed time.

Supported configuration is deliberately limited to:

- Wavve report interval and bed-exit timer, with readback.
- Assure installation height, fall buffer time, working range, and fall mode, with readback.

Do not use firmware upgrades, factory reset, room learning, raw ADC/heatmap collection, arbitrary function codes, or Wavve working-distance configuration. The Wavve protocol does not document a bounded safe maximum for working distance; obtain an approved vendor-tested range before enabling it.

## Packet capture procedure

Capture only on the protected sensor network and handle captures as sensitive operational material.

```sh
sudo tcpdump -i <interface> -s 0 -w aerosense-<device-id>-<timestamp>.pcap tcp port 8899
```

Capture registration plus one enabled event, then stop capture. Store it in the approved incident/pilot location; do not attach raw captures to tickets or application logs.

## Disconnect investigation

1. Confirm the sensor still has power and the expected private-network route to port `8899`.
2. Check the device external ID, `aerosense_tcp` transport, and `TCP_ALLOWED_CIDRS` configuration.
3. Check Grafana for rejected frames, the protocol frame rate, command failures, and offline-device events.
4. Review backend logs without collecting or printing raw medical payloads.
5. Reconnect the sensor. Anees waits for `TCP_DISCONNECT_GRACE_MS` before marking it offline to avoid transient-network alert noise.

## Emergency rollback

To stop direct TCP ingestion while preserving the MQTT pipeline, remove the `8899:8899` host-port mapping or set a deny-all `TCP_ALLOWED_CIDRS` value, then restart only the backend service. Do not remove device records, historical vital readings, alerts, or MQTT configuration during rollback.

```sh
docker compose up -d --force-recreate backend
```

Document the rollback time, affected devices, and reason. Re-enable only after the protected network path and packet fixtures have been revalidated.
