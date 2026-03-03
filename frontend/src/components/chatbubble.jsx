import { AlertCircle, Check, CheckCheck, CornerUpLeft } from 'lucide-react';

export default function MessageBubble({
  msg,
  isOwn,
  onReply,
  replyTo,
  onJumpToMessage,
  isHighlighted,
}) {
  const isSystem = msg.type === 'user_joined' || msg.type === 'user_left';

  if (isSystem) {
    return (
      <div className="text-center text-xs text-gray-400">
        {msg.content}
      </div>
    );
  }

  const readBy = Array.isArray(msg.read_by) ? msg.read_by : [];
  const seenByRecipient = readBy.some(
    (username) => username && username !== msg.username
  );
  const status = msg.status || (seenByRecipient ? 'read' : (msg.delivery_status || 'delivered'));
  const messageId = msg._id || msg.id;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        data-message-id={messageId}
        className={`
          inline-block
          max-w-[70%]
          px-4 py-2
          rounded-2xl
          shadow-sm
          break-words
          whitespace-pre-wrap
          relative
          transition-colors duration-700
          ${isHighlighted ? 'ring-2 ring-yellow-300 bg-yellow-100 text-gray-900' : ''}
          ${isOwn
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-200 text-gray-900 rounded-bl-sm'}
        `}
      >
        {/* --- Replied message preview (Telegram style) --- */}
        {replyTo && (
          <div
            onClick={() =>
              replyTo?._id && onJumpToMessage?.(replyTo._id)
            }
            className={`
              mb-2 px-3 py-2 rounded border-l-4
              cursor-pointer
              ${
                isOwn
                  ? 'bg-white/20 border-white text-white'
                  : 'bg-gray-100 border-gray-400 text-gray-700'
              }
            `}
          >
            <p className="text-xs font-semibold truncate">
              {replyTo.username || 'Unknown'}
            </p>
            <p className="text-xs truncate">
              {replyTo.content || ''}
            </p>
          </div>
        )}

        {/* --- Top bar: Username + Reply --- */}
        <div className="flex justify-between items-center mb-1">
          <p
            className={`text-xs font-semibold ${
              isOwn ? 'text-white' : 'text-blue-600'
            }`}
          >
            {msg.username || 'Unknown'}
          </p>

          <button
            onClick={() => onReply?.(msg)}
            className={`text-xs p-1 rounded transition ${
              isOwn
                ? 'text-white hover:bg-blue-500'
                : 'text-gray-600 hover:bg-gray-300'
            }`}
            title="Reply"
          >
            <CornerUpLeft size={14} />
          </button>
        </div>

        {/* --- Main message content --- */}
        <p>{msg.content}</p>

        {/* --- Time + Delivery State --- */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75">
          <span>
            {msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </span>
          {isOwn && status === 'read' && (
            <CheckCheck
              size={14}
              className="text-sky-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] "  />
          )}
          {isOwn && status === 'delivered' && (
            <CheckCheck size={14} className="text-white/75" />
          )}
          {isOwn && (status === 'sent' || status === 'sending') && (
            <Check size={14} className="text-white/75" />
          )}
          {isOwn && status === 'unsent' && (
            <span className="inline-flex items-center gap-1 text-red-200">
              <AlertCircle size={12} />
              Unsent
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
