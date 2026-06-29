import { useCallback, useEffect, useRef, useState } from 'react'

function getToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem('access_token') || localStorage.getItem('access') || ''
}

export function useWebSocket({
  enabled = true,
  onClose,
  onMessage,
  onOpen,
  url,
}) {
  const heartbeatRef = useRef(null)
  const connectRef = useRef(null)
  const manualCloseRef = useRef(false)
  const reconnectDelayRef = useRef(1000)
  const reconnectTimerRef = useRef(null)
  const wsRef = useRef(null)
  const [status, setStatus] = useState('disconnected')

  const cleanupTimers = useCallback(() => {
    window.clearInterval(heartbeatRef.current)
    window.clearTimeout(reconnectTimerRef.current)
    heartbeatRef.current = null
    reconnectTimerRef.current = null
  }, [])

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false
    }

    wsRef.current.send(JSON.stringify(payload))
    return true
  }, [])

  const disconnect = useCallback(() => {
    manualCloseRef.current = true
    cleanupTimers()
    wsRef.current?.close()
    wsRef.current = null
    setStatus('disconnected')
  }, [cleanupTimers])

  const connect = useCallback(() => {
    cleanupTimers()

    if (!enabled || !url || typeof WebSocket === 'undefined') {
      setStatus('disconnected')
      return
    }

    const token = getToken()

    if (!token) {
      setStatus('disconnected')
      return
    }

    manualCloseRef.current = false
    setStatus('connecting')

    const separator = url.includes('?') ? '&' : '?'
    const socket = new WebSocket(`${url}${separator}token=${encodeURIComponent(token)}`)
    wsRef.current = socket

    socket.onopen = () => {
      reconnectDelayRef.current = 1000
      setStatus('connected')
      onOpen?.()
      heartbeatRef.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }

    socket.onmessage = (event) => {
      try {
        onMessage?.(JSON.parse(event.data))
      } catch {
        // Ignore malformed frames; the backend will send the next valid state.
      }
    }

    socket.onerror = () => {
      setStatus('error')
      socket.close()
    }

    socket.onclose = () => {
      cleanupTimers()
      wsRef.current = null
      onClose?.()

      if (manualCloseRef.current || !enabled) {
        setStatus('disconnected')
        return
      }

      setStatus('disconnected')
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000)
        connectRef.current?.()
      }, reconnectDelayRef.current)
    }
  }, [cleanupTimers, enabled, onClose, onMessage, onOpen, url])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    const timer = window.setTimeout(() => connect(), 0)

    return () => {
      window.clearTimeout(timer)
      disconnect()
    }
  }, [connect, disconnect])

  return { disconnect, send, status }
}

export default useWebSocket
