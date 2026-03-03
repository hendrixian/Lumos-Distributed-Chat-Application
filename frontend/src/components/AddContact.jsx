import React, { useEffect, useState } from 'react';
import { API_URL } from '../config/endpoints.js';

export default function AddContact({
  token,
  onRoomRefresh,
  refreshSignal,
  onNotificationChange,
  onBack,
}) {
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authHeader = { Authorization: `Bearer ${token}` };

  const fetchRequests = async () => {
    const res = await fetch(`${API_URL}/contacts/requests`, { headers: authHeader });
    if (!res.ok) return [];
    const data = await res.json();
    setRequests(data);
    return data;
  };

  const fetchNotifications = async () => {
    const res = await fetch(`${API_URL}/contacts/notifications`, { headers: authHeader });
    if (!res.ok) return [];
    const data = await res.json();
    setNotifications(data);
    return data;
  };

  const refreshAll = async () => {
    const [incoming, all] = await Promise.all([fetchRequests(), fetchNotifications()]);
    if (onNotificationChange) {
      const unread = all.filter((n) => !n.read).length;
      onNotificationChange(unread + incoming.length);
    }
  };

  useEffect(() => {
    if (!token) return;
    refreshAll();
  }, [token, refreshSignal]);

  const handleRespond = async (requestId, action, requestType = 'contact') => {
    setError('');
    setSuccess('');

    const res = await fetch(`${API_URL}/contacts/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ request_id: requestId, action, request_type: requestType }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.detail || 'Failed to process request');
      return;
    }

    if (requestType === 'room_join') {
      setSuccess(action === 'accept' ? 'Join request accepted' : 'Join request rejected');
    } else {
      setSuccess(action === 'accept' ? 'Request accepted' : 'Request rejected');
    }
    await refreshAll();
    if (action === 'accept' && onRoomRefresh) onRoomRefresh();
  };

  const markAsRead = async (notificationId) => {
    await fetch(`${API_URL}/contacts/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: authHeader,
    });
    refreshAll();
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Chat Requests</h2>
          {onBack && (
            <button
              className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              onClick={onBack}
            >
              Back to Chat
            </button>
          )}
        </div>

        {error && <p className="text-red-600 mb-2">{error}</p>}
        {success && <p className="text-green-600 mb-2">{success}</p>}

        <h3 className="font-semibold mb-2">Incoming Requests</h3>
        {requests.length === 0 && <p className="text-sm text-gray-500 mb-4">No pending requests</p>}
        {requests.length > 0 && (
          <ul className="mb-5 border rounded">
            {requests.map((req) => (
              <li key={req.request_id} className="flex justify-between items-center border-b px-3 py-2">
                <span>
                  {req.request_type === 'room_join'
                    ? `${req.from_username} wants to join "${req.room_name || 'Private Room'}"`
                    : `${req.from_username} sent you a chat request`}
                </span>
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-3 rounded"
                    onClick={() =>
                      handleRespond(req.request_id, 'accept', req.request_type || 'contact')
                    }
                  >
                    Accept
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 rounded"
                    onClick={() =>
                      handleRespond(req.request_id, 'reject', req.request_type || 'contact')
                    }
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="font-semibold mb-2">Notifications</h3>
        {notifications.length === 0 && <p className="text-sm text-gray-500">No notifications</p>}
        {notifications.length > 0 && (
          <ul className="max-h-72 overflow-y-auto border rounded">
            {notifications.map((note) => (
              <li
                key={note.notification_id}
                className={`px-3 py-2 border-b text-sm ${note.read ? 'bg-gray-50' : 'bg-blue-50'}`}
              >
                <div className="flex justify-between gap-2">
                  <p>{note.message}</p>
                  {!note.read && (
                    <button
                      className="text-xs text-blue-700 underline"
                      onClick={() => markAsRead(note.notification_id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
