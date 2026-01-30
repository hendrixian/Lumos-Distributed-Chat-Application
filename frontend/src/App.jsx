import React, { useState, useEffect, useRef } from 'react';
import { Send, LogOut, Plus, Trash2, Users } from 'lucide-react';

//const API_URL = 'http://localhost:8002'; please change this according to your port, this is not mine by thu
//const WS_URL = 'ws://localhost:8002';please change according to your port, this is not mine by thu

const API_URL = 'http://127.0.0.1:8000';//thu's port
const WS_URL  = 'ws://127.0.0.1:8000';//thu's port

export default function ChatApp() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [error, setError] = useState('');
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token]);

  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

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

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/rooms/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    
    try {
      const res = await fetch(`${API_URL}/rooms/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newRoomName }),
      });
      
      if (res.ok) {
        setNewRoomName('');
        setShowCreateRoom(false);
        fetchRooms();
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      await fetch(`${API_URL}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (currentRoom?.id === roomId) {
        leaveRoom();
      }
      fetchRooms();
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const joinRoom = (room) => {
    if (ws.current) {
      ws.current.close();
    }

    setCurrentRoom(room);
    setMessages([]);

    const websocket = new WebSocket(`${WS_URL}/ws/${room.id}/${user.username}`);
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current = websocket;
  };

  const leaveRoom = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setCurrentRoom(null);
    setMessages([]);
  };

  const sendMessage = () => {
    if (newMessage.trim() && ws.current) {
      ws.current.send(JSON.stringify({ content: newMessage }));
      setNewMessage('');
    }
  };

  const logout = () => {
    if (ws.current) {
      ws.current.close();
    }
    setUser(null);
    setToken(null);
    setCurrentRoom(null);
    setRooms([]);
    setMessages([]);
    setUsername('');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
            {isLogin ? 'Login' : 'Register'}
          </h1>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth(e)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth(e)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {isLogin ? 'Login' : 'Register'}
            </button>
          </div>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Chat Rooms</h2>
            <p className="text-sm text-gray-500">@{user.username}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          {showCreateRoom ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                placeholder="Room name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createRoom}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowCreateRoom(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateRoom(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Room
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex justify-between items-center ${
                currentRoom?.id === room.id ? 'bg-blue-50' : ''
              }`}
            >
              <div onClick={() => joinRoom(room)} className="flex-1">
                <h3 className="font-medium text-gray-800">{room.name}</h3>
                <p className="text-xs text-gray-500">by {room.created_by}</p>
              </div>
              {room.created_by === user.username && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRoom(room.id);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete room"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{currentRoom.name}</h2>
                <p className="text-sm text-gray-500">Room ID: {currentRoom.id.slice(0, 8)}...</p>
              </div>
              <button
                onClick={leaveRoom}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Leave Room
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.type === 'message' ? (
                    <div className={`flex ${msg.username === user.username ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.username === user.username
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-300 text-gray-800'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1">{msg.username}</p>
                        <p>{msg.content}</p>
                        <p className="text-xs mt-1 opacity-75">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-sm text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Send size={20} />
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users size={64} className="mx-auto text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Chat!</h2>
              <p className="text-gray-600">Select a room to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}