import { Bell, Edit2, LogOut, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import soloDefaultAvatar from '../styles/images/solo.png';

export default function UserProfile({
  user,
  onClose,
  onLogout,
  onOpenRequests,
  notificationBadgeCount,
  onUpdateProfile,
}) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBio(user.bio || '');
    setAvatarPreview(user.avatar_url || '');
    setAvatarFile(null);
    setRemoveAvatar(false);
    setEditing(false);
    setError('');
  }, [user]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    setRemoveAvatar(false);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result?.toString() || '');
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(true);
  };

  const handleSave = async () => {
    setError('');
    setIsSaving(true);

    const saved = await onUpdateProfile?.({
      bio,
      avatarFile,
      removeAvatar,
    });

    setIsSaving(false);
    if (!saved) {
      setError('Could not save profile changes.');
      return;
    }

    setEditing(false);
    setAvatarFile(null);
    setRemoveAvatar(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Profile</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col items-center mb-6">
            <img
              src={avatarPreview || soloDefaultAvatar}
              alt={user.username}
              className="w-24 h-24 rounded-full object-cover mb-2 bg-gray-300"
            />
            <p className="font-medium text-lg">{user.username}</p>
            <p className="text-sm text-gray-500">{user.email || 'No email set'}</p>

            {!editing ? (
              <p className="mt-2 text-sm text-gray-600 text-center">
                {bio?.trim() || 'No bio yet.'}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2 w-full">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 border rounded resize-none"
                  rows={3}
                  placeholder="Write your bio..."
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="w-full text-sm"
                />
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="self-start text-xs text-red-600 hover:text-red-700"
                >
                  Remove profile photo
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

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
                disabled={isSaving}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}

            <button
              onClick={onOpenRequests}
              className="relative flex items-center justify-center gap-2 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
            >
              <Bell size={16} /> Chat Requests
              {notificationBadgeCount > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                </span>
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
