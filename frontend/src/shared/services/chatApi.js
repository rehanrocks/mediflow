import { api } from './api'

function unwrap(response) {
  return response?.data ?? response
}

export const getChatUsers = () => api.get('/chat/users/').then(unwrap)
export const getConversations = () => api.get('/chat/conversations/').then(unwrap)
export const getMyGroups = () => api.get('/chat/groups/').then(unwrap)

export const getDMHistory = (userId, page = 1) =>
  api
    .get(`/chat/dm/${userId}/messages/`, {
      params: { page, page_size: 30 },
    })
    .then(unwrap)

export const getGroupMessages = (groupId, page = 1) =>
  api
    .get(`/chat/groups/${groupId}/messages/`, {
      params: { page, page_size: 30 },
    })
    .then(unwrap)

export const getGroupDetail = (groupId) => api.get(`/chat/groups/${groupId}/`).then(unwrap)

export const createGroup = (data) => api.post('/chat/groups/', data).then(unwrap)

export const addGroupMember = (groupId, userId) =>
  api.post(`/chat/groups/${groupId}/members/`, { user_id: userId }).then(unwrap)

export const removeGroupMember = (groupId, userId) =>
  api.delete(`/chat/groups/${groupId}/members/${userId}/`).then(unwrap)

export const searchMessages = (conversation, query) =>
  api
    .get('/chat/search/', {
      params: { conversation, q: query },
    })
    .then(unwrap)

export const sendAIMessage = (message, history) =>
  api.post('/chat/ai/', { history, message }).then(unwrap)
