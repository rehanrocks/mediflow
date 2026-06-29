import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Trash2 } from 'lucide-react'

import { sendAIMessage } from '@shared/services/chatApi'
import MessageBubble from '../MessageBubble'
import MessageInput from '../MessageInput'
import TypingIndicator from '../TypingIndicator'

const SUGGESTIONS = [
  "Summarize today's appointments",
  'Who are my highest-risk patients?',
  'Show pending payments',
]

export function AITab() {
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [messages, setMessages] = useState([])
  const [takingLong, setTakingLong] = useState(false)
  const bottomRef = useRef(null)
  const idCounter = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isThinking])

  useEffect(() => {
    if (!isThinking) {
      return undefined
    }

    const timer = window.setTimeout(() => setTakingLong(true), 8000)
    return () => window.clearTimeout(timer)
  }, [isThinking])

  const history = useMemo(
    () =>
      messages.slice(-10).map((message) => ({
        content: message.content,
        role: message.role === 'assistant' ? 'assistant' : 'user',
      })),
    [messages],
  )

  function nextId(prefix) {
    idCounter.current += 1
    return `${prefix}_${idCounter.current}`
  }

  async function handleSend(nextContent = input) {
    const content = String(nextContent || '').trim()

    if (!content || isThinking) {
      return
    }

    const userMessage = {
      content,
      created_at: new Date().toISOString(),
      id: nextId('user'),
      role: 'user',
    }
    const nextHistory = [...history, { content, role: 'user' }].slice(-10)

    setMessages((currentMessages) => [...currentMessages, userMessage])
    setInput('')
    setIsThinking(true)

    try {
      const response = await sendAIMessage(content, nextHistory)
      const answer = response?.message || response?.content || response?.reply || ''
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content: answer || 'AI assistant is unavailable right now.',
          created_at: new Date().toISOString(),
          id: nextId('ai'),
          role: 'assistant',
          status: answer ? 'sent' : 'failed',
        },
      ])
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          content: 'AI assistant is unavailable right now.',
          created_at: new Date().toISOString(),
          id: nextId('ai'),
          role: 'assistant',
          status: 'failed',
        },
      ])
    } finally {
      setTakingLong(false)
      setIsThinking(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-hairline bg-canvas px-4">
        <Bot aria-hidden="true" className="h-[18px] w-[18px] text-brand" />
        <h2 className="text-[14px] font-semibold text-slate-900">AI Assistant</h2>
        <button
          className="ml-auto rounded-control p-1.5 text-slate transition hover:bg-mist hover:text-rose-500"
          onClick={() => {
            setMessages([])
            setInput('')
          }}
          type="button"
        >
          <span className="sr-only">Clear AI chat</span>
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isThinking ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <Bot aria-hidden="true" className="mb-3 h-11 w-11 text-brand/20" />
            <h3 className="text-[17px] font-semibold text-slate-900">AI Assistant</h3>
            <p className="mt-1 max-w-[260px] text-[13px] text-slate">
              Ask me anything about your patients, appointments, or clinic data.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  className="rounded-xl border border-brand/20 bg-brand-light px-3 py-2 text-[12px] font-semibold text-brand transition hover:bg-brand hover:text-white"
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message) => (
              <MessageBubble
                isAi={message.role === 'assistant'}
                isSelf={message.role === 'user'}
                key={message.id}
                message={message}
              />
            ))}
            {isThinking ? (
              <TypingIndicator
                label={takingLong ? 'This is taking longer than usual...' : undefined}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <MessageInput
        disabled={isThinking}
        onChange={setInput}
        onSend={() => handleSend()}
        placeholder="Ask AI..."
        value={input}
      />
    </div>
  )
}

export default AITab
