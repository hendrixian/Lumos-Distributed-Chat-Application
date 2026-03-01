const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002';

// =====================================================
// ===================== MESSAGES ======================
// =====================================================

// Fetch paginated messages (lazy load ready)
export async function fetchRoomMessages(
  roomId,
  token,
  { limit = 50, before = null } = {}
) {
  if (!roomId) return [];

  let url = `${API_URL}/rooms/${roomId}/messages?limit=${limit}`;
  if (before) {
    url += `&before=${before}`;
  }

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to fetch messages');

  const data = await res.json();

  // Backend already returns oldest -> newest
  return data.map((msg) => ({
    _id: msg._id,
    username: msg.username,
    content: msg.content,
    type: msg.type,
    timestamp: new Date(msg.timestamp).toISOString(),
    reply_to: msg.reply_to || null,
    avatar: msg.avatar_url || null,
  }));
}

export async function fetchRoomPresence(roomId, token) {
  if (!roomId) {
    return { online_count: 0, online_members: [] };
  }

  const res = await fetch(`${API_URL}/rooms/${roomId}/presence`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to fetch room presence');

  return res.json();
}


// =====================================================
// ===================== WEBSOCKET =====================
// =====================================================

export function connectToRoom(roomId, username, onMessage, onError) {
  const ws = new WebSocket(`${WS_URL}/ws/${roomId}/${username}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    onMessage({
      _id: message._id || null,
      username: message.username,
      content: message.content,
      type: message.type,
      timestamp: new Date(message.timestamp).toISOString(),
      reply_to: message.reply_to || null,
      avatar: message.avatar_url || null,
    });
  };

  ws.onerror = onError;

  return ws;
}

export function sendMessage(ws, content, replyTo = null) {
  if (!ws || !content.trim()) return;

  ws.send(
    JSON.stringify({
      content,
      reply_to: replyTo || null,
    })
  );
}

export function leaveRoom(ws) {
  if (ws) ws.close();
}


// =====================================================
// ================= USER PROFILE ======================
// =====================================================

export async function fetchUserProfile(token, userId) {
  const res = await fetch(`${API_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch user profile');

  const data = await res.json();

  return {
    ...data,
    avatar: data.avatar_url || null,
  };
}

export async function updateUserProfile(token, userId, data) {
  const formData = new FormData();

  if (data.username) formData.append('username', data.username);
  if (data.email) formData.append('email', data.email);
  if (data.bio) formData.append('bio', data.bio);
  if (data.status) formData.append('status', data.status);
  if (data.avatar) formData.append('avatar', data.avatar);

  const res = await fetch(`${API_URL}/users/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) throw new Error('Failed to update profile');

  const updated = await res.json();

  return {
    ...updated,
    avatar: updated.avatar_url || null,
  };
}
