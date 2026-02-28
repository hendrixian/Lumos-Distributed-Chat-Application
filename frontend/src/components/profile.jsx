import { Bell, Edit2, LogOut, X } from 'lucide-react';
import { useState } from 'react';

export default function UserProfile({
  user,
  onClose,
  onLogout,
  onOpenRequests,
  hasNotificationBadge,
}) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio || '');
  const [status, setStatus] = useState(user.status || 'Online');

  const handleSave = () => {
    setEditing(false);
    console.log('Saved', { username, email, bio, status });
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Profile</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-300 mb-2" />
            {!editing ? (
              <>
                <p className="font-medium text-lg">{username}</p>
                <p className="text-sm text-gray-500">{email || 'No email set'}</p>
                <p className="text-sm text-gray-500 italic">{status}</p>
              </>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Username"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Email"
                />
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Bio"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                <Edit2 size={16} /> Edit Profile
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Save
              </button>
            )}

            <button
              onClick={onOpenRequests}
              className="relative flex items-center justify-center gap-2 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
            >
              <Bell size={16} /> Chat Requests
              {hasNotificationBadge && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-red-400" />
              )}
            </button>

            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
