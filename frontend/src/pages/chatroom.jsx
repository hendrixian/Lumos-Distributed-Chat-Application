import { useRef, useEffect, useState, useMemo } from 'react';
import { Send, Users, ArrowDown, Search, PanelRight, X } from 'lucide-react';
import MessageBubble from '../components/chatbubble.jsx';
import GroupInfo from '../components/groupprofile.jsx';
import {
  blockDmUser,
  fetchDmBlockStatus,
  fetchRoomMessages,
  fetchRoomPresence,
  fetchUserOnlineStatus,
  unblockDmUser,
} from '../api/api.jsx';

export default function ChatWindow({
  user,
  token,
  room,
  messages,
  setMessages,
  newMessage,
  setNewMessage,
  onSend,
  onMarkRead,
  onAuthExpired,
  onLeave,
  onAddMember,
  onUpdateGroupProfile,
}) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const readReceiptSentRef = useRef(new Set());

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [presence, setPresence] = useState({
    online_count: 0,
    online_members: [],
  });
  const [dmBlockStatus, setDmBlockStatus] = useState({
    blocked_by_you: false,
    blocked_by_other: false,
    other_username: '',
  });
  const [dmPeerOnline, setDmPeerOnline] = useState(false);

  // Normalize messages once
  const normalizedMessages = useMemo(() => {
    return messages.map((msg) => ({
      ...msg,
      _id: msg._id || msg.id,
    }));
  }, [messages]);

  const visibleMessages = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return normalizedMessages;

    return normalizedMessages.filter((msg) => {
      const content = String(msg.content || '').toLowerCase();
      const username = String(msg.username || '').toLowerCase();
      return content.includes(query) || username.includes(query);
    });
  }, [normalizedMessages, searchText]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto scroll on new message (only if user is already at bottom)
  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages]);

  // Initial load (latest 50)
  useEffect(() => {
    if (!room?.id) return;

    const fetchInitial = async () => {
      try {
        const latest = await fetchRoomMessages(room.id, token, { limit: 50 });
        setMessages(latest);
        setHasMore(latest.length === 50);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    fetchInitial();
  }, [room?.id, token]);

  useEffect(() => {
    readReceiptSentRef.current = new Set();
  }, [room?.id]);

  useEffect(() => {
    if (!room?.id || !user?.username || !onMarkRead) return;

    const unreadMessageIds = normalizedMessages
      .filter((msg) => msg.type === 'message')
      .filter((msg) => msg.username !== user.username)
      .map((msg) => msg._id)
      .filter(Boolean)
      .filter((messageId) => !readReceiptSentRef.current.has(messageId));

    if (unreadMessageIds.length === 0) return;
    const sent = onMarkRead(unreadMessageIds);
    if (!sent) return;

    unreadMessageIds.forEach((messageId) => readReceiptSentRef.current.add(messageId));
  }, [normalizedMessages, room?.id, user?.username, onMarkRead]);

  useEffect(() => {
    if (!room?.id || !token) {
      setPresence({ online_count: 0, online_members: [] });
      return;
    }

    let isMounted = true;
    let timerId = null;

    const refreshPresence = async () => {
      try {
        const data = await fetchRoomPresence(room.id, token);
        if (isMounted) {
          setPresence({
            online_count: data?.online_count ?? 0,
            online_members: Array.isArray(data?.online_members)
              ? data.online_members
              : [],
          });
        }
      } catch (err) {
        if (err?.status === 401) {
          if (timerId) clearInterval(timerId);
          if (isMounted) {
            setPresence({ online_count: 0, online_members: [] });
            onAuthExpired?.();
          }
          return;
        }
        console.error('Failed to fetch room presence:', err);
      }
    };

    refreshPresence();
    timerId = setInterval(refreshPresence, 5000);

    return () => {
      isMounted = false;
      if (timerId) clearInterval(timerId);
    };
  }, [room?.id, token, onAuthExpired]);

  useEffect(() => {
    if (!room?.id || room?.type !== 'dm' || !token) {
      setDmBlockStatus({
        blocked_by_you: false,
        blocked_by_other: false,
        other_username: '',
      });
      return;
    }

    let isMounted = true;
    let timerId = null;

    const refreshDmBlockStatus = async () => {
      try {
        const data = await fetchDmBlockStatus(room.id, token);
        if (isMounted) {
          setDmBlockStatus({
            blocked_by_you: Boolean(data?.blocked_by_you),
            blocked_by_other: Boolean(data?.blocked_by_other),
            other_username: data?.other_username || '',
          });
        }
      } catch (err) {
        if (err?.status === 401) {
          if (timerId) clearInterval(timerId);
          if (isMounted) onAuthExpired?.();
          return;
        }
        console.error('Failed to fetch DM block status:', err);
      }
    };

    refreshDmBlockStatus();
    timerId = setInterval(refreshDmBlockStatus, 5000);

    return () => {
      isMounted = false;
      if (timerId) clearInterval(timerId);
    };
  }, [room?.id, room?.type, token, onAuthExpired]);

  useEffect(() => {
    if (!room?.id || room?.type !== 'dm' || !token) {
      setDmPeerOnline(false);
      return;
    }

    const peerUsername =
      dmBlockStatus?.other_username ||
      (Array.isArray(room.members)
        ? room.members.find((username) => username !== user?.username) || ''
        : '');
    if (!peerUsername) {
      setDmPeerOnline(false);
      return;
    }

    let isMounted = true;
    let timerId = null;

    const refreshDmPeerOnline = async () => {
      try {
        const data = await fetchUserOnlineStatus(peerUsername, token);
        if (isMounted) {
          setDmPeerOnline(Boolean(data?.online));
        }
      } catch (err) {
        if (err?.status === 401) {
          if (timerId) clearInterval(timerId);
          if (isMounted) onAuthExpired?.();
          return;
        }
        console.error('Failed to fetch DM peer online status:', err);
      }
    };

    refreshDmPeerOnline();
    timerId = setInterval(refreshDmPeerOnline, 5000);

    return () => {
      isMounted = false;
      if (timerId) clearInterval(timerId);
    };
  }, [room?.id, room?.type, room?.members, user?.username, token, dmBlockStatus?.other_username, onAuthExpired]);

  // Lazy load older messages
  const loadOlderMessages = async () => {
    if (!room?.id || loadingOlder || !hasMore || messages.length === 0)
      return;

    setLoadingOlder(true);

    const oldest = messages[0];

    const prevScrollHeight = containerRef.current.scrollHeight;

    try {
      const older = await fetchRoomMessages(room.id, token, {
        limit: 50,
        before: oldest._id,
      });

      if (older.length < 50) setHasMore(false);

      setMessages((prev) => [...older, ...prev]);

      // Preserve scroll position
      setTimeout(() => {
        const newScrollHeight = containerRef.current.scrollHeight;
        containerRef.current.scrollTop =
          newScrollHeight - prevScrollHeight;
      }, 0);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    }

    setLoadingOlder(false);
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      containerRef.current;

    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);

    // If user scrolls to top → load older
    if (scrollTop < 50) {
      loadOlderMessages();
    }
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  const handleJumpToMessage = (messageId) => {
    if (!containerRef.current || !messageId) return;
    const target = containerRef.current.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId(null), 1400);
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;
    if (room?.type === 'dm' && (dmBlockStatus?.blocked_by_other || dmBlockStatus?.blocked_by_you))
      return;

    onSend?.({
      content: newMessage,
      reply_to: replyTo?._id || null,
    });

    setReplyTo(null);
    setNewMessage('');
  };

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

  const memberCount = room.members?.length ?? 0;
  const onlineCount = presence.online_count ?? 0;
  const isDmRoom = room?.type === 'dm';
  const dmPeerUsername =
    dmBlockStatus?.other_username ||
    (Array.isArray(room.members)
      ? room.members.find((username) => username !== user?.username) || ''
      : '');
  const blockedByYouInDm = isDmRoom && dmBlockStatus?.blocked_by_you;
  const blockedByOtherInDm = isDmRoom && dmBlockStatus?.blocked_by_other;
  const dmMessagingDisabled = blockedByYouInDm || blockedByOtherInDm;

  const handleBlockDm = async () => {
    if (!room?.id || room?.type !== 'dm') return false;
    if (dmBlockStatus?.blocked_by_you) return true;
    if (!window.confirm(`Block ${dmPeerUsername || 'this user'}?`)) return false;

    try {
      await blockDmUser(room.id, token);
      const updatedStatus = await fetchDmBlockStatus(room.id, token);
      setDmBlockStatus({
        blocked_by_you: Boolean(updatedStatus?.blocked_by_you),
        blocked_by_other: Boolean(updatedStatus?.blocked_by_other),
        other_username: updatedStatus?.other_username || dmPeerUsername || '',
      });
      return true;
    } catch (err) {
      window.alert(err?.message || 'Failed to block user');
      return false;
    }
  };

  const handleUnblockDm = async () => {
    if (!room?.id || room?.type !== 'dm') return false;
    if (!dmBlockStatus?.blocked_by_you) return true;
    if (!window.confirm(`Unblock ${dmPeerUsername || 'this user'}?`)) return false;

    try {
      await unblockDmUser(room.id, token);
      const updatedStatus = await fetchDmBlockStatus(room.id, token);
      setDmBlockStatus({
        blocked_by_you: Boolean(updatedStatus?.blocked_by_you),
        blocked_by_other: Boolean(updatedStatus?.blocked_by_other),
        other_username: updatedStatus?.other_username || dmPeerUsername || '',
      });
      return true;
    } catch (err) {
      window.alert(err?.message || 'Failed to unblock user');
      return false;
    }
  };

  return (
    <div className="flex-1 flex relative overflow-hidden">
      {/* Chat Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          showRightPanel ? 'max-w-[calc(100%-320px)]' : 'max-w-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex flex-col flex-1">
            {showSearchBar ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full px-4 py-2 border rounded-full focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    setSearchText('');
                    setShowSearchBar(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-semibold text-lg truncate">
                  {room.name}
                </h2>
                <span className="text-xs text-gray-500">
                  {isDmRoom
                    ? dmPeerOnline
                      ? 'Online'
                      : 'Offline'
                    : `${memberCount} member${memberCount !== 1 ? 's' : ''}, ${onlineCount} online`}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            {!showSearchBar && (
              <button
                className="p-2 rounded-full hover:bg-gray-100"
                onClick={() => setShowSearchBar(true)}
              >
                <Search size={20} />
              </button>
            )}
            <button
              className="p-2 rounded-full hover:bg-gray-100"
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
          className="flex-1 p-4 space-y-3 overflow-y-auto"
        >
          {loadingOlder && (
            <div className="text-center text-xs text-gray-400">
              Loading older messages...
            </div>
          )}

          {visibleMessages.length === 0 && searchText.trim() && (
            <div className="text-center text-sm text-gray-400 py-6">
              No messages found for "{searchText.trim()}"
            </div>
          )}

          {visibleMessages.map((msg) => (
            <MessageBubble
              key={msg._id}
              msg={msg}
              isOwn={msg.username === user.username}
              onReply={handleReply}
              onJumpToMessage={handleJumpToMessage}
              isHighlighted={highlightedMessageId === (msg._id || msg.id)}
              replyTo={
                msg.reply_to
                  ? normalizedMessages.find(
                      (m) => m._id === msg.reply_to
                    )
                  : null
              }
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
          >
            <ArrowDown size={20} />
          </button>
        )}

        {/* Reply + Input */}
        <div className="p-4 border-t flex flex-col gap-2">
          {dmMessagingDisabled ? (
            <div className="text-center text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg py-3">
              {blockedByOtherInDm ? 'You have been blocked' : 'You blocked this user'}
            </div>
          ) : (
            <>
              {replyTo && (
                <div className="flex justify-between bg-gray-100 border-l-4 border-blue-500 px-3 py-2 rounded">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-semibold truncate">
                      {replyTo.username}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {replyTo.content}
                    </p>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-gray-500 hover:text-gray-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                />
                <button
                  onClick={handleSend}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Send />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl transition-transform duration-300 ${
          showRightPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <GroupInfo
          group={room}
          user={user}
          token={token}
          dmBlockStatus={dmBlockStatus}
          dmPeerOnline={dmPeerOnline}
          onlineUsernames={presence.online_members}
          onClose={() => setShowRightPanel(false)}
          onAddMember={onAddMember}
          onBlockDmUser={handleBlockDm}
          onUnblockDmUser={handleUnblockDm}
          onUpdateGroupProfile={onUpdateGroupProfile}
          onLeaveRoom={onLeave}
        />
      </div>
    </div>
  );
}
