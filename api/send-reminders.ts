import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { PushSubscription } from 'web-push'

type RequestLike = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
}

type ResponseLike = {
  status: (code: number) => {
    json: (body: unknown) => void
    send: (body: string) => void
  }
}

type PushSubscriptionRow = {
  endpoint: string
  user_id: string
  subscription: PushSubscription
  title: string | null
  message: string | null
  reminder_time: string
  timezone: string | null
  last_sent_date: string | null
}

const PUSH_TABLE = 'god_mode_push_subscriptions'
const DEFAULT_TITLE = 'God Mode July'
const DEFAULT_MESSAGE = 'Log today before the day gets away from you.'

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function firstQuery(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function isAuthorized(req: RequestLike): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = firstHeader(req.headers.authorization)
  const querySecret = firstQuery(req.query?.secret)
  return authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret
}

function minutesFromTime(value: string): number | null {
  const [hourPart, minutePart] = value.split(':')
  const hours = Number(hourPart)
  const minutes = Number(minutePart)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function localDateAndTime(timezone: string): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date())
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date())
  }

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00'
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  }
}

function shouldSend(row: PushSubscriptionRow): { send: boolean; localDate: string } {
  const local = localDateAndTime(row.timezone || 'UTC')
  const reminderMinutes = minutesFromTime(row.reminder_time)
  if (reminderMinutes === null) return { send: false, localDate: local.date }
  if (row.last_sent_date === local.date) return { send: false, localDate: local.date }
  return { send: local.minutes >= reminderMinutes, localDate: local.date }
}

function pushStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const statusCode = 'statusCode' in error ? error.statusCode : null
  return typeof statusCode === 'number' ? statusCode : null
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized reminder run' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:hello@example.com'

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({
      error: 'Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_VAPID_PUBLIC_KEY, or VAPID_PRIVATE_KEY.',
    })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await supabase
    .from(PUSH_TABLE)
    .select('endpoint, user_id, subscription, title, message, reminder_time, timezone, last_sent_date')
    .eq('enabled', true)
    .limit(1000)

  if (error) return res.status(500).json({ error: error.message })

  const rows = (data ?? []) as PushSubscriptionRow[]
  let attempted = 0
  let sent = 0
  let skipped = 0
  let expired = 0
  let failed = 0

  await Promise.all(rows.map(async (row) => {
    const due = shouldSend(row)
    if (!due.send) {
      skipped += 1
      return
    }

    attempted += 1
    const payload = JSON.stringify({
      title: row.title || DEFAULT_TITLE,
      body: row.message || DEFAULT_MESSAGE,
      url: '/',
    })

    try {
      await webpush.sendNotification(row.subscription, payload, {
        TTL: 60 * 60 * 12,
      })

      sent += 1
      await supabase
        .from(PUSH_TABLE)
        .update({
          last_sent_date: due.localDate,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('endpoint', row.endpoint)
    } catch (sendError) {
      const statusCode = pushStatusCode(sendError)
      if (statusCode === 404 || statusCode === 410) {
        expired += 1
        await supabase
          .from(PUSH_TABLE)
          .delete()
          .eq('endpoint', row.endpoint)
        return
      }

      failed += 1
      await supabase
        .from(PUSH_TABLE)
        .update({
          last_error: sendError instanceof Error ? sendError.message : 'Push send failed.',
          updated_at: new Date().toISOString(),
        })
        .eq('endpoint', row.endpoint)
    }
  }))

  return res.status(200).json({
    checked: rows.length,
    skipped,
    attempted,
    sent,
    expired,
    failed,
  })
}
