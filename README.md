# Lumos Chat

Lumos is a real-time chat app built with FastAPI, React, MongoDB, and Redis.
It supports group rooms, DM rooms, read receipts, profile/group avatars, and distributed message fan-out across backend instances.

## What Is Implemented

### Authentication and Session
- Register and login with JWT.
- Register validation:
  - email format check
  - username already taken check
  - password and confirm password must match
- Login validation:
  - username and password are required
  - invalid credentials are rejected
- Frontend persists auth session in `localStorage`, so refresh (`Ctrl+R`) does not force logout if token is still valid.

### Contacts and DM
- Send/accept/reject contact requests.
- DM room is created when contact request is accepted.
- DM block system:
  - `Block <user>`
  - `Unblock <user>`
  - when blocked, messaging is disabled in both directions for that DM
- Block status endpoint for UI state.

### Group Rooms
- Create public/private groups.
- Private groups can be requested to join.
- Room creator can:
  - add members
  - edit group description
  - edit group visibility
  - upload/remove group avatar
- Members remain in room until explicit leave.

### Messaging
- WebSocket realtime chat.
- MongoDB message persistence.
- Reply-to message support.
- Read receipts:
  - sender sees `delivered` (double check)
  - sender sees `read` (highlighted double check) when recipient reads
- Optimistic send status:
  - `sent`, `delivered`, `read`, `unsent`
- Lazy loading older messages via HTTP pagination.

### Profile and Presence
- User profile update (`bio`, avatar upload/remove).
- Default avatars:
  - group fallback image
  - user fallback image
- Room presence endpoint for online counts.
- DM header online/offline status.

### Distributed Runtime
- Redis Pub/Sub for cross-instance message propagation.
- Redis-backed room presence heartbeat/TTL.
- MongoDB as shared durable store.

## Stack

### Backend
- FastAPI
- Motor (MongoDB async driver)
- Redis
- WebSockets
- python-jose (JWT)
- Pydantic v2

### Frontend
- React + Vite
- Tailwind CSS
- lucide-react

## Project Structure

```text
backend/
  app/
    api/
    core/
    repositories/
    services/
    websocket/
frontend/
  src/
    components/
    pages/
    api/
README.md
CODE_ARCHITECTURE.md
DISTRIBUTED_SETUP.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB
- Redis

## Configuration

Create `backend/.env`:

```env
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

MONGODB_URL=mongodb+srv://<username>:<password>@chatapp.k7wrdrd.mongodb.net/chatapp?retryWrites=true&w=majority&appName=chatapp
MONGODB_DB_NAME=chatapp

REDIS_HOST=redis-10419.c1.ap-southeast-1-1.ec2.cloud.redislabs.com
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

PRESENCE_HEARTBEAT_INTERVAL_SECONDS=10
PRESENCE_TTL_SECONDS=30
```

Optional frontend overrides in `frontend/.env`:

```env
VITE_API_URL=http://localhost:8002
VITE_WS_URL=ws://localhost:8002
```

If not provided, frontend auto-uses current browser host and backend port `8002`.

## Local Development

### 1) Install Backend Dependencies

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Linux/macOS:

```bash
source venv/bin/activate
```

Then install:

```bash
pip install -r ../requirements.txt
```

### 2) Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

### 3) Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4) Open

- App: `http://localhost:5173`
- OpenAPI docs: `http://localhost:8002/docs`

## API Overview

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Users
- `GET /users/search?username=...`
- `POST /users/public/batch`
- `GET /users/online/{username}`
- `GET /users/me`
- `PATCH /users/me`

### Contacts
- `POST /contacts/add`
- `GET /contacts/requests`
- `POST /contacts/respond`
- `GET /contacts/notifications`
- `POST /contacts/notifications/{notification_id}/read`
- `GET /contacts/dm/{room_id}/block-status`
- `POST /contacts/dm/{room_id}/block`
- `POST /contacts/dm/{room_id}/unblock`

### Rooms
- `GET /rooms/`
- `POST /rooms/`
- `GET /rooms/{room_id}`
- `PATCH /rooms/{room_id}`
- `DELETE /rooms/{room_id}`
- `POST /rooms/{room_id}/join`
- `POST /rooms/{room_id}/join-request`
- `GET /rooms/{room_id}/members`
- `POST /rooms/{room_id}/members`
- `GET /rooms/{room_id}/members/count`
- `GET /rooms/{room_id}/presence`
- `GET /rooms/{room_id}/messages`

## WebSocket Contracts

### Chat Socket
- Endpoint: `/ws/{room_id}/{username}`
- Client -> server:
  - message payload: `{"type":"message","content":"...","reply_to":null,"client_message_id":"..."}`
  - read receipt: `{"type":"read_receipt","message_ids":["..."]}`
- Server -> client events:
  - `message`
  - `message_read`
  - `user_joined`
  - `user_left`

### Notifications Socket
- Endpoint: `/ws/notifications?token=<jwt>`
- Used for contact/join-request related realtime notifications.

## Media Rules

- Allowed image types: PNG, JPEG, WEBP, GIF
- Max upload size: 2 MB
- Current storage model: Base64 data URL in MongoDB

## Known Tradeoffs

- Password hashing currently uses SHA-256; move to bcrypt/argon2 for production hardening.
- Avatar storage in MongoDB (base64) is simple but not ideal at scale; object storage is recommended.

## Additional Docs

- [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md)
- [DISTRIBUTED_SETUP.md](DISTRIBUTED_SETUP.md)

## License

MIT (see `LICENSE`).
