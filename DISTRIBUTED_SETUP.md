# Distributed Setup Guide

This guide shows how to run the app in single-instance and multi-instance modes, and explains what is shared across instances.

## Architecture Summary

Core distributed components:

- FastAPI backend instances (one or many)
- Redis Pub/Sub for cross-instance real-time fan-out
- MongoDB for persistent shared state (users, rooms, messages, contacts)

Message path:

1. Client sends message to one backend instance via WebSocket
2. Instance saves message in MongoDB
3. Instance publishes event to Redis room channel
4. All subscribed backend instances receive it
5. Each instance emits to its local connected clients

## Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB
- Redis

## Environment Configuration

Create `backend/.env` with:

```env
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=chatapp

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

Notes:

- `MONGODB_URL` and `REDIS_*` must be identical across all backend instances.
- No manual MongoDB migration is required for current profile/group features.

## Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
# source venv/bin/activate

pip install -r ../requirements.txt
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend endpoints can be configured with `frontend/.env`:

```env
VITE_API_URL=http://<backend-host>:8002
VITE_WS_URL=ws://<backend-host>:8002
```

If not set, frontend auto-uses the current browser hostname with backend port `8002`.

## Run Single Instance (Local)

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

Use one frontend pointed to `8002`.

## Run Multiple Backend Instances (Local Test)

In separate terminals:

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8001
```

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

To test cross-instance behavior quickly:

- Browser A frontend points to `8001`
- Browser B frontend points to `8002`
- Join same room from both users
- Send messages both ways

Expected:

- Messages sync in real-time across both instances
- Message history is persisted and shared

## What Is Shared vs Local

Shared across instances:

- Users, rooms, messages, contacts (MongoDB)
- Chat message fan-out events (Redis Pub/Sub)

Local to each instance:

- In-memory active WebSocket connection list
- In-memory online member set used by presence endpoint

Presence caveat:

- `GET /rooms/{room_id}/presence` reflects online users known to the serving instance.
- In multi-instance mode without shared presence storage, online counts may be partial.

## Current Distributed Behavior Highlights

- Users remain room members until explicit leave action.
- Reconnect/login does not spam repeated join-system messages for existing members.
- User profile and group profile updates are persisted in MongoDB and visible across instances.

## Production Topology Recommendations

1. Put backend instances behind a load balancer that supports WebSocket upgrade.
2. Keep all instances on the same MongoDB and Redis.
3. Use managed services when possible:
   - MongoDB Atlas
   - Redis Cloud / ElastiCache
4. Use TLS (`https://` and `wss://`).
5. Rotate secrets and credentials if exposed.

## Example Nginx Upstream (WebSocket Ready)

```nginx
upstream chat_backend {
    server backend1:8002;
    server backend2:8002;
}

server {
    listen 443 ssl;
    server_name your-domain.example;

    location / {
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## MongoDB Notes

No settings change is required for recent features.

Automatic optional fields now used:

- `users.bio`
- `users.avatar_url`
- `rooms.avatar_url`

Existing documents without these fields remain compatible (defaults are applied).

## Redis Notes

Room channel format:

- `chat:room:{room_id}`

Check connectivity:

```bash
redis-cli ping
```

Monitor pub/sub activity:

```bash
redis-cli MONITOR
```

## Troubleshooting

### Backend starts but clients cannot connect

- Verify frontend `API_URL` and `WS_URL`
- Verify CORS hosts in `backend/app/main.py`
- Confirm backend port matches frontend config

### Messages not syncing across instances

- Confirm both instances point to same Redis
- Confirm both instances point to same MongoDB
- Inspect Redis monitor output while sending messages

### Presence count looks wrong in multi-instance mode

- Expected with current local-instance presence tracking
- Move presence to shared Redis/Mongo state if global accuracy is required

### Image upload fails

- Ensure file type is PNG/JPEG/WEBP/GIF
- Ensure file size is below 2 MB
