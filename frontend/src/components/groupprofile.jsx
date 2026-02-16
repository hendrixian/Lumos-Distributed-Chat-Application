import { X } from 'lucide-react';
import { useState } from 'react';

export default function GroupInfo({ group, onClose, onMessage }) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchText, setSearchText] = useState('');

  if (!group) return null;

  const { name, members: memberUsernames = [], images, files, links } = group;

  // Map usernames to objects (extend if more info is available)
  const members = memberUsernames.map((username) => ({
    username,
    avatar: null,
    online: false,
  }));

  const totalMembers = members.length;
  const onlineMembers = members.filter((m) => m.online).length;

  // Filter members by search text
  const filteredMembers = members.filter((m) =>
    m.username.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">{selectedMember ? 'Profile' : 'Group Info'}</h2>
        <button
          onClick={selectedMember ? () => setSelectedMember(null) : onClose}
          className="text-gray-600 hover:text-gray-800"
        >
          <X size={20} />
        </button>
      </div>

      {selectedMember ? (
        // --- Member Profile Panel ---
        <div className="flex flex-col items-center p-6">
          <div className="w-24 h-24 rounded-full bg-gray-300 mb-3" />
          <p className="text-lg font-semibold">{selectedMember.username}</p>
          <p className="text-sm text-gray-500">
            Status: {selectedMember.online ? 'Online' : 'Offline'}
          </p>

          {/* --- Message Button --- */}
          <button
            onClick={() => onMessage?.(selectedMember)}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Message
          </button>
        </div>
      ) : (
        <>
          {/* Group Profile */}
          <div className="flex flex-col items-center p-6 border-b">
            <div className="w-24 h-24 rounded-full bg-gray-300 mb-3" />
            <p className="text-lg font-semibold">{name}</p>
            <p className="text-sm text-gray-500">
              {totalMembers} members, {onlineMembers} online
            </p>
          </div>

          {/* Media / Files / Links */}
          <div className="p-6 border-b flex justify-between text-center">
            <div>
              <p className="font-semibold">{images || 0}</p>
              <p className="text-xs text-gray-500">Images</p>
            </div>
            <div>
              <p className="font-semibold">{files || 0}</p>
              <p className="text-xs text-gray-500">Files</p>
            </div>
            <div>
              <p className="font-semibold">{links || 0}</p>
              <p className="text-xs text-gray-500">Links</p>
            </div>
          </div>

          {/* Members List with Search */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Members</h3>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search..."
                className="ml-3 px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <div
                  key={member.username}
                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 rounded-md p-1"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="relative">
                    <img
                      src={member.avatar || 'https://via.placeholder.com/40'}
                      alt={member.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {member.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{member.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
