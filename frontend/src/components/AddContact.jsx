//this code is added by thu for send contact request and search username to add contact
import React, { useState, useEffect } from 'react';

export default function AddContact({ token }) {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requests, setRequests] = useState([]);

  const API_URL = 'http://localhost:8002'; // backend URL

  // Load pending requests
  const fetchRequests = async () => {
    const res = await fetch(`${API_URL}/contacts/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setRequests(data);
    }
  };

  useEffect(() => {
    if (token) fetchRequests();
  }, [token]);

  // Search users by username (no request sent yet)
  const handleSearch = async () => {
    setError('');
    setSuccess('');
    if (!searchUsername) return;

    try {
      const res = await fetch(`${API_URL}/users/search?username=${searchUsername}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('User not found');
      const data = await res.json();
      setSearchResults([data]); // show as list
    } catch (err) {
      setSearchResults([]);
      setError(err.message);
    }
  };

  // Send contact request
  const handleAdd = async (username) => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/contacts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to send request');
      }
      setSuccess(`Request sent to ${username}!`);
      setSearchResults([]);
      setSearchUsername('');
      fetchRequests(); // refresh pending requests
    } catch (err) {
      setError(err.message);
    }
  };

  // Respond to request
  const handleRespond = async (requestId, action) => {
    await fetch(`${API_URL}/contacts/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ request_id: requestId, action }),
    });
    fetchRequests();
  };

  return (
    <div className="p-4 border-b">
      <h2 className="text-lg font-bold mb-2">Add Contact</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search username"
          value={searchUsername}
          onChange={(e) => setSearchUsername(e.target.value)}
          className="border p-1 flex-1"
        />
        <button
          type="button"
          className="bg-blue-500 text-white px-2 py-1 rounded"
          onClick={handleSearch} // only search, don't send request
        >
          Search
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {success && <p className="text-green-500">{success}</p>}

      {/* Show search results */}
      {searchResults.length > 0 && (
        <ul className="mb-4 border p-2">
          {searchResults.map((user) => (
            <li key={user.username} className="flex justify-between items-center py-1">
              <span>{user.username}</span>
              <button
                className="bg-blue-500 text-white px-2 py-1 rounded"
                onClick={() => handleAdd(user.username)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-md font-semibold mt-4 mb-2">Pending Requests</h3>
      {requests.length === 0 && <p>No requests</p>}
      <ul>
        {requests.map((req) => (
          <li key={req.request_id} className="flex justify-between items-center border-b py-1">
            <span>{req.from_username}</span>
            <div className="flex gap-1">
              <button
                className="bg-green-500 text-white px-2 rounded"
                onClick={() => handleRespond(req.request_id, 'accept')}
              >
                Accept
              </button>
              <button
                className="bg-red-500 text-white px-2 rounded"
                onClick={() => handleRespond(req.request_id, 'reject')}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
