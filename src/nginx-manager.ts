import fs from 'fs/promises'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'node:path'
import { renderPending, renderActive } from '../nginx-template'
import { config, log } from './config'

const execAsync = promisify(exec)

export async function writeNginxConfig(domain: string, mode: 'pending' | 'active'): Promise<void> {
    if (config.sandboxMode) {
        log(`[SANDBOX] would write nginx config [${mode}] for ${domain}`)
        return
    }

    const configPath = path.join(config.nginxSitesDir, `${domain}.conf`)
    const opts = { domain, upstream: config.upstream, certDir: config.certDir }
    const content = mode === 'active' ? renderActive(opts) : renderPending(opts)
    await fs.writeFile(configPath, content, { mode: 0o644 })
    log(`wrote nginx config [${mode}] for ${domain}`)
}

export async function removeNginxConfig(domain: string): Promise<void> {
    if (config.sandboxMode) {
        log(`[SANDBOX] would remove nginx config for ${domain}`)
        return
    }

    const configPath = path.join(config.nginxSitesDir, `${domain}.conf`)
    try {
        await fs.unlink(configPath)
        log(`removed nginx config for ${domain}`)
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
}

export function nginxConfigExists(domain: string): boolean {
    const configPath = path.join(config.nginxSitesDir, `${domain}.conf`)
    return existsSync(configPath)
}

export async function reloadNginx(): Promise<void> {
    if (config.sandboxMode) {
        log(`[SANDBOX] would reload nginx`)
        return
    }

    log(`reloading nginx`)
    try {
        const { stdout, stderr } = await execAsync(config.nginxReloadCmd)
        if (stdout) log(stdout.trim())
        if (stderr) log(stderr.trim())
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`nginx reload failed: ${message}`)
    }
}
