export type AgentEvent =
    | { event: 'cert.issued';    domain: string; certId: string }
    | { event: 'cert.renewed';   domain: string; certId: string }
    | { event: 'cert.revoked';   domain: string }
    | { event: 'domain.added';   domain: string }
    | { event: 'domain.removed'; domain: string }

export type CertBundle = {
    domain:      string
    privateKey:  string
    certificate: string
    fullChain:   string
    expiresAt:   string
}

export type AgentMode = 'live' | 'sandbox'

export type WebhookResponse = {
    ok: boolean
    status: AgentMode
    error?: string
}

export type HealthResponse = {
    ok: boolean
    uptime: number
    status: AgentMode
}
