function requireEnv(key: string): string {
    const val = process.env[key]
    if (!val) {
        console.error(`[agent] ${key} is required`)
        process.exit(1)
    }
    return val
}

export const config = {
    port:           parseInt(process.env.AGENT_PORT ?? '7842'),
    agentSecret:    requireEnv('AGENT_SECRET'),
    changerawrUrl:  requireEnv('CHANGERAWR_URL'),
    internalSecret: requireEnv('INTERNAL_API_SECRET'),
    certDir:        process.env.CERT_DIR        ?? '/etc/ssl/changerawr',
    nginxSitesDir:  process.env.NGINX_DIR       ?? '/etc/nginx/sites-enabled',
    nginxReloadCmd: process.env.NGINX_RELOAD_CMD ?? 'nginx -s reload',
    upstream:       process.env.UPSTREAM        ?? 'http://localhost:3000',
    sandboxMode:    process.env.SANDBOX_MODE === 'true',
} as const

export function log(msg: string) {
    const prefix = config.sandboxMode ? '[SANDBOX]' : '[agent]'
    console.log(`${prefix} [${new Date().toISOString()}] ${msg}`)
}
