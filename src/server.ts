import http from 'node:http'
import { createHmac, timingSafeEqual } from 'crypto'
import { config, log } from './config'
import { AgentEvent, WebhookResponse, HealthResponse } from './types'
import { handleEvent } from './event-handler'

function verifySignature(body: string, signature: string | undefined): boolean {
    if (!signature) return false
    const expected = 'sha256=' + createHmac('sha256', config.agentSecret)
        .update(body)
        .digest('hex')
    try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
        return false
    }
}

function send<T>(res: http.ServerResponse, status: number, body: T): void {
    const json = JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
    })
    res.end(json)
}

function getAgentMode() {
    return config.sandboxMode ? 'sandbox' : 'live'
}

export function createServer(): http.Server {
    return http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/health') {
            const response: HealthResponse = {
                ok: true,
                uptime: process.uptime(),
                status: getAgentMode(),
            }
            send(res, 200, response)
            return
        }

        if (req.method !== 'POST' || req.url !== '/webhook') {
            send(res, 404, { error: 'not found' })
            return
        }

        const chunks: Buffer[] = []
        req.on('data', chunk => chunks.push(chunk))
        await new Promise(resolve => req.on('end', resolve))
        const rawBody = Buffer.concat(chunks as Uint8Array[]).toString('utf-8')

        const sig = req.headers['x-chr-signature'] as string | undefined
        if (!verifySignature(rawBody, sig)) {
            log(`rejected request — bad signature`)
            const response: WebhookResponse = {
                ok: false,
                status: getAgentMode(),
                error: 'invalid signature',
            }
            send(res, 401, response)
            return
        }

        let event: AgentEvent
        try {
            event = JSON.parse(rawBody) as AgentEvent
        } catch {
            const response: WebhookResponse = {
                ok: false,
                status: getAgentMode(),
                error: 'invalid json',
            }
            send(res, 400, response)
            return
        }

        try {
            await handleEvent(event)
            const response: WebhookResponse = {
                ok: true,
                status: getAgentMode(),
            }
            send(res, 200, response)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            log(`error: ${message}`)
            const response: WebhookResponse = {
                ok: false,
                status: getAgentMode(),
                error: message,
            }
            send(res, 500, response)
        }
    })
}
