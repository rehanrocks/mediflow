export const convKey = {
  ai: () => 'ai',
  dm: (userId) => `dm_${userId}`,
  group: (groupId) => `group_${groupId}`,
}

export function getConversationKind(key = '') {
  return String(key).startsWith('group_') ? 'group' : 'dm'
}

export function getConversationId(key = '') {
  return String(key).replace(/^(dm|group)_/, '')
}

export function formatMessageTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatConvTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return formatMessageTime(value)
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })
}

export function normalizeMessageList(response) {
  if (Array.isArray(response?.results)) {
    return response.results
  }

  if (Array.isArray(response)) {
    return response
  }

  return []
}

export function groupMessages(messages = []) {
  return messages.map((message, index) => {
    const previous = messages[index - 1]
    const previousTime = previous?.created_at ? new Date(previous.created_at) : null
    const currentTime = message?.created_at ? new Date(message.created_at) : null
    const isGrouped =
      Boolean(previous) &&
      previous.sender_id === message.sender_id &&
      previousTime &&
      currentTime &&
      currentTime - previousTime < 60000

    return { ...message, isGrouped }
  })
}
