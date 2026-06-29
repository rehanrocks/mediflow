/* eslint-disable react-refresh/only-export-components -- Chat context exports provider and hook together. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import { useWebSocket } from '@shared/hooks/useWebSocket'
import { convKey, getConversationId, getConversationKind, normalizeMessageList } from '@shared/lib/chatUtils'
import { getUserId, normalizeRoleSlug } from '@shared/lib/chatRbac'
import { PUBLIC_ROUTES_FOR_TESTING } from '@shared/lib/testingAccess'
import { api } from '@shared/services/api'
import {
  createGroup as createGroupRequest,
  getChatUsers,
  getConversations,
  getDMHistory,
  getGroupMessages,
  getMyGroups,
} from '@shared/services/chatApi'

const ChatContext = createContext(null)
const HIDDEN_CHAT_ROUTES = ['/login', '/change-password']

function getAccessToken() {
  if (typeof window === 'undefined' || PUBLIC_ROUTES_FOR_TESTING) {
    return ''
  }

  return localStorage.getItem('access_token') || localStorage.getItem('access') || ''
}

function isChatHiddenPath(pathname = '') {
  return HIDDEN_CHAT_ROUTES.includes(pathname)
}

function getChatWebSocketUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  const baseUrl = new URL(api.defaults.baseURL || '/api', window.location.origin)
  const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  const rootPath = baseUrl.pathname.replace(/\/api\/?$/, '').replace(/\/$/, '')

  return `${protocol}//${baseUrl.host}${rootPath}/ws/chat/`
}

function normalizeArray(response) {
  if (Array.isArray(response?.results)) {
    return response.results
  }

  if (Array.isArray(response)) {
    return response
  }

  return []
}

function toConversationMap(response) {
  return normalizeArray(response).reduce((nextMap, conversation) => {
    const userId =
      conversation.user_id ||
      conversation.other_user_id ||
      conversation.user?.id ||
      conversation.user?.user_id

    if (userId) {
      nextMap.set(userId, conversation)
    }

    return nextMap
  }, new Map())
}

function getMessageId(message) {
  return message?.id ?? message?.message_id ?? message?.temp_id
}

function getLatestMessageId(messages = []) {
  const latest = [...messages].reverse().find((message) => getMessageId(message))
  return getMessageId(latest)
}

function getLatestIncomingMessageId(messages = [], currentUserId) {
  const latest = [...messages].reverse().find(
    (message) =>
      getMessageId(message) &&
      message.sender_id !== currentUserId &&
      message.sender?.id !== currentUserId,
  )

  return getMessageId(latest)
}

function getActiveConversationKey(activeConversation) {
  if (!activeConversation?.type || !activeConversation.id) {
    return ''
  }

  if (activeConversation.type === 'group') {
    return convKey.group(activeConversation.id)
  }

  return convKey.dm(activeConversation.id)
}

export function ChatProvider({ children }) {
  const { role, user } = useAuth()
  const location = useLocation()
  const messagePages = useRef(new Map())
  const typingTimers = useRef(new Map())
  const currentRole = normalizeRoleSlug(role || user?.role)
  const currentUserId = getUserId(user)
  const token = getAccessToken()
  const chatAvailable =
    Boolean(user) &&
    Boolean(token) &&
    !PUBLIC_ROUTES_FOR_TESTING &&
    currentRole !== 'patient' &&
    !isChatHiddenPath(location.pathname)

  const [activeConversation, setActiveConversation] = useState({
    data: null,
    id: null,
    type: null,
  })
  const [activeTab, setActiveTab] = useState('users')
  const [chatUsers, setChatUsers] = useState([])
  const [conversations, setConversations] = useState(() => new Map())
  const [groups, setGroups] = useState([])
  const [hasMoreMessages, setHasMoreMessages] = useState(() => new Map())
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState(() => new Map())
  const [onlineUsers, setOnlineUsers] = useState(() => new Set())
  const [typingUsers, setTypingUsers] = useState(() => new Map())
  const [unreadCounts, setUnreadCounts] = useState(() => new Map())

  const activeConversationKey = useMemo(
    () => getActiveConversationKey(activeConversation),
    [activeConversation],
  )
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const activeConversationKeyRef = useRef(activeConversationKey)
  activeConversationKeyRef.current = activeConversationKey
  const currentUserIdRef = useRef(currentUserId)
  currentUserIdRef.current = currentUserId
  const wsUrl = useMemo(() => (chatAvailable ? getChatWebSocketUrl() : ''), [chatAvailable])

  const clearTypingUser = useCallback((conversationKey, userId) => {
    setTypingUsers((currentTyping) => {
      const nextTyping = new Map(currentTyping)
      const currentSet = new Set(nextTyping.get(conversationKey) || [])
      currentSet.delete(userId)

      if (currentSet.size) {
        nextTyping.set(conversationKey, currentSet)
      } else {
        nextTyping.delete(conversationKey)
      }

      return nextTyping
    })
  }, [])

  const appendMessage = useCallback((conversationKey, message) => {
    if (!conversationKey || !message) {
      return
    }

    setMessages((currentMessages) => {
      const nextMessages = new Map(currentMessages)
      const currentList = nextMessages.get(conversationKey) || []
      const messageId = getMessageId(message)
      const withoutDuplicate = currentList.filter((currentMessage) => {
        const currentMessageId = getMessageId(currentMessage)

        if (messageId && currentMessageId === messageId) {
          return false
        }

        return !(
          currentMessage.status === 'sending' &&
          currentMessage.content === message.content &&
          currentMessage.sender_id === message.sender_id
        )
      })

      nextMessages.set(conversationKey, [
        ...withoutDuplicate,
        { ...message, status: message.status || 'sent' },
      ])

      return nextMessages
    })
  }, [])

  function patchConversation(conversationKey, message) {
    if (!conversationKey || !message) {
      return
    }

    const kind = getConversationKind(conversationKey)
    const id = getConversationId(conversationKey)

    if (kind === 'dm') {
      const userId = Number(id)
      setConversations((currentConversations) => {
        const nextConversations = new Map(currentConversations)
        const existing = nextConversations.get(userId) || {}
        nextConversations.set(userId, {
          ...existing,
          user_id: userId,
          last_message: message.content || existing.last_message,
          last_message_time: message.created_at || new Date().toISOString(),
        })
        return nextConversations
      })

      setChatUsers((currentUsers) => {
        const idx = currentUsers.findIndex(
          (u) => (u.id || u.user_id) === userId,
        )
        if (idx <= 0) return currentUsers
        const user = currentUsers[idx]
        const next = [...currentUsers]
        next.splice(idx, 1)
        next.unshift(user)
        return next
      })
    }

    if (kind === 'group') {
      const groupId = Number(id)
      setGroups((currentGroups) => {
        const idx = currentGroups.findIndex((g) => g.id === groupId)
        if (idx <= 0) return currentGroups
        const group = currentGroups[idx]
        const next = [...currentGroups]
        next.splice(idx, 1)
        next.unshift({
          ...group,
          last_message: {
            content: message.content || group.last_message?.content || '',
            sender_id: message.sender_id || group.last_message?.sender_id,
            created_at: message.created_at || group.last_message?.created_at || new Date().toISOString(),
          },
          last_message_time: message.created_at || new Date().toISOString(),
          last_message_sender_name: message.sender_name || group.last_message_sender_name,
        })
        return next
      })
    }
  }

  const handleMessage = useCallback(
    (event) => {
      if (!event?.type) {
        return
      }

      if (event.type === 'message' || event.type === 'group_message') {
        const conversationKey = event.conversation
        appendMessage(conversationKey, event.data)
        patchConversation(conversationKey, event.data)

        if (
          event.data?.sender_id !== currentUserIdRef.current &&
          (!isOpenRef.current || activeConversationKeyRef.current !== conversationKey)
        ) {
          setUnreadCounts((currentCounts) => {
            const nextCounts = new Map(currentCounts)
            nextCounts.set(conversationKey, (nextCounts.get(conversationKey) || 0) + 1)
            return nextCounts
          })
        }
      }

      if (event.type === 'error') {
        setMessages((currentMessages) => {
          const conversationKey = event.conversation
          if (!conversationKey) return currentMessages

          const nextMessages = new Map(currentMessages)
          const currentList = nextMessages.get(conversationKey) || []

          const lastSending = [...currentList].reverse().find(
            (m) => m.status === 'sending' && m.sender_id === currentUserIdRef.current,
          )

          if (lastSending) {
            nextMessages.set(
              conversationKey,
              currentList.map((m) =>
                m.temp_id === lastSending.temp_id
                  ? { ...m, status: 'failed', error: event.message || 'Message could not be sent' }
                  : m,
              ),
            )
          }

          return nextMessages
        })

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('mediflow:toast', {
              detail: { message: event.message || 'Message failed to send', type: 'error' },
            }),
          )
        }
      }

      if (event.type === 'typing') {
        const conversationKey = event.conversation
        const userId = event.user_id

        if (!conversationKey || !userId || userId === currentUserIdRef.current) {
          return
        }

        window.clearTimeout(typingTimers.current.get(`${conversationKey}:${userId}`))

        if (!event.is_typing) {
          clearTypingUser(conversationKey, userId)
          return
        }

        setTypingUsers((currentTyping) => {
          const nextTyping = new Map(currentTyping)
          const currentSet = new Set(nextTyping.get(conversationKey) || [])
          currentSet.add(userId)
          nextTyping.set(conversationKey, currentSet)
          return nextTyping
        })
        typingTimers.current.set(
          `${conversationKey}:${userId}`,
          window.setTimeout(() => clearTypingUser(conversationKey, userId), 3000),
        )
      }

      if (event.type === 'read') {
        setMessages((currentMessages) => {
          const nextMessages = new Map(currentMessages)
          const currentList = nextMessages.get(event.conversation) || []
          nextMessages.set(
            event.conversation,
            currentList.map((message) =>
              getMessageId(message) === event.message_id ? { ...message, status: 'read' } : message,
            ),
          )
          return nextMessages
        })
      }

      if (event.type === 'online') {
        setOnlineUsers((currentUsers) => {
          const nextUsers = new Set(currentUsers)

          if (event.is_online) {
            nextUsers.add(event.user_id)
          } else {
            nextUsers.delete(event.user_id)
          }

          return nextUsers
        })
      }
    },
    [appendMessage, clearTypingUser],
  )

  const { disconnect, send, status: wsStatus } = useWebSocket({
    enabled: chatAvailable,
    onMessage: handleMessage,
    url: wsUrl,
  })

  const totalUnread = useMemo(
    () => [...unreadCounts.values()].reduce((sum, count) => sum + count, 0),
    [unreadCounts],
  )

  const openChat = useCallback(
    (tab = activeTab) => {
      if (!chatAvailable) {
        return
      }

      setActiveTab(tab)
      setIsOpen(true)
    },
    [activeTab, chatAvailable],
  )

  const closeChat = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openConversation = useCallback(
    (type, id, data = null) => {
      if (!chatAvailable) {
        return
      }

      const conversationKey = type === 'group' ? convKey.group(id) : convKey.dm(id)
      setActiveConversation({ data, id, type })
      setActiveTab(type === 'group' ? 'groups' : 'users')
      setIsOpen(true)
      setUnreadCounts((currentCounts) => {
        const nextCounts = new Map(currentCounts)
        nextCounts.set(conversationKey, 0)
        return nextCounts
      })
    },
    [chatAvailable],
  )

  const backToList = useCallback(() => {
    setActiveConversation({ data: null, id: null, type: null })
  }, [])

  const sendMessage = useCallback(
    (conversationKey, content) => {
      const trimmedContent = String(content || '').trim()

      if (!conversationKey || !trimmedContent) {
        return null
      }

      const optimisticMessage = {
        content: trimmedContent,
        created_at: new Date().toISOString(),
        sender_id: currentUserId,
        status: 'sending',
        temp_id: `local_${Date.now()}`,
      }

      appendMessage(conversationKey, optimisticMessage)
      patchConversation(conversationKey, optimisticMessage)

      const didSend = send({
        content: trimmedContent,
        conversation: conversationKey,
        type: 'send_message',
      })

      if (!didSend) {
        setMessages((currentMessages) => {
          const nextMessages = new Map(currentMessages)
          const currentList = nextMessages.get(conversationKey) || []
          nextMessages.set(
            conversationKey,
            currentList.map((message) =>
              message.temp_id === optimisticMessage.temp_id
                ? { ...message, status: 'failed' }
                : message,
            ),
          )
          return nextMessages
        })
      }

      return optimisticMessage
    },
    [appendMessage, currentUserId, send],
  )

  const retryMessage = useCallback(
    (conversationKey, message) => {
      if (!conversationKey || !message) {
        return null
      }

      setMessages((currentMessages) => {
        const nextMessages = new Map(currentMessages)
        const currentList = nextMessages.get(conversationKey) || []
        nextMessages.set(
          conversationKey,
          currentList.filter(
            (currentMessage) => getMessageId(currentMessage) !== getMessageId(message),
          ),
        )
        return nextMessages
      })

      return sendMessage(conversationKey, message.content || message.message || '')
    },
    [sendMessage],
  )

  const markAsRead = useCallback(
    (conversationKey) => {
      if (!conversationKey) {
        return
      }

      setUnreadCounts((currentCounts) => {
        const nextCounts = new Map(currentCounts)
        nextCounts.set(conversationKey, 0)
        return nextCounts
      })

      const currentMessages = messages.get(conversationKey) || []
      const messageId =
        getLatestIncomingMessageId(currentMessages, currentUserId) ||
        getLatestMessageId(currentMessages)

      if (messageId) {
        send({
          conversation: conversationKey,
          message_id: messageId,
          type: 'mark_read',
        })
      }
    },
    [currentUserId, messages, send],
  )

  const setTyping = useCallback(
    (conversationKey, isTyping) => {
      if (!conversationKey) {
        return false
      }

      return send({
        conversation: conversationKey,
        type: isTyping ? 'typing_start' : 'typing_stop',
      })
    },
    [send],
  )

  const loadMoreMessages = useCallback(
    async (conversationKey) => {
      if (!chatAvailable || !conversationKey) {
        return []
      }

      const kind = getConversationKind(conversationKey)
      const id = getConversationId(conversationKey)
      const nextPage = (messagePages.current.get(conversationKey) || 0) + 1

      try {
        const response =
          kind === 'group'
            ? await getGroupMessages(id, nextPage)
            : await getDMHistory(id, nextPage)
        const nextMessages = normalizeMessageList(response)

        messagePages.current.set(conversationKey, nextPage)
        setHasMoreMessages((currentHasMore) => {
          const nextHasMore = new Map(currentHasMore)
          nextHasMore.set(conversationKey, Boolean(response?.next))
          return nextHasMore
        })
        setMessages((currentMessages) => {
          const nextMessagesMap = new Map(currentMessages)
          const existingList = nextMessagesMap.get(conversationKey) || []
          const existingIds = new Set(
            existingList.map((m) => getMessageId(m)).filter(Boolean),
          )
          const dedupedNew = nextMessages.filter(
            (m) => !existingIds.has(getMessageId(m)),
          )
          nextMessagesMap.set(conversationKey, [
            ...dedupedNew,
            ...existingList,
          ])
          return nextMessagesMap
        })

        return nextMessages
      } catch {
        setHasMoreMessages((currentHasMore) => {
          const nextHasMore = new Map(currentHasMore)
          nextHasMore.set(conversationKey, false)
          return nextHasMore
        })
        return []
      }
    },
    [chatAvailable],
  )

  const createGroup = useCallback(
    async (name, memberIds = []) => {
      if (!chatAvailable) {
        return null
      }

      try {
        const group = await createGroupRequest({ member_ids: memberIds, name })
        setGroups((currentGroups) => [group, ...currentGroups])
        return group
      } catch {
        return null
      }
    },
    [chatAvailable],
  )

  useEffect(() => {
    if (chatAvailable) {
      return
    }

    disconnect()
    const timer = window.setTimeout(() => {
      setIsOpen(false)
      setIsBootstrapping(false)
      setActiveConversation({ data: null, id: null, type: null })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [chatAvailable, disconnect])

  useEffect(() => {
    if (!chatAvailable) {
      return undefined
    }

    let cancelled = false
    const bootstrapTimer = window.setTimeout(() => {
      if (!cancelled) {
        setIsBootstrapping(true)
      }
    }, 0)

    Promise.allSettled([getChatUsers(), getConversations(), getMyGroups()]).then(
      ([usersResult, conversationsResult, groupsResult]) => {
        if (cancelled) {
          return
        }

        const rawUsers = usersResult.status === 'fulfilled' ? normalizeArray(usersResult.value) : []
        const rawConversations = conversationsResult.status === 'fulfilled'
          ? normalizeArray(conversationsResult.value)
          : []

        const usersByRecentConversation = (() => {
          const recentUserIds = rawConversations.map(
            (c) => c.user_id || c.other_user_id || c.user?.id || c.user?.user_id,
          )

          const userMap = new Map(rawUsers.map((u) => [u.id || u.user_id, u]))
          const seen = new Set()

          const sortedByRecent = recentUserIds
            .map((id) => userMap.get(id))
            .filter(Boolean)
            .filter((u) => {
              const uid = u.id || u.user_id
              if (seen.has(uid)) return false
              seen.add(uid)
              return true
            })

          rawUsers.forEach((u) => {
            if (!seen.has(u.id || u.user_id)) {
              sortedByRecent.push(u)
            }
          })

          return sortedByRecent
        })()

        setChatUsers(usersByRecentConversation)
        setConversations(toConversationMap(rawConversations))

        const rawGroups = groupsResult.status === 'fulfilled' ? normalizeArray(groupsResult.value) : []
        setGroups(rawGroups)

        const initialUnread = new Map()
        rawConversations.forEach((c) => {
          const uid = c.user_id || c.other_user_id || c.user?.id || c.user?.user_id
          const count = c.unread_count || c.unreadCount || 0
          if (uid && count > 0) {
            initialUnread.set(`dm_${uid}`, count)
          }
        })
        rawGroups.forEach((g) => {
          const count = g.unread_count || g.unreadCount || 0
          if (g.id && count > 0) {
            initialUnread.set(`group_${g.id}`, count)
          }
        })
        setUnreadCounts(initialUnread)

        setIsBootstrapping(false)
      },
    )

    return () => {
      cancelled = true
      window.clearTimeout(bootstrapTimer)
    }
  }, [chatAvailable])

  useEffect(
    () => () => {
      typingTimers.current.forEach((timer) => window.clearTimeout(timer))
      typingTimers.current.clear()
    },
    [],
  )

  const contextUser = useMemo(
    () => ({
      ...user,
      role: currentRole,
      role_slug: currentRole,
      user_id: currentUserId,
    }),
    [currentRole, currentUserId, user],
  )

  const value = useMemo(
    () => ({
      activeConversation,
      activeTab,
      backToList,
      chatAvailable,
      chatUsers,
      closeChat,
      conversations,
      createGroup,
      currentRole,
      currentUser: contextUser,
      currentUserId,
      groups,
      hasMoreMessages,
      isBootstrapping,
      isOpen,
      loadMoreMessages,
      markAsRead,
      messages,
      onlineUsers,
      openChat,
      openConversation,
      retryMessage,
      setTyping,
      sendMessage,
      totalUnread,
      typingUsers,
      unreadCounts,
      user: contextUser,
      wsStatus,
    }),
    [
      activeConversation,
      activeTab,
      backToList,
      chatAvailable,
      chatUsers,
      closeChat,
      contextUser,
      conversations,
      createGroup,
      currentRole,
      currentUserId,
      groups,
      hasMoreMessages,
      isBootstrapping,
      isOpen,
      loadMoreMessages,
      markAsRead,
      messages,
      onlineUsers,
      openChat,
      openConversation,
      retryMessage,
      setTyping,
      sendMessage,
      totalUnread,
      typingUsers,
      unreadCounts,
      wsStatus,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }

  return context
}

export default ChatProvider
