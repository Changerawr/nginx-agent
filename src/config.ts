import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load config from chragent.conf if .env is not loaded
function loadConfigFile() {
    // Look in the project root (one level up from src/)
    const configPath = resolve(__dirname, '..', 'chragent.conf')

    // Try chragent.conf if env vars seem missing
    if (!process.env.AGENT_SECRET && existsSync(configPath)) {
        console.log(`[agent] Loading config from ${configPath}`)
        const content = readFileSync(configPath, 'utf-8')
        content.split('\n').forEach(line => {
            line = line.trim()
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=')
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').replace(/^["']|["']$/g, '')
                    process.env[key.trim()] = value.trim()
                }
            }
        })
    }
}

loadConfigFile()

function requireEnv(key: string): string {
    const val = process.env[key]
    if (!val) {
        console.error(`[agent] ${key} is required (check .env or chragent.conf)`)
        process.exit(1)
    }
    return val
}

function getEnv(key: string, defaultValue: string): string {
    const val = process.env[key]
    if (!val || val.trim() === '') {
        return defaultValue
    }
    return val
}

export const config = {
    port:           parseInt(process.env.AGENT_PORT ?? '7842'),
    agentSecret:    requireEnv('AGENT_SECRET'),
    changerawrUrl:  requireEnv('CHANGERAWR_URL'),
    internalSecret: requireEnv('INTERNAL_API_SECRET'),
    certDir:        getEnv('CERT_DIR', '/etc/ssl/changerawr'),
    nginxSitesDir:  getEnv('NGINX_DIR', '/etc/nginx/sites-enabled'),
    nginxReloadCmd: getEnv('NGINX_RELOAD_CMD', 'nginx -s reload'),
    upstream:       getEnv('UPSTREAM', 'http://localhost:3000'),
    sandboxMode:    process.env.SANDBOX_MODE === 'true',
} as const

// Debug logging
console.log('[config] Loaded configuration:')
console.log(`  CERT_DIR: ${config.certDir} (type: ${typeof config.certDir})`)
console.log(`  NGINX_DIR: ${config.nginxSitesDir} (type: ${typeof config.nginxSitesDir})`)
console.log(`  UPSTREAM: ${config.upstream}`)
console.log(`  SANDBOX_MODE: ${config.sandboxMode}`)

export function log(msg: string) {
    const prefix = config.sandboxMode ? '[SANDBOX]' : '[agent]'
    console.log(`${prefix} [${new Date().toISOString()}] ${msg}`)
}
