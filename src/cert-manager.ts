import http from 'node:http'
import https from 'https'
import fs from 'fs/promises'
import path from 'node:path'
import { config, log } from './config'
import { CertBundle } from './types'

export async function fetchCertBundle(domain: string): Promise<CertBundle> {
    const url = `${config.changerawrUrl}/api/internal/cert/${encodeURIComponent(domain)}`
    log(`fetching cert for ${domain}`)

    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http
        const req = lib.get(url, {
            headers: { 'x-internal-secret': config.internalSecret },
        }, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Changerawr returned ${res.statusCode}: ${body}`))
                    return
                }
                try {
                    const parsed = JSON.parse(body)
                    log(`API response: ${JSON.stringify(parsed)}`)

                    // Ensure the bundle has a domain field
                    const bundle = parsed as CertBundle
                    if (!bundle.domain) {
                        log(`WARNING: API did not return domain field, using requested domain: ${domain}`)
                        bundle.domain = domain
                    }

                    resolve(bundle)
                } catch {
                    reject(new Error(`Invalid JSON: ${body}`))
                }
            })
        })
        req.on('error', reject)
        req.setTimeout(10_000, () => req.destroy(new Error('Request timed out')))
    })
}

export async function writeCerts(bundle: CertBundle): Promise<void> {
    if (config.sandboxMode) {
        log(`[SANDBOX] would write certs for ${bundle.domain} (expires ${bundle.expiresAt})`)
        return
    }

    log(`writeCerts: certDir=${config.certDir} (type: ${typeof config.certDir}), domain=${bundle.domain}`)

    if (!config.certDir) {
        throw new Error(`CERT_DIR is not configured (value: ${config.certDir})`)
    }

    // Validate cert data
    if (!bundle.privateKey || !bundle.fullChain || !bundle.certificate) {
        throw new Error(`Invalid cert bundle: privateKey=${!!bundle.privateKey}, fullChain=${!!bundle.fullChain}, certificate=${!!bundle.certificate}`)
    }

    // Check if the cert data looks like valid PEM
    if (!bundle.fullChain.includes('BEGIN CERTIFICATE')) {
        log(`ERROR: fullChain doesn't look like a valid PEM certificate`)
        log(`fullChain preview: ${bundle.fullChain.substring(0, 200)}`)
        throw new Error('Invalid fullChain format - missing BEGIN CERTIFICATE')
    }

    if (!bundle.privateKey.includes('BEGIN')) {
        log(`ERROR: privateKey doesn't look like a valid PEM key`)
        log(`privateKey preview: ${bundle.privateKey.substring(0, 200)}`)
        throw new Error('Invalid privateKey format - missing BEGIN marker')
    }

    const dir = path.join(config.certDir, bundle.domain)
    log(`writeCerts: computed dir=${dir}`)

    try {
        await fs.mkdir(dir, { recursive: true })
        log(`Created directory: ${dir}`)
    } catch (err) {
        log(`ERROR creating directory: ${err}`)
        throw err
    }

    // Atomic writes — nginx never reads a partial file
    try {
        log(`Writing temp files...`)
        await fs.writeFile(`${dir}/privkey.pem.tmp`,   bundle.privateKey,  { mode: 0o600 })
        log(`  wrote privkey.pem.tmp`)
        await fs.writeFile(`${dir}/fullchain.pem.tmp`, bundle.fullChain,   { mode: 0o644 })
        log(`  wrote fullchain.pem.tmp`)
        await fs.writeFile(`${dir}/cert.pem.tmp`,      bundle.certificate, { mode: 0o644 })
        log(`  wrote cert.pem.tmp`)
        await fs.writeFile(`${dir}/expires.txt.tmp`,   bundle.expiresAt,   { mode: 0o644 })
        log(`  wrote expires.txt.tmp`)
    } catch (err) {
        log(`ERROR writing temp files: ${err}`)
        throw err
    }

    try {
        log(`Renaming temp files to final names...`)
        await fs.rename(`${dir}/privkey.pem.tmp`,   `${dir}/privkey.pem`)
        log(`  renamed privkey.pem`)
        await fs.rename(`${dir}/fullchain.pem.tmp`, `${dir}/fullchain.pem`)
        log(`  renamed fullchain.pem`)
        await fs.rename(`${dir}/cert.pem.tmp`,      `${dir}/cert.pem`)
        log(`  renamed cert.pem`)
        await fs.rename(`${dir}/expires.txt.tmp`,   `${dir}/expires.txt`)
        log(`  renamed expires.txt`)
    } catch (err) {
        log(`ERROR renaming files: ${err}`)
        throw err
    }

    log(`wrote certs for ${bundle.domain} (expires ${bundle.expiresAt})`)
    log(`  fullchain size: ${bundle.fullChain.length} bytes`)
    log(`  privkey size: ${bundle.privateKey.length} bytes`)

    // Verify files were actually written
    try {
        const stat = await fs.stat(`${dir}/fullchain.pem`)
        log(`  fullchain.pem exists: ${stat.size} bytes on disk`)
    } catch (err) {
        log(`ERROR: fullchain.pem was not written! ${err}`)
        throw new Error('Certificate files were not written to disk')
    }
}

export async function removeCerts(domain: string): Promise<void> {
    if (config.sandboxMode) {
        log(`[SANDBOX] would remove certs for ${domain}`)
        return
    }

    const dir = path.join(config.certDir, domain)
    await fs.rm(dir, { recursive: true, force: true })
    log(`removed certs for ${domain}`)
}
