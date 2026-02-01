import { useRef, useEffect, useState } from 'react';
import { Send, Users, ArrowDown, Search, PanelRight, X } from 'lucide-react';
import MessageBubble from '../components/chatbubble.jsx';
import GroupInfo from '../components/groupprofile.jsx';

export default function ChatWindow({
  user,
  room,
  messages,
  newMessage,
  setNewMessage,
  onSend,
  onLeave,
}) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Track scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  };

  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-teal-100">
        <div className="text-center text-gray-500">
          <Users size={64} />
          <p className="mt-2">Select a room</p>
        </div>
      </div>
    );
  }

  const memberCount = room.memberCount ?? room.participants?.length ?? 0;
  const onlineCount = room.onlineCount ?? 0;

  return (
    <div className="flex-1 flex relative overflow-hidden">
      {/* Chat area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          showRightPanel ? 'max-w-[calc(100%-320px)]' : 'max-w-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          {/* Left: Group info / Search */}
          <div className="flex flex-col flex-1">
            {showSearchBar ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    setSearchText('');
                    setShowSearchBar(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-lg leading-tight truncate">{room.name}</h2>
                <span className="text-xs text-gray-500">
                  {memberCount} members{onlineCount > 0 && `, ${onlineCount} online`}
                </span>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 ml-4">
            {!showSearchBar && (
              <button
                className="p-2 rounded-full hover:bg-gray-100"
                title="Search messages"
                onClick={() => setShowSearchBar(true)}
              >
                <Search size={20} />
              </button>
            )}

            <button
              className="p-2 rounded-full hover:bg-gray-100"
              title="Group info"
              onClick={() => setShowRightPanel(true)}
            >
              <PanelRight size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 p-4 space-y-3 overflow-y-auto relative"
        >
          {messages.map((msg, i) => {
            const isGroup = room?.participants?.length > 2;
            return (
              <MessageBubble
                key={i}
                msg={msg}
                isOwn={msg.username === user.username}
                isGroup={isGroup}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-10"
            title="Scroll to bottom"
          >
            <ArrowDown size={20} />
          </button>
        )}

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <input
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Type a message..."
          />
          <button
            onClick={onSend}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <Send />
          </button>
        </div>
      </div>

      {/* Right Panel: Group Info */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl transition-transform duration-300 z-50 ${
          showRightPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <GroupInfo group={room} onClose={() => setShowRightPanel(false)} />
      </div>
    </div>
  );
}
