import { Plus, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import UserProfile from './profile.jsx';

export default function Sidebar({
  user,
  rooms,
  messagesByRoom, // { roomId: [message1, message2, ...] }
  currentRoom,
  showCreateRoom,
  newRoomName,
  setNewRoomName,
  setShowCreateRoom,
  onCreateRoom,
  onDeleteRoom,
  onJoinRoom,
  onLogout
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState('');

  // Filter rooms by search text
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) =>
      room.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [rooms, search]);

  return (
    <>
      <div className="w-80 bg-white border-r flex flex-col relative">
        {/* Top Bar (Telegram-style) */}
        <div className="h-14 px-3 border-b flex items-center gap-3">
          {/* Menu Button */}
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Menu"
          >
            ☰
          </button>

          {/* Search */}
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
            <div className="flex gap-2">
              <input
                className="flex-1 px-2 py-1 border rounded"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
              />
              <button
                onClick={onCreateRoom}
                className="bg-blue-600 text-white px-3 rounded"
              >
                Add
              </button>
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

            return (
              <div
                key={room.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  currentRoom?.id === room.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => onJoinRoom(room)}
              >
                <div className="flex justify-between gap-2 items-center">
                  {/* Left: Avatar + Room Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Group Avatar */}
                    <img
                      src={room.avatar || 'https://via.placeholder.com/40'}
                      alt={room.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />

                    {/* Room Name + Latest Message */}
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-medium truncate">{room.name}</h3>
                      {latestMessage && (
                        <p className="text-xs text-gray-400 truncate">
                          {latestMessage.username}: {latestMessage.content}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Delete button if creator */}
                  {room.created_by === user.username && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRoom(room.id);
                      }}
                      className="text-red-600 shrink-0"
                      title="Delete room"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
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
