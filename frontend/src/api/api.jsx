import { API_URL, WS_URL } from '../config/endpoints.js';

const TZ_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2})$/;

function normalizeServerTimestamp(rawTimestamp) {
  if (!rawTimestamp) return null;
  const asString = String(rawTimestamp);
  const normalized = TZ_SUFFIX_RE.test(asString) ? asString : `${asString}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function deriveMessageStatus(message) {
  const readBy = Array.isArray(message?.read_by) ? message.read_by : [];
  const hasBeenReadByRecipient = readBy.some((username) => username && username !== message?.username);
  if (hasBeenReadByRecipient) return 'read';
  return message?.delivery_status || 'delivered';
}

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
    timestamp: normalizeServerTimestamp(msg.timestamp),
    reply_to: msg.reply_to || null,
    avatar: msg.avatar_url || null,
    read_by: Array.isArray(msg.read_by) ? msg.read_by : [],
    delivery_status: msg.delivery_status || 'delivered',
    status: deriveMessageStatus(msg),
    client_message_id: msg.client_message_id || null,
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
      timestamp: normalizeServerTimestamp(message.timestamp),
      reply_to: message.reply_to || null,
      avatar: message.avatar_url || null,
      read_by: Array.isArray(message.read_by) ? message.read_by : [],
      delivery_status: message.delivery_status || 'delivered',
      status: deriveMessageStatus(message),
      client_message_id: message.client_message_id || null,
      message_ids: Array.isArray(message.message_ids) ? message.message_ids : [],
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

export async function fetchUserProfile(token) {
  const res = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch user profile');

  const data = await res.json();

  return {
    ...data,
    avatar: data.avatar_url || null,
  };
}

export async function updateUserProfile(token, data) {
  const formData = new FormData();

  if (Object.prototype.hasOwnProperty.call(data || {}, 'bio')) {
    formData.append('bio', data.bio ?? '');
  }
  if (data?.avatar) formData.append('avatar', data.avatar);
  if (data?.remove_avatar) formData.append('remove_avatar', 'true');

  const res = await fetch(`${API_URL}/users/me`, {
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
