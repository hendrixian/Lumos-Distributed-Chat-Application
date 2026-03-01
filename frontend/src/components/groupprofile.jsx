import { X, UserPlus, LogOut, Edit2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function GroupInfo({
  group,
  user,
  onlineUsernames = [],
  onClose,
  onMessage,
  onAddMember,
  onUpdateGroupProfile,
  onLeaveRoom,
}) {
  const [selectedMemberUsername, setSelectedMemberUsername] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [editingGroupProfile, setEditingGroupProfile] = useState(false);
  const [groupDescription, setGroupDescription] = useState(group?.description || '');
  const [groupVisibility, setGroupVisibility] = useState(
    group?.visibility === 'private' ? 'private' : 'public'
  );
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(
    group?.avatar_url || group?.avatar || ''
  );
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [removeGroupAvatar, setRemoveGroupAvatar] = useState(false);
  const [savingGroupProfile, setSavingGroupProfile] = useState(false);
  const [groupProfileError, setGroupProfileError] = useState('');
  const name = group?.name || '';
  const description = group?.description || '';
  const memberUsernames = group?.members || [];
  const images = group?.images;
  const files = group?.files;
  const links = group?.links;

  const onlineSet = useMemo(() => new Set(onlineUsernames), [onlineUsernames]);

  // Map usernames to objects (extend if more info is available)
  const members = memberUsernames.map((username) => ({
    username,
    avatar: null,
    online: onlineSet.has(username),
    isAdmin: username === group?.created_by,
  }));
  const selectedMember = members.find((m) => m.username === selectedMemberUsername) || null;

  useEffect(() => {
    setSelectedMemberUsername(null);
    setEditingGroupProfile(false);
    setGroupDescription(group?.description || '');
    setGroupVisibility(group?.visibility === 'private' ? 'private' : 'public');
    setGroupAvatarPreview(group?.avatar_url || group?.avatar || '');
    setGroupAvatarFile(null);
    setRemoveGroupAvatar(false);
    setGroupProfileError('');
  }, [group?.id]);

  if (!group) return null;

  const totalMembers = members.length;
  const onlineMembers = members.filter((m) => m.online).length;

  // Filter members by search text
  const filteredMembers = members.filter((m) =>
    m.username.toLowerCase().includes(searchText.toLowerCase())
  );
  const isOwner = group?.created_by === user?.username;
  const canEditGroup = isOwner && group?.type !== 'dm';

  const handleGroupAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setGroupAvatarFile(file);
    setRemoveGroupAvatar(false);
    const reader = new FileReader();
    reader.onload = () => setGroupAvatarPreview(reader.result?.toString() || '');
    reader.readAsDataURL(file);
  };

  const handleRemoveGroupAvatar = () => {
    setGroupAvatarFile(null);
    setGroupAvatarPreview('');
    setRemoveGroupAvatar(true);
  };

  const saveGroupProfile = async () => {
    if (!canEditGroup || !group?.id) return;
    setGroupProfileError('');
    setSavingGroupProfile(true);

    const saved = await onUpdateGroupProfile?.(group.id, {
      description: groupDescription,
      visibility: groupVisibility,
      avatarFile: groupAvatarFile,
      removeAvatar: removeGroupAvatar,
    });

    setSavingGroupProfile(false);
    if (!saved) {
      setGroupProfileError('Could not save group profile.');
      return;
    }

    setEditingGroupProfile(false);
    setGroupAvatarFile(null);
    setRemoveGroupAvatar(false);
  };

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">{selectedMember ? 'Profile' : 'Group Info'}</h2>
        <button
          onClick={selectedMember ? () => setSelectedMemberUsername(null) : onClose}
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
          {selectedMember.isAdmin && (
            <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
              Admin
            </span>
          )}
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
            <img
              src={groupAvatarPreview || 'https://via.placeholder.com/96'}
              alt={name}
              className="w-24 h-24 rounded-full object-cover bg-gray-300 mb-3"
            />
            <p className="text-lg font-semibold">{name}</p>

            {!editingGroupProfile ? (
              <>
                <p className="text-sm text-gray-500 mt-1 text-center px-2">
                  {description?.trim() || 'No description available.'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Visibility: {group?.visibility === 'private' ? 'Private' : 'Public'}
                </p>
              </>
            ) : (
              <div className="w-full mt-2">
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded resize-none text-sm"
                  rows={3}
                  placeholder="Group description"
                />
                <label className="block text-xs text-gray-600 mt-2">Visibility</label>
                <select
                  value={groupVisibility}
                  onChange={(e) => setGroupVisibility(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleGroupAvatarChange}
                  className="w-full text-sm mt-2"
                />
                <button
                  type="button"
                  onClick={handleRemoveGroupAvatar}
                  className="mt-2 text-xs text-red-600 hover:text-red-700"
                >
                  Remove group photo
                </button>
              </div>
            )}

            <p className="text-sm text-gray-500">
              {totalMembers} members, {onlineMembers} online
            </p>

            {groupProfileError && (
              <p className="text-xs text-red-600 mt-2">{groupProfileError}</p>
            )}

            {canEditGroup && !editingGroupProfile && (
              <button
                onClick={() => setEditingGroupProfile(true)}
                className="mt-3 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 size={14} />
                Edit Group
              </button>
            )}

            {canEditGroup && editingGroupProfile && (
              <div className="mt-3 w-full flex gap-2">
                <button
                  onClick={saveGroupProfile}
                  disabled={savingGroupProfile}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400"
                >
                  {savingGroupProfile ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingGroupProfile(false);
                    setGroupDescription(group?.description || '');
                    setGroupVisibility(group?.visibility === 'private' ? 'private' : 'public');
                    setGroupAvatarPreview(group?.avatar_url || group?.avatar || '');
                    setGroupAvatarFile(null);
                    setRemoveGroupAvatar(false);
                    setGroupProfileError('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            )}

            {onLeaveRoom && (
              <button
                onClick={() => onLeaveRoom(group)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut size={16} />
                Leave Room
              </button>
            )}
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
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Members</h3>
                {isOwner && (
                  <button
                    onClick={() => onAddMember?.(group)}
                    className="inline-flex items-center justify-center p-1.5 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50"
                    title="Add member"
                  >
                    <UserPlus size={14} />
                  </button>
                )}
              </div>
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
                  onClick={() => setSelectedMemberUsername(member.username)}
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.username}</p>
                      {member.isAdmin && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-semibold">
                          Admin
                        </span>
                      )}
                    </div>
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
