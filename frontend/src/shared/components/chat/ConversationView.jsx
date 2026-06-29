import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Search, Users, X } from 'lucide-react'

import SkeletonRow from '@shared/components/SkeletonRow'
import { useChatContext } from '@shared/context/ChatContext'
import { useChatScroll } from '@shared/hooks/useChatScroll'
import { useDebounce } from '@shared/hooks/useDebounce'
import { convKey, groupMessages } from '@shared/lib/chatUtils'
import { getGroupDetail, searchMessages } from '@shared/services/chatApi'
import ChatAvatar from './ChatAvatar'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'
import OnlineStatus from './OnlineStatus'
import TypingIndicator from './TypingIndicator'

function getUserName(user = {}) {
  return (
    user.full_name ||
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.name ||
    user.email ||
    'MediFlow User'
  )
}

function getMessageId(message, index) {
  return message?.id ?? message?.message_id ?? message?.temp_id ?? `message_${index}`
}

function isSameDate(first, second) {
  if (!first || !second) {
    return false
  }

  return new Date(first).toDateString() === new Date(second).toDateString()
}

function DateSeparator({ value }) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const label =
    date.toDateString() === today.toDateString()
      ? 'Today'
      : date.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

  return (
    <div className="my-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-hairline" />
      <span className="rounded-full bg-mist px-3 py-0.5 text-[10px] font-medium text-slate/60">
        {label}
      </span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  )
}

function GroupAvatar({ group }) {
  const name = group?.name || 'Group'

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#6366F1] text-[13px] font-bold text-white">
      {name[0]?.toUpperCase() || 'G'}
    </span>
  )
}

