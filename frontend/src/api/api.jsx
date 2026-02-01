const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002';

// -------------------- Auth --------------------
export async function register(username, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed');
  return res.json();
}

export async function login(username, password) {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).detail || 'Login failed');
  return res.json();
}

// -------------------- Rooms --------------------
export async function fetchRooms(token) {
  const res = await fetch(`${API_URL}/rooms/`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function createRoom(token, name) {
  const res = await fetch(`${API_URL}/rooms/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function deleteRoom(token, roomId) {
  const res = await fetch(`${API_URL}/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete room');
  return true;
}

// -------------------- WebSocket --------------------
export function connectToRoom(roomId, username, onMessage, onError) {
  const ws = new WebSocket(`${WS_URL}/ws/${roomId}/${username}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    onMessage(message);
  };

  ws.onerror = onError;

  return ws;
}

export function sendMessage(ws, content) {
  if (ws && content.trim()) ws.send(JSON.stringify({ content }));
}

export function leaveRoom(ws) {
  if (ws) ws.close();
}
