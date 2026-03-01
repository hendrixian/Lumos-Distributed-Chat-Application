import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import UserProfile from './profile.jsx';

export default function Sidebar({
  user,
  rooms,
  messagesByRoom, // { roomId: [message1, message2, ...] }
  currentRoom,
  showCreateRoom,
  setShowCreateRoom,
  onCreateRoom,
  onDeleteRoom,
  onJoinRoom,
  onLogout
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    description: '',
    avatar: null
  });

  const fileInputRef = useRef(null);

  const handleRoomChange = (field, value) => {
    setNewRoomData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) handleRoomChange('avatar', file);
  };

  const handleCreateRoomSubmit = async () => {
    if (!newRoomData.name.trim()) return;

    const created = await onCreateRoom(newRoomData);

    // Backend log for developer
    console.log('Room data submitted to backend:', newRoomData);

    if (!created) return;

    // Reset form
    setNewRoomData({ name: '', description: '', avatar: null });
    setShowCreateRoom(false);
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) =>
      room.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [rooms, search]);

  return (
    <>
      <div className="w-80 bg-white border-r flex flex-col relative">
        {/* Top Bar */}
        <div className="h-14 px-3 border-b flex items-center gap-3">
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Menu"
          >
            ☰
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="flex-1 px-4 py-2 text-sm bg-gray-100 rounded-full outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Create Room */}
        <div className="p-4 border-b">
          {showCreateRoom ? (
            <div className="flex flex-col gap-2">
              <input
                className="px-2 py-1 border rounded"
                value={newRoomData.name}
                onChange={(e) => handleRoomChange('name', e.target.value)}
                placeholder="Room name"
              />
              <input
                className="px-2 py-1 border rounded"
                value={newRoomData.description}
                onChange={(e) => handleRoomChange('description', e.target.value)}
                placeholder="Description"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                >
                  <Edit2 size={14} /> Add Avatar
                </button>
                {newRoomData.avatar && (
                  <span className="text-xs truncate">{newRoomData.avatar.name}</span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoomSubmit}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateRoom(false);
                    setNewRoomData({ name: '', description: '', avatar: null });
                  }}
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateRoom(true)}
              className="w-full bg-blue-600 text-white py-2 rounded flex justify-center gap-2"
            >
              <Plus /> Create Room
            </button>
          )}
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.map((room) => {
            const messages = messagesByRoom?.[room.id] || [];
            const latestMessage =
              messages.length > 0 ? messages[messages.length - 1] : null;

            // Format timestamp
            const timestamp = latestMessage
              ? new Date(latestMessage.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={room.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  currentRoom?.id === room.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => onJoinRoom(room)}
              >
                <div className="flex justify-between gap-2 items-start">
                  {/* Left: Avatar + Room Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={room.avatar || 'https://via.placeholder.com/40'}
                      alt={room.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-medium truncate">{room.name}</h3>
                      {latestMessage && (
                        <p className="text-xs text-gray-400 truncate">
                          {latestMessage.username}: {latestMessage.content}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Timestamp + Delete button */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {timestamp && (
                      <span className="text-xs text-gray-400">{timestamp}</span>
                    )}
                    {room.created_by === user.username && (
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Profile Panel */}
      {showProfile && (
        <UserProfile
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={onLogout}
        />
      )}
    </>
  );
}
