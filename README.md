# chr-nginx-agent

nginx sidecar for [Changerawr](https://github.com/supernova3339/changerawr) custom domain SSL.

Receives webhook events from Changerawr, fetches the issued certificate, writes nginx config and cert files to disk, then reloads nginx. Changerawr handles the full ACME lifecycle — this agent just gets nginx to pick up the results.

## How it works

```
Changerawr issues cert → POST /webhook → agent fetches PEMs → writes to disk → nginx -s reload
```

Two-phase config per domain:

1. `domain.added` — writes an HTTP-only config so the ACME challenge can be served before the cert exists
2. `cert.issued` — upgrades to a full HTTP + HTTPS config with the new cert
3. `cert.renewed` — overwrites the config with updated cert paths, reloads
4. `domain.removed` / `cert.revoked` — removes config and cert files, reloads

## Requirements

- Node.js 20+
- nginx on the host (or accessible container via shared volumes)
- A running Changerawr instance with `NGINX_AGENT_URL` and `NGINX_AGENT_SECRET` configured

## Setup

```bash
npm install
```

Set environment variables (see below), then:

```bash
npm start
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENT_SECRET` | yes | — | Must match `NGINX_AGENT_SECRET` in Changerawr |
| `CHANGERAWR_URL` | yes | — | e.g. `http://localhost:3000` |
| `INTERNAL_API_SECRET` | yes | — | Must match `INTERNAL_API_SECRET` in Changerawr |
| `UPSTREAM` | yes | `http://localhost:3000` | Where nginx proxies to |
| `AGENT_PORT` | no | `7842` | Port to listen on |
| `CERT_DIR` | no | `/etc/ssl/changerawr` | Where cert files are written |
| `NGINX_DIR` | no | `/etc/nginx/sites-enabled` | Where nginx configs are written |
| `NGINX_RELOAD_CMD` | no | `nginx -s reload` | Command to reload nginx |

## Docker

Add to your existing `docker-compose.yml`:

```yaml
chr-nginx-agent:
  image: node:20-alpine
  restart: unless-stopped
  working_dir: /app
  volumes:
    - .:/app:ro
    - /etc/nginx/sites-enabled:/etc/nginx/sites-enabled
    - /etc/ssl/changerawr:/etc/ssl/changerawr
  network_mode: host
  command: sh -c "npm install && npm start"
  environment:
    AGENT_SECRET: ${NGINX_AGENT_SECRET}
    INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}
    CHANGERAWR_URL: http://localhost:3000
    UPSTREAM: http://localhost:3000
  user: root
```

## Endpoints

- `GET /health` — returns `{ ok: true, uptime: N }`
- `POST /webhook` — event receiver, requires valid `X-Chr-Signature` header

## Notes

The nginx template is not configurable. TLS settings, security headers, and proxy config are all managed by Changerawr to ensure consistent behaviour across deployments.