import { Check, CheckCheck } from 'lucide-react';

export default function MessageBubble({ msg, isOwn, isGroup }) {
  const isSystem =
    msg.type === 'user_joined' || msg.type === 'user_left';

  if (isSystem) {
    return (
      <div className="text-center text-xs text-gray-400">
        {msg.content}
      </div>
    );
  }

  const isSeen = msg.seen === true;

  return (
    <div
      className={`flex ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`
          inline-block
          max-w-[70%]
          px-4 py-2
          rounded-2xl
          shadow-sm
          break-words
          whitespace-pre-wrap
          relative
          ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-200 text-gray-900 rounded-bl-sm'
          }
        `}
      >
        {/* Author name (GROUP ONLY, NOT OWN MESSAGE) */}
        {isGroup && !isOwn && (
          <p className="text-xs font-semibold mb-1 text-blue-600">
            {msg.username}
          </p>
        )}

        {/* Message content */}
        <p>{msg.content}</p>

        {/* Time + seen */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75">
          <span>
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {isOwn && (
            isSeen ? (
              <CheckCheck size={14} />
            ) : (
              <Check size={14} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
