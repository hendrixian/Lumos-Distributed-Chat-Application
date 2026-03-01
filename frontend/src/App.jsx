import React, { useEffect, useRef, useState } from 'react';
import AddContact from './components/AddContact.jsx';
import Sidebar from './components/sidebar';
import ChatWindow from './pages/chatroom.jsx';
import LoginForm from './pages/login.jsx';

const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

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
    fetchRooms();
    refreshNotificationBadge();
  }, [token]);

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
      if (data.type === 'contact_accepted') fetchRooms();
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
    setError('');

    try {
      if (!isLogin) {
        const registerRes = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password }),
        });
        if (!registerRes.ok) {
          const data = await registerRes.json();
          throw new Error(data.detail || 'Registration failed');
        }
      }

      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });
      if (!loginRes.ok) {
        const data = await loginRes.json();
        throw new Error(data.detail || 'Login failed');
      }

      const data = await loginRes.json();
      setToken(data.access_token);
      await refreshNotificationBadge(data.access_token);

      const userRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser({ username: userData.username, email: userData.email });
      } else {
        setUser({ username });
      }

      setPassword('');
      setEmail('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/rooms/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Failed to fetch rooms (${res.status})`);
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchRooms failed:', err);
    }
  };

  const createRoom = async (roomData = {}) => {
    const roomName = (roomData?.name ?? '').trim();
    const roomDescription = (roomData?.description ?? '').trim();
    if (!roomName) return false;

    try {
      const res = await fetch(`${API_URL}/rooms/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: roomName, description: roomDescription }),
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
      setMessages(messagesByRoom[room.id] || []);
      return;
    }

    closeChatSocket(isSameRoom ? 'reconnect_room' : 'switch_room');
    setCurrentRoom(room);
    setMessages(messagesByRoom[room.id] || []);

    const socket = new WebSocket(`${WS_URL}/ws/${room.id}/${user.username}`);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
      setMessagesByRoom((prev) => {
        const roomMsgs = prev[room.id] ? [...prev[room.id], msg] : [msg];
        return { ...prev, [room.id]: roomMsgs };
      });
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
    if (!ws.current) return;
    const content = typeof payload === 'string' ? payload : payload?.content;
    const replyTo = typeof payload === 'object' ? payload?.reply_to || null : null;
    if (!content?.trim()) return;
    ws.current.send(JSON.stringify({ content: content.trim(), reply_to: replyTo }));
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
        onLogout={logout}
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
            onLeave={leaveRoom}
            onAddMember={addMemberToRoom}
          />
        )}
      </div>
    </div>
  );
}
