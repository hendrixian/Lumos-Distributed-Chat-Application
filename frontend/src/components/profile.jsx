// UserProfile.jsx
import { X, Edit2, LogOut } from 'lucide-react';
import { useState, useRef } from 'react';
import { updateUserProfile } from '../api/api.jsx'; // Make sure this exists

export default function UserProfile({ user, onClose, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio || '');
  const [status, setStatus] = useState(user.status || 'Online');
  const [avatar, setAvatar] = useState(null); // file object
  const [preview, setPreview] = useState(user.avatar || null); // URL preview

  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      formData.append('bio', bio);
   
      if (avatar) formData.append('avatar', avatar);

      // Call backend API
      const updated = await updateUserProfile(user.token, user.id, formData);

      // Update preview if backend returns avatar URL
      if (updated.avatar) setPreview(updated.avatar);

      setEditing(false);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Blurred background */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Profile</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col items-center mb-6 relative">
            {/* Avatar */}
            <div className="relative w-24 h-24 rounded-full mb-2">
              <img
                src={preview || 'https://via.placeholder.com/96'}
                alt="Profile"
                className="w-full h-full rounded-full object-cover"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-white border rounded-full p-1 shadow hover:bg-gray-100"
                title="Change profile picture"
              >
                <Edit2 size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Display info */}
            {!editing ? (
              <>
                <p className="font-medium text-lg">{username}</p>
                <p className="text-sm text-gray-500">{email || 'No email set'}</p>
                <p className="text-sm text-gray-500 italic">{status}</p>
              </>
            ) : (
              <div className="flex flex-col gap-3 w-full mt-3">
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

          {/* Error */}
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

          {/* Action buttons */}
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
                disabled={loading}
                className={`w-full py-2 rounded-lg text-white ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            )}

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
