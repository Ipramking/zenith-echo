const BASE = String(import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api'

export interface AssistantMessage {
  text: string
  speech: string
  privateSpeech: string
  sensitive: boolean
  tone: 'info' | 'success' | 'warning' | 'error'
}

export interface ChecklistItem {
  key: string
  label: string
  value: string | null
  done: boolean
  current: boolean
  optional: boolean
}

export interface AssistantReceipt {
  type: 'transfer' | 'airtime' | 'data' | 'electricity'
  id: string
  amount: number
  description: string
  date: string
  balanceAfter: number
  token?: string
  units?: number
}

export interface AssistantReply {
  sessionId: string
  language: 'en' | 'pcm' | 'yo'
  status: 'idle' | 'collecting' | 'confirming' | 'authorising' | 'done' | 'cancelled'
  intent: string | null
  screen: string
  title: string | null
  step: string | null
  checklist: ChecklistItem[]
  options: { id: string; label: string }[] | null
  authorisation: { required: 'pin' | 'any'; limit: number } | null
  receipt: AssistantReceipt | null
  message: AssistantMessage
  heard?: string
}

let sessionId: string | null = null

async function request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed (${response.status})`) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return data
}

function remember(reply: AssistantReply): AssistantReply {
  sessionId = reply.sessionId
  return reply
}

export function inConversation(reply: AssistantReply | null | undefined): boolean {
  return !!reply && ['collecting', 'confirming', 'authorising'].includes(reply.status)
}

export async function talk(text: string): Promise<AssistantReply> {
  return remember(await request<AssistantReply>('/assistant', { sessionId, text }))
}

export async function choose(choice: string): Promise<AssistantReply> {
  return remember(await request<AssistantReply>('/assistant', { sessionId, choice }))
}

export async function approveWithPin(pin: string): Promise<AssistantReply> {
  const status = await request<{ pin: boolean }>('/security/status', undefined, 'GET')
  if (!status.pin) await request('/security/pin', { pin })
  const { ticket } = await request<{ ticket: string }>('/security/pin/verify', { pin, sessionId })
  return remember(await request<AssistantReply>('/assistant/execute', { sessionId, ticket }))
}

export async function premiumSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${BASE}/voice/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) throw new Error('Voice unavailable')
  return response.blob()
}

const PAYMENT_WORDS =
  /\b(send|transfer|pay|give|airtime|recharge|top ?up|credit|data|bundle|gig|light|electric|electricity|nepa|meter|prepaid|abeg|wan|dey|wetin|oya|fi owo|ranse|owo|kaadi|ina)\b/i

export function wantsAssistant(text: string): boolean {
  return PAYMENT_WORDS.test(text)
}
