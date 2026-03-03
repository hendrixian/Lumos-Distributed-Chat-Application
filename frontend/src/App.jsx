import React, { useEffect, useRef, useState } from 'react';
import AddContact from './components/AddContact.jsx';
import Sidebar from './components/sidebar';
import ChatWindow from './pages/chatroom.jsx';
import LoginForm from './pages/login.jsx';
import { API_URL, WS_URL } from './config/endpoints.js';

const TZ_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2})$/;
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_TOKEN_STORAGE_KEY = 'lumos_auth_token';
const AUTH_USER_STORAGE_KEY = 'lumos_auth_user';

const normalizeTimestamp = (rawTimestamp) => {
  if (!rawTimestamp) return null;
  const asString = String(rawTimestamp);
  const normalized = TZ_SUFFIX_RE.test(asString) ? asString : `${asString}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const deriveMessageStatus = (message) => {
  const readBy = Array.isArray(message?.read_by) ? message.read_by : [];
  const hasBeenReadByRecipient = readBy.some((name) => name && name !== message?.username);
  if (hasBeenReadByRecipient) return 'read';
  return message?.delivery_status || 'delivered';
};

const buildClientMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readErrorMessage = async (response, fallbackMessage) => {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const firstMessage = data.detail[0]?.msg;
      if (typeof firstMessage === 'string' && firstMessage.trim()) return firstMessage;
    }
  } catch (_err) {
    // Keep fallback message.
  }
  return fallbackMessage;
};

export default function App() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || null;
    } catch (_err) {
      return null;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_err) {
      return null;
    }
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authLoadingText, setAuthLoadingText] = useState('');

  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  const [messages, setMessages] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [newMessage, setNewMessage] = useState('');

  const [showRequestsPage, setShowRequestsPage] = useState(false);
  const [contactEventVersion, setContactEventVersion] = useState(0);
  const [notificationBadgeCount, setNotificationBadgeCount] = useState(0);

  const ws = useRef(null);
  const notificationWs = useRef(null);
  const currentRoomRef = useRef(null);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    try {
      if (token) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch (_err) {
      // Ignore storage errors.
    }
  }, [token]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch (_err) {
      // Ignore storage errors.
    }
  }, [user]);

  useEffect(() => {
    if (!token || user) return;

    let cancelled = false;
    const restoreUser = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) {
            setToken(null);
            setUser(null);
          }
          return;
        }

        const userData = await res.json();
        if (!cancelled) setUser(userData);
      } catch (_err) {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      }
    };

    restoreUser();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const closeChatSocket = (reason = 'silent_disconnect') => {
    if (!ws.current) return;

    ws.current.onmessage = null;
    ws.current.onerror = null;

    if (
      ws.current.readyState === WebSocket.OPEN ||
      ws.current.readyState === WebSocket.CONNECTING
    ) {
      ws.current.close(1000, reason);
    }

    ws.current = null;
  };

  useEffect(() => {
    return () => {
      closeChatSocket('app_unmount');
      if (notificationWs.current) notificationWs.current.close();
    };
  }, []);

  const refreshNotificationBadge = async (overrideToken) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;

    try {
      const headers = { Authorization: `Bearer ${activeToken}` };
      const [notificationsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/contacts/notifications`, { headers }),
        fetch(`${API_URL}/contacts/requests`, { headers }),
      ]);
      if (!notificationsRes.ok || !requestsRes.ok) return;

      const [notifications, requests] = await Promise.all([
        notificationsRes.json(),
        requestsRes.json(),
      ]);
      const unreadCount = notifications.filter((n) => !n.read).length;
      setNotificationBadgeCount(unreadCount + requests.length);
    } catch (err) {
      console.error('Failed to refresh notification badge', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    refreshNotificationBadge();
  }, [contactEventVersion]);

  useEffect(() => {
    if (!token) return;

    notificationWs.current = new WebSocket(`${WS_URL}/ws/notifications?token=${token}`);
    notificationWs.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setContactEventVersion((prev) => prev + 1);
      if (data.type === 'contact_accepted' || data.type === 'room_join_accepted') {
        fetchRooms();
      }
    };
    notificationWs.current.onerror = console.error;

    return () => {
      if (notificationWs.current) {
        notificationWs.current.close();
        notificationWs.current = null;
      }
    };
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isAuthLoading) return;

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const rawPassword = password;
    const rawConfirmPassword = confirmPassword;
    const hasPassword = rawPassword.trim().length > 0;
    const hasConfirmPassword = rawConfirmPassword.trim().length > 0;

    if (isLogin) {
      if (!trimmedUsername || !hasPassword) {
        setError('Username and password are required');
        return;
      }
    } else {
      if (!trimmedUsername || !trimmedEmail || !hasPassword || !hasConfirmPassword) {
        setError('Username, email, password, and confirm password are required');
        return;
      }
      if (!EMAIL_FORMAT_RE.test(trimmedEmail)) {
        setError('Please enter a valid email address');
        return;
      }
      if (rawPassword !== rawConfirmPassword) {
        setError('Password and confirm password must be the same');
        return;
      }
    }

    setError('');
    setIsAuthLoading(true);

    try {
      if (!isLogin) {
        setAuthLoadingText('Creating account...');
        const registerRes = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: trimmedUsername,
            email: trimmedEmail,
            password: rawPassword,
            confirm_password: rawConfirmPassword,
          }),
        });
        if (!registerRes.ok) {
          throw new Error(await readErrorMessage(registerRes, 'Registration failed'));
        }
      }

      setAuthLoadingText('Signing you in...');
      const formData = new FormData();
      formData.append('username', trimmedUsername);
      formData.append('password', rawPassword);

      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });
      if (!loginRes.ok) {
        throw new Error(await readErrorMessage(loginRes, 'Login failed'));
      }

      const data = await loginRes.json();
      setToken(data.access_token);
      setUser({ username: trimmedUsername, email: '', bio: '', avatar_url: '' });

      setPassword('');
      setEmail('');
      setConfirmPassword('');

      // Run post-login hydration in background so UI does not freeze.
      setAuthLoadingText('Loading your chats...');
      void fetchRooms(data.access_token);
      void refreshNotificationBadge(data.access_token);
      void (async () => {
        try {
          const userRes = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${data.access_token}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
          }
        } catch (userErr) {
          console.error('auth/me failed:', userErr);
        }
      })();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAuthLoading(false);
      setAuthLoadingText('');
    }
  };

  const fetchRooms = async (overrideToken) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;

    try {
      const res = await fetch(`${API_URL}/rooms/`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to fetch rooms (${res.status})`);
      const roomList = Array.isArray(data) ? data : [];
      setRooms(roomList);
      setCurrentRoom((prev) => {
        if (!prev?.id) return prev;
        return roomList.find((room) => room.id === prev.id) || prev;
      });
      return roomList;
    } catch (err) {
      console.error('fetchRooms failed:', err);
      return [];
    }
  };

  useEffect(() => {
    if (!token) {
      setRooms([]);
      setCurrentRoom(null);
      setMessages([]);
      setMessagesByRoom({});
      return;
    }

    void fetchRooms(token);
  }, [token]);

  const updateUserProfile = async (payload = {}) => {
    const hasBio = Object.prototype.hasOwnProperty.call(payload, 'bio');
    const { bio, avatarFile, removeAvatar = false } = payload;

    try {
      const formData = new FormData();
      if (hasBio) formData.append('bio', bio ?? '');
      if (avatarFile) formData.append('avatar', avatarFile);
      if (removeAvatar) formData.append('remove_avatar', 'true');

      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to update profile (${res.status})`);

      setUser(data);
      return true;
    } catch (err) {
      console.error('updateUserProfile failed:', err);
      window.alert(err.message || 'Failed to update profile');
      return false;
    }
  };

  const updateGroupProfile = async (roomId, payload = {}) => {
    if (!roomId) return false;

    const hasDescription = Object.prototype.hasOwnProperty.call(payload, 'description');
    const hasVisibility = Object.prototype.hasOwnProperty.call(payload, 'visibility');
    const { description, visibility, avatarFile, removeAvatar = false } = payload;

    try {
      const formData = new FormData();
      if (hasDescription) formData.append('description', description ?? '');
      if (hasVisibility) formData.append('visibility', visibility ?? 'public');
      if (avatarFile) formData.append('avatar', avatarFile);
      if (removeAvatar) formData.append('remove_avatar', 'true');

      const res = await fetch(`${API_URL}/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to update group (${res.status})`);

      setRooms((prev) => prev.map((room) => (room.id === roomId ? data : room)));
      setCurrentRoom((prev) => (prev?.id === roomId ? data : prev));
      return true;
    } catch (err) {
      console.error('updateGroupProfile failed:', err);
      window.alert(err.message || 'Failed to update group');
      return false;
    }
  };

  const createRoom = async (roomData = {}) => {
    const roomName = (roomData?.name ?? '').trim();
    const roomDescription = (roomData?.description ?? '').trim();
    const roomVisibility = roomData?.visibility === 'private' ? 'private' : 'public';
    if (!roomName) return false;

    try {
      const res = await fetch(`${API_URL}/rooms/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          description: roomDescription,
          visibility: roomVisibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to create room (${res.status})`);

      setShowCreateRoom(false);
      await fetchRooms();
      return true;
    } catch (err) {
      console.error('createRoom failed:', err);
      return false;
    }
  };

  const joinPublicRoom = async (room) => {
    if (!room?.id) return { ok: false, error: 'Invalid room' };

    try {
      const res = await fetch(`${API_URL}/rooms/${room.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to join room (${res.status})`);

      const roomList = await fetchRooms();
      const joinedRoom = data?.room || roomList.find((item) => item.id === room.id) || room;
      joinRoom(joinedRoom);
      return { ok: true, message: data?.message || 'Joined room successfully' };
    } catch (err) {
      console.error('joinPublicRoom failed:', err);
      return { ok: false, error: err.message || 'Failed to join room' };
    }
  };

  const requestJoinPrivateRoom = async (room) => {
    if (!room?.id) return { ok: false, error: 'Invalid room' };

    try {
      const res = await fetch(`${API_URL}/rooms/${room.id}/join-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to request join (${res.status})`);

      return { ok: true, message: data?.message || 'Join request sent' };
    } catch (err) {
      console.error('requestJoinPrivateRoom failed:', err);
      return { ok: false, error: err.message || 'Failed to request room access' };
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      const res = await fetch(`${API_URL}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || 'Failed to delete room');
      }
      if (currentRoom?.id === roomId) leaveRoom();
      await fetchRooms();
    } catch (err) {
      console.error('deleteRoom failed:', err);
      window.alert(err.message || 'Failed to delete room');
    }
  };

  const addMemberToRoom = async (room) => {
    if (!room?.id || room.created_by !== user?.username) return false;
    const input = window.prompt('Enter username to add to this room:');
    const usernameToAdd = input?.trim();
    if (!usernameToAdd) return false;

    try {
      const res = await fetch(`${API_URL}/rooms/${room.id}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: usernameToAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to add member (${res.status})`);
      await fetchRooms();
      return true;
    } catch (err) {
      console.error('addMemberToRoom failed:', err);
      window.alert(err.message || 'Failed to add member');
      return false;
    }
  };

  const mergeIncomingMessage = (existingMessages = [], incomingMessage, activeUsername) => {
    const messagesList = Array.isArray(existingMessages) ? existingMessages : [];
    if (incomingMessage?.type !== 'message') {
      return [...messagesList, incomingMessage];
    }

    const isOwnMessage = incomingMessage.username === activeUsername;
    if (isOwnMessage && incomingMessage.client_message_id) {
      let replaced = false;
      const merged = messagesList.map((msg) => {
        const isSamePendingMessage =
          msg?.client_message_id === incomingMessage.client_message_id ||
          msg?._id === incomingMessage.client_message_id;
        if (!replaced && isSamePendingMessage) {
          replaced = true;
          return {
            ...msg,
            ...incomingMessage,
            status: deriveMessageStatus(incomingMessage),
          };
        }
        return msg;
      });
      if (!replaced) merged.push(incomingMessage);
      return merged;
    }

    if (incomingMessage?._id && messagesList.some((msg) => msg?._id === incomingMessage._id)) {
      return messagesList;
    }

    return [...messagesList, incomingMessage];
  };

  const applyReadReceipt = (roomId, messageIds = [], readerUsername) => {
    if (!roomId || !readerUsername || !Array.isArray(messageIds) || messageIds.length === 0) {
      return;
    }
    const targetIds = new Set(messageIds);

    const patchMessages = (source = []) =>
      source.map((msg) => {
        if (!targetIds.has(msg?._id) || msg?.username === readerUsername) {
          return msg;
        }
        const readBy = Array.isArray(msg?.read_by) ? msg.read_by : [];
        if (readBy.includes(readerUsername)) {
          return { ...msg, status: deriveMessageStatus({ ...msg, read_by: readBy }) };
        }
        const updatedReadBy = [...readBy, readerUsername];
        return {
          ...msg,
          read_by: updatedReadBy,
          status: deriveMessageStatus({ ...msg, read_by: updatedReadBy }),
        };
      });

    setMessagesByRoom((prev) => {
      const roomMessages = prev[roomId] || [];
      return { ...prev, [roomId]: patchMessages(roomMessages) };
    });

    if (currentRoomRef.current?.id === roomId) {
      setMessages((prev) => patchMessages(prev));
    }
  };

  const markMessageAsUnsent = (roomId, clientMessageId) => {
    const patchPendingMessage = (source = []) =>
      source.map((msg) =>
        msg?.client_message_id === clientMessageId || msg?._id === clientMessageId
          ? { ...msg, status: 'unsent', delivery_status: 'unsent' }
          : msg
      );

    setMessagesByRoom((prev) => {
      const roomMessages = prev[roomId] || [];
      return { ...prev, [roomId]: patchPendingMessage(roomMessages) };
    });

    if (currentRoomRef.current?.id === roomId) {
      setMessages((prev) => patchPendingMessage(prev));
    }
  };

  const markMessagesRead = (messageIds = []) => {
    const uniqueIds = [...new Set(messageIds.filter(Boolean))];
    if (uniqueIds.length === 0) return false;
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return false;

    try {
      ws.current.send(
        JSON.stringify({
          type: 'read_receipt',
          message_ids: uniqueIds,
        })
      );
      return true;
    } catch (err) {
      console.error('Failed to send read receipt', err);
      return false;
    }
  };

  const joinRoom = (room) => {
    if (!room?.id || !user?.username) return;
    setShowRequestsPage(false);

    const isSameRoom = currentRoom?.id === room.id;
    const canReuseSocket =
      isSameRoom &&
      ws.current &&
      (ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING);

    if (canReuseSocket) {
      setCurrentRoom(room);
      setMessages(messagesByRoom[room.id] || messages);
      return;
    }

    closeChatSocket(isSameRoom ? 'reconnect_room' : 'switch_room');
    setCurrentRoom(room);
    setMessages(messagesByRoom[room.id] || []);

    const socket = new WebSocket(`${WS_URL}/ws/${room.id}/${user.username}`);
    socket.onmessage = (event) => {
      const incomingRaw = JSON.parse(event.data);

      if (incomingRaw?.type === 'message_read') {
        applyReadReceipt(room.id, incomingRaw.message_ids || [], incomingRaw.read_by);
        return;
      }

      const incomingMessage = {
        ...incomingRaw,
        timestamp: normalizeTimestamp(incomingRaw.timestamp) || new Date().toISOString(),
        read_by: Array.isArray(incomingRaw.read_by) ? incomingRaw.read_by : [],
        delivery_status: incomingRaw.delivery_status || 'delivered',
        status: deriveMessageStatus(incomingRaw),
        client_message_id: incomingRaw.client_message_id || null,
      };

      setMessagesByRoom((prev) => {
        const roomMessages = prev[room.id] || [];
        const merged = mergeIncomingMessage(roomMessages, incomingMessage, user.username);
        return { ...prev, [room.id]: merged };
      });

      if (currentRoomRef.current?.id === room.id) {
        setMessages((prev) => mergeIncomingMessage(prev, incomingMessage, user.username));
      }
    };
    socket.onerror = console.error;
    ws.current = socket;
  };

  const leaveRoom = () => {
    closeChatSocket('explicit_leave');
    setCurrentRoom(null);
    setMessages([]);
  };

  const sendMessage = (payload) => {
    if (!currentRoom?.id || !user?.username) return;
    const content = typeof payload === 'string' ? payload : payload?.content;
    const replyTo = typeof payload === 'object' ? payload?.reply_to || null : null;
    if (!content?.trim()) return;

    const roomId = currentRoom.id;
    const trimmedContent = content.trim();
    const clientMessageId = buildClientMessageId();
    const optimisticMessage = {
      _id: clientMessageId,
      client_message_id: clientMessageId,
      room_id: roomId,
      username: user.username,
      content: trimmedContent,
      type: 'message',
      timestamp: new Date().toISOString(),
      reply_to: replyTo,
      read_by: [],
      delivery_status: 'sent',
      status: 'sent',
    };

    setMessagesByRoom((prev) => {
      const roomMessages = prev[roomId] || [];
      return { ...prev, [roomId]: [...roomMessages, optimisticMessage] };
    });
    if (currentRoomRef.current?.id === roomId) {
      setMessages((prev) => [...prev, optimisticMessage]);
    }

    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      markMessageAsUnsent(roomId, clientMessageId);
      return;
    }

    try {
      ws.current.send(
        JSON.stringify({
          type: 'message',
          content: trimmedContent,
          reply_to: replyTo,
          client_message_id: clientMessageId,
        })
      );
    } catch (err) {
      console.error('sendMessage failed:', err);
      markMessageAsUnsent(roomId, clientMessageId);
    }
  };

  const logout = () => {
    closeChatSocket('logout');
    if (notificationWs.current) {
      notificationWs.current.close();
      notificationWs.current = null;
    }

    setUser(null);
    setToken(null);
    setRooms([]);
    setMessages([]);
    setMessagesByRoom({});
    setCurrentRoom(null);
    setUsername('');
    setEmail('');
    setConfirmPassword('');
    setShowRequestsPage(false);
    setNotificationBadgeCount(0);

    try {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch (_err) {
      // Ignore storage errors.
    }
  };

  if (!user) {
    return (
      <LoginForm
        username={username}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        isLogin={isLogin}
        error={error}
        setUsername={setUsername}
        setEmail={setEmail}
        setPassword={setPassword}
        setConfirmPassword={setConfirmPassword}
        setIsLogin={setIsLogin}
        onSubmit={handleAuth}
        isLoading={isAuthLoading}
        loadingText={authLoadingText}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        token={token}
        rooms={rooms}
        messagesByRoom={messagesByRoom}
        currentRoom={currentRoom}
        showCreateRoom={showCreateRoom}
        setShowCreateRoom={setShowCreateRoom}
        onCreateRoom={createRoom}
        onDeleteRoom={deleteRoom}
        onJoinRoom={joinRoom}
        onJoinPublicRoom={joinPublicRoom}
        onRequestJoinPrivateRoom={requestJoinPrivateRoom}
        onLogout={logout}
        onUpdateUserProfile={updateUserProfile}
        onOpenRequestsPage={() => setShowRequestsPage(true)}
        notificationBadgeCount={notificationBadgeCount}
        onRefreshBadge={refreshNotificationBadge}
      />

      <div className="flex-1 flex flex-col">
        {showRequestsPage ? (
          <AddContact
            token={token}
            onRoomRefresh={fetchRooms}
            refreshSignal={contactEventVersion}
            onNotificationChange={setNotificationBadgeCount}
            onBack={() => setShowRequestsPage(false)}
          />
        ) : (
          <ChatWindow
            user={user}
            token={token}
            room={currentRoom}
            messages={messages}
            setMessages={setMessages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onSend={sendMessage}
            onMarkRead={markMessagesRead}
            onAuthExpired={logout}
            onLeave={leaveRoom}
            onAddMember={addMemberToRoom}
            onUpdateGroupProfile={updateGroupProfile}
          />
        )}
      </div>
    </div>
  );
}
