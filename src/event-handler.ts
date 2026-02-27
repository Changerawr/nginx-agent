import { AgentEvent } from './types'
import { fetchCertBundle, writeCerts, removeCerts } from './cert-manager'
import { writeNginxConfig, removeNginxConfig, reloadNginx, nginxConfigExists } from './nginx-manager'
import { log } from './config'

export async function handleEvent(event: AgentEvent): Promise<void> {
    log(`${event.event} ${event.domain}`)

    switch (event.event) {
        case 'cert.issued':
        case 'cert.renewed': {
            const bundle = await fetchCertBundle(event.domain)
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
