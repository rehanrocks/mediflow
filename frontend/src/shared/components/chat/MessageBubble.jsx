import { AlertCircle, Bot } from 'lucide-react'

import { formatMessageTime } from '@shared/lib/chatUtils'
import ChatAvatar from './ChatAvatar'
import ReadReceipts from './ReadReceipts'

function getContent(message = {}) {
  if (message.attachment || message.file || message.image) {
    return '[attachment]'
  }

  return message.content || message.message || ''
}

export function MessageBubble({
  highlight = false,
  isAi = false,
  isSelf = false,
  message = {},
  onRetry,
  senderName,
  showAvatar = true,
  user,
}) {
  const failed = message.status === 'failed'
  const canRetry = failed && isSelf && typeof onRetry === 'function' && !isAi
  const bubbleClass = isSelf
    ? 'bg-brand text-white rounded-[18px] rounded-br-[4px]'
    : failed
      ? 'bg-rose-50 text-rose-700 rounded-[18px] rounded-bl-[4px] border border-rose-100'
      : 'bg-mist text-slate-900 rounded-[18px] rounded-bl-[4px]'

  return (
    <div className={`flex gap-2 py-0.5 ${isSelf ? 'justify-end' : 'justify-start'}`}>
      {!isSelf && showAvatar ? (
        isAi ? (
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Bot aria-hidden="true" className="h-4 w-4" />
          </span>
        ) : (
          <ChatAvatar size="sm" user={user} />
        )
      ) : (
        <span className="h-7 w-7 shrink-0" />
      )}

      <button
        className={[
          'max-w-[85%] text-left sm:max-w-[72%]',
          canRetry ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
        onClick={() => {
          if (canRetry) {
            onRetry(message)
          }
        }}
        type="button"
      >
        {senderName ? (
          <p className="mb-0.5 text-[11px] font-semibold text-brand">{senderName}</p>
        ) : null}
        <div
          className={[
            bubbleClass,
            'break-words px-4 py-2 text-[14px] leading-5',
            highlight ? 'ring-2 ring-brand/30' : '',
          ].join(' ')}
        >
          <p className="whitespace-pre-wrap">{getContent(message)}</p>
          {failed ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
              <AlertCircle aria-hidden="true" className="h-3 w-3" />
              {isAi ? 'Unavailable' : 'Failed. Tap to retry.'}
            </p>
          ) : null}
        </div>
        <div
          className={[
            'mt-1 flex items-center gap-1 text-[10px]',
            isSelf ? 'justify-end text-slate/60' : 'justify-start text-slate/50',
          ].join(' ')}
        >
          <span>{formatMessageTime(message.created_at)}</span>
          {isSelf ? <ReadReceipts status={message.status} /> : null}
        </div>
      </button>
    </div>
  )
}

export default MessageBubble