export function ConversationView({ entity, group = false, memberCount, onBack, title }) {
  const {
    currentUserId,
    hasMoreMessages,
    loadMoreMessages,
    markAsRead,
    messages,
    retryMessage,
    sendMessage,
    setTyping,
    typingUsers,
    wsStatus,
  } = useChatContext()
  const entityId = entity?.id ?? entity?.user_id
  const conversationKey = entityId
    ? (group ? convKey.group(entityId) : convKey.dm(entityId))
    : ''
  const messageList = useMemo(
    () => messages.get(conversationKey) || [],
    [conversationKey, messages],
  )
  const groupedMessages = useMemo(() => groupMessages(messageList), [messageList])
  const hasMore = hasMoreMessages.get(conversationKey) !== false
  const [input, setInput] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')
  const [remoteMatchIds, setRemoteMatchIds] = useState(() => new Set())
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchTouched, setSearchTouched] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [members, setMembers] = useState([])
  const [membersOpen, setMembersOpen] = useState(false)
  const debouncedSearch = useDebounce(messageSearch, 400)
  const loadedOnce = useRef(new Set())
  const messageRefs = useRef(new Map())
  const previousLength = useRef(messageList.length)
  const typingStartTime = useRef(0)
  const typingStopTimer = useRef(null)
  const { autoScroll, bottomRef, containerRef, onScroll } = useChatScroll(messageList, hasMore)
  const typingSet = typingUsers.get(conversationKey) || new Set()
  const otherTyping = [...typingSet].some((userId) => userId !== currentUserId)

  useEffect(() => {
    if (!conversationKey || loadedOnce.current.has(conversationKey)) {
      return
    }

    loadedOnce.current.add(conversationKey)
    loadMoreMessages(conversationKey).then(() => markAsRead(conversationKey))
  }, [conversationKey, loadMoreMessages, markAsRead])

  useEffect(() => {
    if (!group || !entity?.id) {
      setMembers([])
      return
    }

    let cancelled = false

    getGroupDetail(entity.id).then((detail) => {
      if (cancelled) return
      setMembers(
        (detail?.members || []).map((m) => ({
          id: m.user?.id,
          name: m.user?.full_name || m.user?.email || 'Unknown',
          is_admin: m.is_admin,
        })),
      )
    }).catch(() => {
      if (!cancelled) setMembers([])
    })

    return () => { cancelled = true }
  }, [group, entity?.id])

  useEffect(() => {
    if (messageList.length > previousLength.current && !autoScroll) {
      setShowNewMessage(true)
    }

    previousLength.current = messageList.length
  }, [autoScroll, messageList.length])

  useEffect(() => {
    if (!conversationKey || !debouncedSearch.trim()) {
      const timer = window.setTimeout(() => {
        setRemoteMatchIds(new Set())
        setSearchTouched(false)
      }, 0)

      return () => window.clearTimeout(timer)
    }

    let cancelled = false
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setSearchLoading(true)
        setSearchTouched(true)
      }
    }, 0)

    searchMessages(conversationKey, debouncedSearch.trim())
      .then((response) => {
        if (cancelled) {
          return
        }

        const results = Array.isArray(response?.results)
          ? response.results
          : Array.isArray(response)
            ? response
            : []
        setRemoteMatchIds(new Set(results.map((message) => getMessageId(message)).filter(Boolean)))
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteMatchIds(new Set())
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false)
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(loadingTimer)
    }
  }, [conversationKey, debouncedSearch])

  const localMatchIndexes = useMemo(() => {
    const query = messageSearch.trim().toLowerCase()

    if (!query) {
      return new Set()
    }

    return new Set(
      groupedMessages
        .map((message, index) =>
          String(message.content || message.message || '').toLowerCase().includes(query)
            ? index
            : -1,
        )
        .filter((index) => index >= 0),
    )
  }, [groupedMessages, messageSearch])

  useEffect(() => {
    if (!messageSearchOpen || !messageSearch.trim()) {
      return
    }

    const firstIndex = groupedMessages.findIndex((message, index) => {
      const id = getMessageId(message, index)
      return remoteMatchIds.has(id) || localMatchIndexes.has(index)
    })

    if (firstIndex >= 0) {
      const id = getMessageId(groupedMessages[firstIndex], firstIndex)
      messageRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [groupedMessages, localMatchIndexes, messageSearch, messageSearchOpen, remoteMatchIds])

  async function handleLoadMore() {
    if (loadingMore || !hasMore) {
      return
    }

    setLoadingMore(true)
    await loadMoreMessages(conversationKey)
    setLoadingMore(false)
  }

  function handleScroll(event) {
    const shouldLoadMore = onScroll(event)

    if (shouldLoadMore) {
      handleLoadMore()
    }

    if (autoScroll) {
      setShowNewMessage(false)
    }
  }

  function clearMessageSearch() {
    setMessageSearchOpen(false)
    setMessageSearch('')
    setRemoteMatchIds(new Set())
    setSearchTouched(false)
  }

  function sendTypingStart() {
    const now = Date.now()

    if (now - typingStartTime.current > 2000) {
      setTyping(conversationKey, true)
      typingStartTime.current = now
    }

    window.clearTimeout(typingStopTimer.current)
    typingStopTimer.current = window.setTimeout(() => {
      setTyping(conversationKey, false)
    }, 2000)
  }

  function stopTyping() {
    window.clearTimeout(typingStopTimer.current)
    setTyping(conversationKey, false)
  }

  function handleSend() {
    if (!input.trim()) {
      return
    }

    sendMessage(conversationKey, input)
    setInput('')
    stopTyping()
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowNewMessage(false)
  }

  const noSearchResults =
    searchTouched &&
    !searchLoading &&
    messageSearch.trim() &&
    remoteMatchIds.size === 0 &&
    localMatchIndexes.size === 0

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-hairline bg-canvas px-3">
        <button
          className="rounded-control p-1 text-slate transition hover:bg-mist hover:text-brand"
          onClick={onBack}
          type="button"
        >
          <span className="sr-only">Back to list</span>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        {group ? <GroupAvatar group={entity} /> : <ChatAvatar showOnline size="sm" user={entity} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-slate-900">
            {title || getUserName(entity)}
          </p>
          {group ? (
            <p className="text-[11px] font-medium text-slate/60">
              {memberCount || entity?.member_count || entity?.members?.length || 0} members
            </p>
          ) : (
            <OnlineStatus user={entity} />
          )}
        </div>
        <button
          className="rounded-control p-1.5 text-slate transition hover:bg-mist hover:text-brand"
          onClick={() => setMessageSearchOpen((open) => !open)}
          type="button"
        >
          <span className="sr-only">Search messages</span>
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
        {group ? (
          <div className="relative">
            <button
              className="rounded-control p-1.5 text-slate transition hover:bg-mist hover:text-brand"
              onClick={() => setMembersOpen((o) => !o)}
              type="button"
            >
              <span className="sr-only">Group members</span>
              <Users aria-hidden="true" className="h-4 w-4" />
            </button>
            {membersOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-[220px] overflow-hidden rounded-card border border-hairline bg-canvas shadow-card animate-scale-in">
                <div className="border-b border-hairline px-3 py-2">
                  <p className="text-[12px] font-semibold text-slate-900">
                    Members ({members.length})
                  </p>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {members.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[12px] text-slate">Loading...</p>
                  ) : (
                    members.map((m) => (
                      <div
                        className="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-0"
                        key={m.id}
                      >
                        <ChatAvatar name={m.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
                          {m.name}
                        </span>
                        {m.is_admin ? (
                          <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">
                            Admin
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div
        className={[
          'shrink-0 overflow-hidden border-b border-hairline bg-mist transition-all duration-200',
          messageSearchOpen ? 'max-h-20 px-3 py-2' : 'max-h-0 px-3 py-0',
        ].join(' ')}
      >
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate"
          />
          <input
            className="h-9 w-full rounded-xl border-none bg-canvas pl-9 pr-9 text-[13px] text-slate-900 outline-none placeholder:text-slate/50"
            onChange={(event) => setMessageSearch(event.target.value)}
            placeholder="Search messages..."
            value={messageSearch}
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-control p-1 text-slate transition hover:text-brand"
            onClick={clearMessageSearch}
            type="button"
          >
            <span className="sr-only">Close search</span>
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {wsStatus !== 'connected' ? (
        <div className="bg-amber-50 px-4 py-2 text-center text-[12px] font-medium text-amber-700">
          Reconnecting...
        </div>
      ) : null}

      <div
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3"
        onScroll={handleScroll}
        ref={containerRef}
      >
        {loadingMore ? (
          <div className="space-y-2 pb-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonRow index={index} key={index} variant="chat" />
            ))}
          </div>
        ) : null}
        {messageList.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[13px] font-medium italic text-slate">
            No messages yet
          </div>
        ) : (
          groupedMessages.map((message, index) => {
            const id = getMessageId(message, index)
            const isSelf =
              message.sender_id === currentUserId || message.sender?.id === currentUserId
            const senderName = group && !isSelf ? getUserName(message.sender) : ''
            const highlight = remoteMatchIds.has(id) || localMatchIndexes.has(index)
            const previous = groupedMessages[index - 1]

            return (
              <div
                key={id}
                ref={(node) => {
                  if (node) {
                    messageRefs.current.set(id, node)
                  }
                }}
              >
                {!previous || !isSameDate(previous.created_at, message.created_at) ? (
                  <DateSeparator value={message.created_at} />
                ) : null}
                <MessageBubble
                  highlight={highlight}
                  isSelf={isSelf}
                  message={message}
                  onRetry={(failedMessage) => retryMessage(conversationKey, failedMessage)}
                  senderName={senderName}
                  showAvatar={!message.isGrouped}
                  user={message.sender || entity}
                />
              </div>
            )
          })
        )}
        {otherTyping ? <TypingIndicator /> : null}
        {noSearchResults ? (
          <div className="py-4 text-center text-[13px] font-medium text-slate">
            No messages found
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {showNewMessage ? (
        <button
          className="absolute bottom-[62px] left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white shadow-card"
          onClick={scrollToBottom}
          type="button"
        >
          New message
        </button>
      ) : null}
      <MessageInput
        disabled={wsStatus !== 'connected'}
        onBlur={stopTyping}
        onChange={setInput}
        onSend={handleSend}
        onTyping={sendTypingStart}
        value={input}
      />
    </div>
  )
}

export default ConversationView
