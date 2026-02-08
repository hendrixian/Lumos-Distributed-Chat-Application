import React, { useState, useEffect, useRef } from 'react';
import LoginForm from './pages/login.jsx';
import Sidebar from './components/sidebar';
import ChatWindow from './pages/chatroom.jsx';
import AddContact from './components/AddContact.jsx';//added by thu for add contact

const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002';
//const ws = useRef(null);              // WebSocket for chat messages added by thu


export default function App() {
  // ---------- AUTH ----------
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');  
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  // ---------- ROOMS ----------
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // ---------- CHAT ----------
  const [messages, setMessages] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const ws = useRef(null);
  const notificationWs = useRef(null); // notification socket (added by thu for contact request notification)
  // ---------- PROFILE ----------
  const [showProfile, setShowProfile] = useState(false);

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
  //added by thu for getting notifications when sender send contact request
   useEffect(() => {
  if (!token) return;
  try{
  // Connect to notification WebSocket added by thu
  notificationWs.current = new WebSocket(
    `ws://localhost:8002/ws/notifications?token=${token}`
  );

  notificationWs.current.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "contact_request") {
      alert(`${data.from_username} sent you a contact request`);
    }

    if (data.type === "contact_accepted") {
      alert(`Your contact request was accepted by ${data.to_username}`);
      
      // Optional: auto-create or refresh rooms
      fetchRooms();
    }

    if (data.type === "contact_rejected") {
      alert(`Your contact request was rejected by ${data.to_username}`);
    }
  };

  notificationWs.current.onerror = (err) => {
    console.error("Notification WS error", err);
  };

  return () => {
    if (notificationWs.current) {
      notificationWs.current.close();
    }
  };
}catch(err){
  console.error("Failed to connect to notification WebSocket", err);}
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
          body: JSON.stringify({ 
            username, 
            email,  
            password 
          }),
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

      const userRes = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${data.access_token}` }
    });
    
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser({ 
          username: userData.username, 
          email: userData.email  // ✅ Now includes email!
        });
      } else {
        // Fallback if /auth/me fails
        setUser({ username });
      }

      setPassword('');
      setEmail('');  
      setConfirmPassword('');  
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

    const roomMessages = messagesByRoom[room.id] || [];
    setMessages(roomMessages);

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
    if (ws.current) ws.current.close(1000, 'User left room');  // Code 1000 = normal closure
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
    // Close WebSocket silently without triggering leave message
    if (ws.current) {
      ws.current.onmessage = null;
      ws.current.onerror = null;
      ws.current.close();
    }
    // 🔥 Close notification WebSocket added by thu
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
  };

  // ================= RENDER =================
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
  if (showProfile) {
      return (
        <UserProfile
          user={user}
          token={token} 
          onClose={() => setShowProfile(false)}
          onLogout={logout}
        />
      );
    }
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        rooms={rooms}
        onShowProfile={() => setShowProfile(true)}
        messagesByRoom={messagesByRoom}
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
    <div className="flex-1 flex flex-col">
      <AddContact token={token} />{/*added by thu for add contact button*/}
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
    </div>
  );}
  
