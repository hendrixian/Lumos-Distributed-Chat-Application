import React, { useState, useEffect, useRef } from 'react';

import LoginForm from './pages/login.jsx';
import Sidebar from './components/sidebar';
import ChatWindow from './pages/chatroom.jsx';

const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002';

export default function App() {
  // ---------- AUTH ----------
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  // ---------- ROOMS ----------
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // ---------- CHAT ----------
  const [messages, setMessages] = useState([]); // current room messages
  const [messagesByRoom, setMessagesByRoom] = useState({}); // store messages for all rooms
  const [newMessage, setNewMessage] = useState('');
  const ws = useRef(null);

  // ---------- CLEANUP ----------
  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  // ---------- LOAD ROOMS ----------
  useEffect(() => {
    if (token) fetchRooms();
  }, [token]);

  // ================= AUTH =================
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (!isLogin) {
        const registerRes = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
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
      setUser({ username });
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  // ================= ROOMS =================
  const fetchRooms = async () => {
    const res = await fetch(`${API_URL}/rooms/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setRooms(await res.json());
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;

    await fetch(`${API_URL}/rooms/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newRoomName }),
    });

    setNewRoomName('');
    setShowCreateRoom(false);
    fetchRooms();
  };

  const deleteRoom = async (roomId) => {
    await fetch(`${API_URL}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (currentRoom?.id === roomId) leaveRoom();
    fetchRooms();
  };

  // ================= WEBSOCKET =================
  const joinRoom = (room) => {
    if (ws.current) ws.current.close();

    setCurrentRoom(room);

    // Load messages for this room from the store or empty
    const roomMessages = messagesByRoom[room.id] || [];
    setMessages(roomMessages);

    const socket = new WebSocket(`${WS_URL}/ws/${room.id}/${user.username}`);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Update current room messages
      setMessages((prev) => [...prev, msg]);

      // Update global messages by room
      setMessagesByRoom((prev) => {
        const roomMsgs = prev[room.id] ? [...prev[room.id], msg] : [msg];
        return { ...prev, [room.id]: roomMsgs };
      });
    };

    socket.onerror = console.error;
    ws.current = socket;
  };

  const leaveRoom = () => {
    if (ws.current) ws.current.close();
    ws.current = null;
    setCurrentRoom(null);
    setMessages([]);
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !ws.current) return;

    ws.current.send(JSON.stringify({ content: newMessage }));
    setNewMessage('');
  };

  // ================= LOGOUT =================
  const logout = () => {
    if (ws.current) ws.current.close();

    setUser(null);
    setToken(null);
    setRooms([]);
    setMessages([]);
    setMessagesByRoom({});
    setCurrentRoom(null);
    setUsername('');
  };

  // ================= RENDER =================
  if (!user) {
    return (
      <LoginForm
        username={username}
        password={password}
        isLogin={isLogin}
        error={error}
        setUsername={setUsername}
        setPassword={setPassword}
        setIsLogin={setIsLogin}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        rooms={rooms}
        messagesByRoom={messagesByRoom} // <-- pass all messages
        currentRoom={currentRoom}
        showCreateRoom={showCreateRoom}
        newRoomName={newRoomName}
        setNewRoomName={setNewRoomName}
        setShowCreateRoom={setShowCreateRoom}
        onCreateRoom={createRoom}
        onDeleteRoom={deleteRoom}
        onJoinRoom={joinRoom}
        onLogout={logout}
      />

      <ChatWindow
        user={user}
        room={currentRoom}
        messages={messages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSend={sendMessage}
        onLeave={leaveRoom}
      />
    </div>
  );
}
