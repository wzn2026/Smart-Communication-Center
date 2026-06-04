import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface InboxEvent {
  type: string
  conversation_id: string
  tenant_id: string
  timestamp: string
  message?: Record<string, unknown>
  conversation?: Record<string, unknown>
  message_id?: string
  status?: string
  assigned_to?: string | null
}

export function useInboxSocket() {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const qcRef = useRef(qc)
  qcRef.current = qc

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return

      const token = localStorage.getItem('access_token')
      if (!token) return

      // VITE_WS_BASE_URL is baked in at build time for production
      // (e.g. wss://api.comm.wasal.sa/ws). Falls back to same-host /ws for dev.
      const wsBase = import.meta.env.VITE_WS_BASE_URL
        || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      const ws = new WebSocket(`${wsBase}/inbox/?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        setConnected(true)
        retriesRef.current = 0
      }

      ws.onmessage = (e) => {
        try {
          const data: InboxEvent = JSON.parse(e.data)
          const { type, conversation_id } = data
          const q = qcRef.current

          if (type === 'message.created') {
            q.invalidateQueries({ queryKey: ['messages', conversation_id] })
            q.invalidateQueries({ queryKey: ['conversations'] })
          } else if (type === 'message.status_updated') {
            q.invalidateQueries({ queryKey: ['messages', conversation_id] })
          } else if (
            type === 'conversation.created' ||
            type === 'conversation.updated' ||
            type === 'conversation.needs_human' ||
            type === 'conversation.assigned'
          ) {
            q.invalidateQueries({ queryKey: ['conversations'] })
            q.invalidateQueries({ queryKey: ['conversation', conversation_id] })
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        // Exponential backoff: 1s → 2s → 4s → … → max 30s
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000)
        retriesRef.current += 1
        timerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, []) // intentionally empty — connect once on mount

  return { connected }
}
