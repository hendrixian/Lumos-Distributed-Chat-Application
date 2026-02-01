// GroupInfo.jsx
import { X } from 'lucide-react';

export default function GroupInfo({ group, onClose }) {
  if (!group) return null;

  const { name, members, images, files, links } = group;

  const totalMembers = members?.length || 0;
  const onlineMembers = members?.filter((m) => m.online).length || 0;

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">Group Info</h2>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-800"
        >
          <X size={20} />
        </button>
      </div>

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

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="font-semibold mb-3">Members</h3>
        <div className="space-y-3">
          {members?.map((member) => (
            <div
              key={member.username}
              className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 rounded-md p-1"
              onClick={() => console.log('Open profile for', member.username)} // placeholder for future profile panel
            >
              {/* Avatar with online indicator */}
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

              {/* Username */}
              <div className="flex-1">
                <p className="font-medium">{member.username}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
