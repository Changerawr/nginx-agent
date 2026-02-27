interface TemplateOptions {
    domain:   string
    upstream: string
    certDir:  string
}

export function certPaths(domain: string, certDir: string) {
    const base = `${certDir}/${domain}`
    return {
        fullchain: `${base}/fullchain.pem`,
        privkey:   `${base}/privkey.pem`,
    } as const
}

// Written when a domain is added but no cert exists yet.
// Proxies everything so the ACME challenge can be served.
// Replaced entirely by renderActive() on cert.issued.
export function renderPending(opts: TemplateOptions): string {
    const { domain, upstream } = opts

    return `# chr-nginx-agent: PENDING
# Do not edit — this file is managed by Changerawr.
# Generated: ${new Date().toISOString()}

server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    location /.well-known/acme-challenge/ {
        proxy_pass        ${upstream};
        proxy_set_header  Host              $host;
        proxy_set_header  X-Real-IP         $remote_addr;
        proxy_set_header  X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header  X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass              ${upstream};
        proxy_http_version      1.1;
        proxy_set_header        Upgrade           $http_upgrade;
        proxy_set_header        Connection        "upgrade";
        proxy_set_header        Host              $host;
        proxy_set_header        X-Real-IP         $remote_addr;
        proxy_set_header        X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header        X-Forwarded-Proto $scheme;
        proxy_read_timeout      60s;
        proxy_send_timeout      60s;
        proxy_connect_timeout   10s;
    }
}
`
}

// Written after cert.issued. HTTP block handles ACME passthrough and
// redirects everything else to HTTPS. HTTPS block is the full proxy.
//
// Security settings are intentionally not configurable:
//   - TLSv1.2 + TLSv1.3 only
//   - HSTS without includeSubDomains (we don't control operator subdomains)
//   - No preload (irreversible, belongs to the domain owner)
//   - server_tokens off, X-Powered-By hidden
//   - Session cache named CHR to avoid collisions with other nginx caches
export function renderActive(opts: TemplateOptions): string {
    const { domain, upstream, certDir } = opts
    const paths = certPaths(domain, certDir)

    return `# chr-nginx-agent: ACTIVE
# Do not edit — this file is managed by Changerawr.
# Generated: ${new Date().toISOString()}

server {
    listen 80;
    listen [::]:80;
    server_name ${domain};
    server_tokens off;

    # ACME HTTP-01 — must never be redirected to HTTPS
    location /.well-known/acme-challenge/ {
        proxy_pass        ${upstream};
        proxy_set_header  Host              $host;
        proxy_set_header  X-Real-IP         $remote_addr;
        proxy_set_header  X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header  X-Forwarded-Proto $scheme;
    }

    location / {
        return 308 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${domain};
    server_tokens off;

    ssl_certificate      ${paths.fullchain};
    ssl_certificate_key  ${paths.privkey};

    ssl_protocols              TLSv1.2 TLSv1.3;
    ssl_ciphers                ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers  off;

    ssl_session_cache    shared:CHR:10m;
    ssl_session_timeout  1d;
    ssl_session_tickets  off;

    ssl_stapling         on;
    ssl_stapling_verify  on;
    resolver             1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout     5s;

    add_header  Strict-Transport-Security  "max-age=63072000"            always;
    add_header  X-Content-Type-Options     "nosniff"                     always;
    add_header  X-Frame-Options            "SAMEORIGIN"                  always;
    add_header  Referrer-Policy            "no-referrer-when-downgrade"  always;
    add_header  X-Powered-By              ""                             always;

    location / {
        proxy_pass              ${upstream};
        proxy_http_version      1.1;
        proxy_set_header        Upgrade           $http_upgrade;
        proxy_set_header        Connection        "upgrade";
        proxy_set_header        Host              $host;
        proxy_set_header        X-Real-IP         $remote_addr;
        proxy_set_header        X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header        X-Forwarded-Proto $scheme;
        proxy_hide_header       X-Powered-By;
        proxy_read_timeout      60s;
        proxy_send_timeout      60s;
        proxy_connect_timeout   10s;
        proxy_buffering         on;
        proxy_buffer_size       4k;
        proxy_buffers           8 4k;
    }
}
`
}