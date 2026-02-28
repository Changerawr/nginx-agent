// Load .env if available (for local development)
import 'dotenv/config'

// Config module will fallback to /etc/chragent.conf if needed (for Docker)
import { config, log } from './src/config'
import { createServer } from './src/server'

const server = createServer()

server.listen(config.port, () => {
    const mode = config.sandboxMode ? 'SANDBOX MODE' : 'LIVE MODE'
    log(`=== ${mode} ===`)
    log(`listening on :${config.port}`)
    log(`upstream:  ${config.upstream}`)
    log(`cert dir:  ${config.certDir}`)
    log(`nginx dir: ${config.nginxSitesDir}`)
    if (config.sandboxMode) {
        log(`*** No actual commands will be executed ***`)
    }
})
