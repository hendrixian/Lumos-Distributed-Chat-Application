# Lumos Code Architecture

This document explains how the codebase is structured, how data flows through the app, and where to add new behavior safely.

## Design Goals

- Async-first backend I/O (MongoDB, Redis, WebSocket).
- Clear split between API, repository, and realtime layers.
- Frontend state centralized in `App.jsx`, feature UI in components/pages.
- Distributed-safe messaging with Redis Pub/Sub.

## Backend Layout (`backend/app`)

## `main.py`
- FastAPI app wiring.
- CORS configuration.
- Router registration:
  - `/auth`
  - `/rooms`
  - `/users`
  - `/contacts`
  - notification websocket router
- Lifespan startup:
  - connect MongoDB
  - connect Redis
  - ensure contact indexes

## `core/`

### `config.py`
- Environment settings (`BaseSettings`).
- Security, MongoDB, Redis, and presence heartbeat/TTL config.

### `database.py`
- MongoDB and Redis connection managers.

### `image_utils.py`
- Upload validation and conversion to base64 data URL.
- Shared by user profile and group profile updates.

### `ws_manager.py`
- In-memory websocket manager for notifications channel.
- Used by `/ws/notifications` and `/users/online/{username}`.

## `api/`

### `auth.py`
- Register/login/JWT identity.
- Register validation includes:
  - required fields
  - username uniqueness
  - case-insensitive email uniqueness
  - password confirmation match
- Login validation includes required username/password and credential check.

### `rooms.py`
- Group room CRUD and membership APIs.
- Room discovery rules:
  - DM rooms visible only to participants.
  - Group private/public access checks.
- Message history endpoint (`GET /rooms/{room_id}/messages`) with pagination.
- Presence endpoint (`GET /rooms/{room_id}/presence`) based on chat websocket presence.

### `users.py`
- User search and public profile batch fetch.
- Current user profile read/update.
- `GET /users/online/{username}` for DM online indicator.

### `contacts.py`
- Contact request lifecycle.
- Room join request lifecycle for private groups.
- Notification retrieval and read marking.
- DM block system:
  - block status
  - block
  - unblock

### `ws.py`
- Notification websocket endpoint:
  - `/ws/notifications?token=<jwt>`

## `repositories/`

### `message_repo.py`
- Message persistence.
- Paginated message retrieval (oldest -> newest).
- Read receipt updates (`read_by`).
- Room message deletion.

### `room_repo.py`
- Room create/read/update helpers.
- Member add/remove helpers.

### `user_repo.py`
- Legacy/simple user access helpers.

## `services/`

### `pubsub.py`
- Redis Pub/Sub adapter.
- Publishes room events and subscribes room channels.

## `websocket/`

### `chat.py`
- Chat websocket endpoint (`/ws/{room_id}/{username}`).
- Membership/authorization check per room type.
- Connection manager with:
  - local websocket tracking
  - Redis-backed room presence heartbeat
- Handles inbound event types:
  - `message`
  - `read_receipt`
- Persists messages first, then broadcasts via Redis.
- DM block enforcement at send time:
  - any active block in the DM disables sending.
- Explicit leave behavior:
  - only close reason `explicit_leave` removes group membership and emits `user_left`.

## Frontend Layout (`frontend/src`)

## `App.jsx` (state orchestrator)
- Global app state:
  - auth (`token`, `user`)
  - rooms/current room
  - message caches by room
  - websocket references
- Session persistence:
  - `localStorage` token/user restore after refresh
- Main orchestration:
  - fetch room list
  - open/close chat websocket
  - optimistic sending + unsent fallback
  - read receipt handling
  - logout cleanup

## `api/api.jsx`
- HTTP helper functions for:
  - room messages/presence
  - DM block status and actions
  - user online status
- WebSocket helper wrappers and message normalization.

## `pages/`

### `login.jsx`
- Login/register form UI and loading states.
- Basic field requirements at UI level.

### `chatroom.jsx`
- Message list rendering and lazy history loading.
- DM block polling and online status polling.
- Search within current room messages.
- Right panel open/close control.
- Input disable behavior when DM is blocked.

## `components/`

### `sidebar.jsx`
- Chat list and user search.
- Private group discovery pattern:
  - hidden from default list if user is not a member
  - discoverable via search

### `chatbubble.jsx`
- Message bubble rendering:
  - reply preview
  - sent/delivered/read/unsent indicators

### `groupprofile.jsx`
- Group info panel and profile editing.
- DM-specific actions:
  - block/unblock button
  - blocked status hint

### `profile.jsx`, `AddContact.jsx`
- Profile editor and contact/request management UIs.

## Runtime Flows

## Auth Flow
1. User submits login/register.
2. Backend validates and returns JWT.
3. Frontend stores token/user in state + `localStorage`.
4. App fetches rooms and initializes sockets.

## Chat Message Flow
1. UI sends optimistic message with `client_message_id`.
2. Backend websocket receives and validates.
3. Message saved to MongoDB.
4. Event published to Redis room channel.
5. All subscribed backend instances relay to their local clients.
6. Frontend matches incoming message to optimistic one using `client_message_id`.

## Read Receipt Flow
1. Client emits `read_receipt` with message ids.
2. Backend updates `read_by` on matching messages.
3. Backend emits `message_read` event via Redis.
4. Clients patch message status to `read` when applicable.

## DM Block Flow
1. User blocks/unblocks via contacts API.
2. Block status is polled in chatroom view.
3. Chat input is disabled when DM is blocked.
4. Backend enforces block on message send.

## Extension Guidelines

## Adding a New HTTP Feature
1. Define/update schema in `models/schemas.py` when needed.
2. Add route in relevant `api/*.py`.
3. Move heavy data logic into `repositories/`.
4. Add frontend API helper.
5. Wire state updates in `App.jsx` and UI component.

## Adding a New Realtime Event
1. Add event handling in `websocket/chat.py`.
2. Persist data first if history/audit matters.
3. Publish via `services/pubsub.py`.
4. Handle event in frontend socket listener.

## Key Tradeoffs

- Password hashing is currently SHA-256 (easy, not ideal for production security).
- Base64 avatar storage is simple but can grow DB size quickly at scale.
- `/users/online/{username}` is tied to notification websocket manager state.
