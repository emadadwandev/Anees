.PHONY: dev stop reset logs ps migrate seed lint test tls-audit coverage mobile-android

dev:
	docker compose up -d
	@echo ""
	@echo "=== Anees Dev Environment ==="
	@echo "All services are behind Traefik. Add these to /etc/hosts if not using .localhost:"
	@echo ""
	@echo "  API (NestJS):   http://api.localhost"
	@echo "  DSP (FastAPI):  http://dsp.localhost"
	@echo "  Web (Next.js):  http://web.localhost"
	@echo "  Grafana:        http://grafana.localhost   (admin / admin)"
	@echo "  Prometheus:     http://prometheus.localhost"
	@echo "  Jaeger:         http://jaeger.localhost"
	@echo "  HiveMQ UI:      http://hivemq.localhost"
	@echo "  LiveKit API:    http://livekit.localhost"
	@echo "  Traefik:        http://traefik.localhost  or  http://localhost:8888"
	@echo ""
	@echo "  PostgreSQL:     localhost:5432"
	@echo "  Redis:          localhost:6379"
	@echo "  MQTT:           localhost:1883"
	@echo "  OTLP gRPC:      localhost:4317"
	@echo ""

stop:
	docker compose stop

reset:
	docker compose down -v --remove-orphans
	@echo "All containers and volumes removed."

logs:
	docker compose logs -f --tail=100

logs-%:
	docker compose logs -f --tail=100 $*

ps:
	docker compose ps

migrate:
	docker compose exec backend npx prisma migrate dev

seed:
	docker compose exec backend npx ts-node prisma/seed.ts

prisma-studio:
	docker compose exec backend npx prisma studio

lint:
	cd backend && npm run lint
	cd dsp-service && ruff check app/
	cd web && npm run lint

test:
	cd backend && npm test
	cd dsp-service && pytest
	cd web && npm test

test-e2e:
	cd backend && npm run test:e2e

build:
	docker compose build

shell-%:
	docker compose exec $* sh

backend-install:
	cd backend && npm install

web-install:
	cd web && npm install

dsp-install:
	cd dsp-service && pip install -r requirements.txt

# ─── Mobile (physical Android device) ────────────────────────────────────────
# Usage: make mobile-android HOST_IP=192.168.x.x
HOST_IP ?= $(shell ipconfig getifaddr en0)
mobile-android:
	@echo "=== Running Flutter on physical Android device ==="
	@echo "  Backend URL: http://$(HOST_IP):3000"
	@echo "  Make sure the device is on the same Wi-Fi as this machine."
	@echo ""
	cd mobile && flutter run \
		--dart-define=API_BASE_URL=http://$(HOST_IP):3000/v1 \
		--dart-define=SOCKET_BASE_URL=http://$(HOST_IP):3000

# ─── P9-001: TLS / transport security audit ──────────────────────────────────
# Run against staging host. Set HOST= to override.
HOST ?= api.staging.anees.health
tls-audit:
	@echo "=== TLS audit for $(HOST) ==="
	@command -v nmap >/dev/null 2>&1 || (echo "nmap not found — brew install nmap" && exit 1)
	nmap --script ssl-enum-ciphers -p 443 $(HOST)
	@echo ""
	@echo "For an A+ SSL Labs report, visit:"
	@echo "  https://www.ssllabs.com/ssltest/analyze.html?d=$(HOST)&hideResults=on"
	@echo ""
	@echo "MQTT TLS check (port 8883):"
	@openssl s_client -connect $(HOST):8883 -brief 2>&1 | head -5 || true

# ─── P9-004: Test coverage gates ─────────────────────────────────────────────
coverage:
	@echo "=== Backend coverage (gate: 70% statements) ==="
	cd backend && npm run test:cov
	@echo ""
	@echo "=== DSP coverage (gate: 80% statements) ==="
	cd dsp-service && pytest --cov=app --cov-fail-under=80 --cov-report=term-missing
