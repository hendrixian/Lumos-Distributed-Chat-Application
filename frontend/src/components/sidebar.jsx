import { Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import UserProfile from './profile.jsx';
import { API_URL } from '../config/endpoints.js';

export default function Sidebar({
  user,
  token,
  rooms,
  messagesByRoom,
  currentRoom,
  showCreateRoom,
  setShowCreateRoom,
  onCreateRoom,
  onDeleteRoom,
  onJoinRoom,
  onJoinPublicRoom,
  onRequestJoinPrivateRoom,
  onLogout,
  onUpdateUserProfile,
  onOpenRequestsPage,
  notificationBadgeCount,
  onRefreshBadge,
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    description: '',
    visibility: 'public',
  });
  const [userResults, setUserResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [searchSuccess, setSearchSuccess] = useState('');

  useEffect(() => {
    if (!token) return;
    const query = search.trim();
    if (!query) {
      setUserResults([]);
      setSearchError('');
      setSearchSuccess('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/users/search?username=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const data = await res.json();
          setSearchError(data.detail || 'Search failed');
          setUserResults([]);
          return;
        }
        const data = await res.json();
        setUserResults(data);
        setSearchError(data.length === 0 ? 'No users found' : '');
      } catch (err) {
        setSearchError('Search failed');
        setUserResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, token]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => room.name.toLowerCase().includes(search.toLowerCase()));
  }, [rooms, search]);

  const sendRequest = async (targetUsername) => {
    setSearchError('');
    setSearchSuccess('');
    try {
      const res = await fetch(`${API_URL}/contacts/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: targetUsername }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSearchError(data.detail || 'Failed to send request');
        return;
      }
      setSearchSuccess(`Request sent to ${targetUsername}`);
      if (onRefreshBadge) onRefreshBadge();
    } catch (err) {
      setSearchError('Failed to send request');
    }
  };

  const handleCreateRoomSubmit = async () => {
    if (!newRoomData.name.trim()) return;
    const created = await onCreateRoom(newRoomData);
    if (!created) return;
    setNewRoomData({ name: '', description: '', visibility: 'public' });
    setShowCreateRoom(false);
  };

  const handleJoinPublicRoom = async (room) => {
    setSearchError('');
    setSearchSuccess('');
    const result = await onJoinPublicRoom?.(room);
    if (!result?.ok) {
      setSearchError(result?.error || 'Failed to join room');
      return;
    }
    setSearchSuccess(result.message || `Joined ${room.name}`);
  };

  const handleRequestPrivateRoom = async (room) => {
    setSearchError('');
    setSearchSuccess('');
    const result = await onRequestJoinPrivateRoom?.(room);
    if (!result?.ok) {
      setSearchError(result?.error || 'Failed to send join request');
      return;
    }
    setSearchSuccess(result.message || `Join request sent to ${room.name}`);
  };

  return (
    <>
      <div className="w-80 bg-white border-r flex flex-col relative">
        <div className="h-14 px-3 border-b flex items-center gap-3">
          <button
            onClick={() => setShowProfile(true)}
            className="relative p-2 rounded-full hover:bg-gray-100"
            title="Menu"
          >
            &#9776;
            {notificationBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] leading-none flex items-center justify-center font-semibold">
                {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
              </span>
            )}
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats or users"
            className="flex-1 px-4 py-2 text-sm bg-gray-100 rounded-full outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="p-4 border-b">
          {showCreateRoom ? (
            <div className="flex flex-col gap-2">
              <input
                className="px-2 py-1 border rounded"
                value={newRoomData.name}
                onChange={(e) => setNewRoomData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Room name"
              />
              <input
                className="px-2 py-1 border rounded"
                value={newRoomData.description}
                onChange={(e) => setNewRoomData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
              />
              <label className="text-xs text-gray-600">Room visibility</label>
              <select
                className="px-2 py-1 border rounded"
                value={newRoomData.visibility}
                onChange={(e) =>
                  setNewRoomData((prev) => ({ ...prev, visibility: e.target.value }))
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <div className="flex gap-2">
                <button onClick={handleCreateRoomSubmit} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateRoom(false);
                    setNewRoomData({ name: '', description: '', visibility: 'public' });
                  }}
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCreateRoom(true)} className="w-full bg-blue-600 text-white py-2 rounded flex justify-center gap-2">
              <Plus /> Create Room
            </button>
          )}
          {searchSuccess && <p className="text-xs text-green-600 mt-2">{searchSuccess}</p>}
          {searchError && <p className="text-xs text-red-600 mt-2">{searchError}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {search.trim() && (
            <div className="border-b">
              <p className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-500">Users</p>
              {userResults.length === 0 && <p className="px-4 pb-3 text-sm text-gray-400">No matching users</p>}
              {userResults.map((item) => (
                <div key={`user-${item.username}`} className="px-4 py-2 flex items-center justify-between hover:bg-gray-50">
                  <span className="text-sm font-medium">{item.username}</span>
                  <button
                    className="inline-flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded"
                    onClick={() => sendRequest(item.username)}
                  >
                    <UserPlus size={14} /> Send
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-500">Chats</p>
          {filteredRooms.map((room) => {
            const messages = messagesByRoom?.[room.id] || [];
            const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const timestamp = latestMessage
              ? new Date(latestMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            const isMember = Array.isArray(room.members) && room.members.includes(user.username);
            const isGroupRoom = room.type !== 'dm';
            const visibility = room.visibility === 'private' ? 'private' : 'public';
            const canOpenRoom = room.type === 'dm' || isMember;

            return (
              <div
                key={room.id}
                className={`p-4 border-b ${canOpenRoom ? 'cursor-pointer hover:bg-gray-50' : ''} ${currentRoom?.id === room.id ? 'bg-blue-50' : ''}`}
                onClick={() => {
                  if (canOpenRoom) onJoinRoom(room);
                }}
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={room.avatar_url || room.avatar || 'https://via.placeholder.com/40'}
                      alt={room.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-medium truncate">{room.name}</h3>
                      {isGroupRoom && !isMember && (
                        <p className="text-[11px] text-gray-500 capitalize">{visibility} room</p>
                      )}
                      {latestMessage && (
                        <p className="text-xs text-gray-400 truncate">
                          {latestMessage.username}: {latestMessage.content}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {timestamp && <span className="text-xs text-gray-400">{timestamp}</span>}
                    {room.created_by === user.username && room.type !== 'dm' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRoom(room.id);
                        }}
                        className="text-red-600"
                        title="Delete room"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {isGroupRoom && !isMember && visibility === 'public' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinPublicRoom(room);
                        }}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Join room
                      </button>
                    )}
                    {isGroupRoom && !isMember && visibility === 'private' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestPrivateRoom(room);
                        }}
                        className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700"
                      >
                        Request to join
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showProfile && (
        <UserProfile
          user={user}
          notificationBadgeCount={notificationBadgeCount}
          onUpdateProfile={onUpdateUserProfile}
          onOpenRequests={() => {
            setShowProfile(false);
            onOpenRequestsPage();
          }}
          onClose={() => setShowProfile(false)}
          onLogout={onLogout}
        />
      )}
    </>
  );
}
