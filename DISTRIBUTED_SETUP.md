# Lumos Distributed Setup

This guide explains how to run Lumos in:
- single backend mode (local dev)
- multi-backend mode (distributed behavior test)

## Distributed Components

- **FastAPI instances**: one or more backend processes.
- **MongoDB**: shared persistent data (users, rooms, messages, requests).
- **Redis**:
  - Pub/Sub for room message fan-out across instances
  - presence heartbeat/TTL keys for room online state

## Message Fan-Out Model

1. Client sends websocket message to one backend instance.
2. Instance stores message in MongoDB.
3. Instance publishes message event to Redis room channel.
4. All backend instances subscribed to that room receive event.
5. Each instance pushes event to its own connected clients.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Redis reachable by all backend instances
- MongoDB reachable by all backend instances

## Backend Environment

Create `backend/.env`:

```env
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=chatapp

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

PRESENCE_HEARTBEAT_INTERVAL_SECONDS=10
PRESENCE_TTL_SECONDS=30
```

Rules for distributed correctness:
- every backend instance must use the **same MongoDB**
- every backend instance must use the **same Redis**
- every backend instance must use the **same JWT secret/algorithm**

## Frontend Endpoint Config (Optional)

`frontend/.env`:

```env
VITE_API_URL=http://localhost:8002
VITE_WS_URL=ws://localhost:8002
```

If omitted, frontend auto-resolves to current browser host with backend port `8002`.

## Install Dependencies

Backend:

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

Then:

```bash
pip install -r ../requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

## Single-Instance Run

Backend:

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

Frontend:

```bash
cd frontend
npm run dev
```

## Multi-Instance Run (Local)

Start instance A:

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8001
```

Start instance B:

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

Frontend test options:
- Option 1: run two frontend windows with different `VITE_API_URL/VITE_WS_URL`.
- Option 2: use one frontend and switch target ports as needed for testing.

## What Should Be Shared vs Local

### Shared across all instances
- users, rooms, messages, contacts, notifications (MongoDB)
- room message events (Redis Pub/Sub)
- room presence (`/rooms/{room_id}/presence`) through Redis heartbeat keys

### Local to an instance
- in-memory websocket connection lists
- notification websocket manager online map

## Presence and Online Notes

- Group/room presence endpoint uses shared chat presence logic and is designed for multi-instance rooms.
- DM online status endpoint (`/users/online/{username}`) is based on notification websocket manager state (instance-local).  
  In load-balanced multi-instance deployments, this can be inconsistent unless you enforce sticky routing or move this status to shared storage.

## Validation Checklist for Distributed Test

1. Create two users and join the same room from clients connected through different backend instances.
2. Send messages both directions.
3. Confirm:
   - realtime delivery on both clients
   - history persistence after reload
   - read receipts propagate
4. Check room presence endpoint from either instance.

## Production Recommendations

1. Put backend instances behind a websocket-capable load balancer.
2. Use TLS (`https` + `wss`).
3. Keep secrets out of source control.
4. Use managed MongoDB/Redis where possible.
5. Replace SHA-256 password hashing with bcrypt/argon2.
6. Move avatar media to object storage and store URLs only.

## Quick Diagnostics

Redis connectivity:

```bash
redis-cli ping
```

Watch Redis traffic during message send:

```bash
redis-cli MONITOR
```

OpenAPI docs for endpoint checks:
- `http://localhost:8001/docs`
- `http://localhost:8002/docs`
