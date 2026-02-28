import { AgentEvent } from './types'
import { fetchCertBundle, writeCerts, removeCerts } from './cert-manager'
import { writeNginxConfig, removeNginxConfig, reloadNginx, nginxConfigExists } from './nginx-manager'
import { log } from './config'

export async function handleEvent(event: AgentEvent): Promise<void> {
    log(`${event.event} ${event.domain}`)
    log(`Event received: ${JSON.stringify(event)}`)

    switch (event.event) {
        case 'cert.issued':
        case 'cert.renewed': {
            log(`Fetching cert bundle for domain: ${event.domain}`)
            const bundle = await fetchCertBundle(event.domain)
            log(`Received bundle: domain=${bundle.domain}, expiresAt=${bundle.expiresAt}`)
            await writeCerts(bundle)
            await writeNginxConfig(event.domain, 'active')
            await reloadNginx()
            break
        }

        case 'domain.added': {
            if (!nginxConfigExists(event.domain)) {
                await writeNginxConfig(event.domain, 'pending')
                await reloadNginx()
            }
            break
        }

        case 'domain.removed':
        case 'cert.revoked': {
            await removeNginxConfig(event.domain)
            await removeCerts(event.domain)
            await reloadNginx()
            break
        }
    }
}
