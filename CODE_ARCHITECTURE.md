# Code Architecture Guide

This document explains how the current codebase is organized, how requests flow through the system, and where to add or modify features safely.

## Design Principles

- Separation of concerns across API, repository, service, and WebSocket layers
- Async-first I/O for MongoDB, Redis, and WebSocket operations
- Explicit data contracts using Pydantic schemas
- Feature behavior encoded close to ownership boundaries

## Backend Architecture

Root: `backend/app/`

### 1) Core Layer (`core/`)

- `config.py`
  - Central environment settings
  - JWT and database/Redis config
- `database.py`
  - Singleton-like connection managers for MongoDB and Redis
  - Application startup/shutdown integration
- `image_utils.py`
  - Upload validation for user/group images
  - Converts image bytes to base64 data URL
  - Enforces content type and size limit (2 MB)
- `ws_manager.py`
  - Notification WebSocket manager for contact events

### 2) API Layer (`api/`)

- `auth.py`
  - Register/login/JWT validation
  - `GET /auth/me`
- `users.py`
  - User search
  - `GET /users/me`
  - `PATCH /users/me` for bio + profile image
- `rooms.py`
  - Room CRUD and members
  - Presence endpoint
  - `PATCH /rooms/{room_id}` for creator-admin group profile updates
- `contacts.py`
  - Contact requests, DM room generation, notifications
- `ws.py`
  - Notification socket endpoint

### 3) Repository Layer (`repositories/`)

- `room_repo.py`
  - Room creation/read/update helpers
  - Membership persistence (`add_member`, `remove_member`)
- `message_repo.py`
  - Message persistence and paginated history
- `user_repo.py`
  - User-related data access helpers

### 4) Service Layer (`services/`)

- `pubsub.py`
  - Redis pub/sub abstraction for cross-instance chat fan-out

### 5) WebSocket Layer (`websocket/`)

- `chat.py`
  - Chat room connection manager
  - Real-time broadcast pipeline
  - Explicit-leave behavior:
    - Membership is removed only on `close(1000, "explicit_leave")`
    - Silent disconnects keep room membership intact

### 6) Models Layer (`models/`)

- `schemas.py`
  - API response/request contracts
  - Includes:
    - `User` with `bio`, `avatar_url`
    - `Room` with `description`, `avatar_url`, `members`

## Frontend Architecture

Root: `frontend/src/`

### 1) State Orchestration

- `App.jsx`
  - Global auth/session state
  - Room list + current room state
  - WebSocket socket lifecycle management
  - API mutations for:
    - User profile update
    - Group profile update
  - Auth UX:
    - Non-blocking post-login hydration
    - Loading states for login/register

### 2) Main UI Components

- `components/sidebar.jsx`
  - Room list rendering
  - Uses `room.avatar_url` where available
  - Opens user profile panel
- `components/profile.jsx`
  - User self-profile UI
  - Edit/save bio + profile photo
- `pages/chatroom.jsx`
  - Chat stream rendering
  - Presence polling (`/rooms/{id}/presence`)
  - Passes group update callbacks to group panel
- `components/groupprofile.jsx`
  - Group info/members panel
  - Shows admin badge for creator
  - Admin-only group edit controls (photo + description)
  - Leave-room action
- `pages/login.jsx`
  - Login/register form
  - Animated loading state during auth requests

### 3) API Helpers

- `api/api.jsx`
  - Message pagination
  - Presence fetch
  - User profile fetch/update helpers

## Request and Event Flows

### Login Flow (Optimized UX)

1. User submits login/register form
2. Auth request completes
3. UI transitions immediately to main app shell
4. Background hydration runs in parallel:
   - `GET /rooms/`
   - badge fetch endpoints
   - `GET /auth/me`
5. Form shows spinner/status while request is running

### Chat Message Flow (Distributed)

1. Client sends WebSocket message
2. Server stores message in MongoDB
3. Server publishes message to Redis room channel
4. All backend instances subscribed to that room receive it
5. Each instance pushes to its local connected clients

### Membership Flow

1. User opens/joins room socket
2. Backend ensures membership exists in MongoDB
3. Reconnects do not emit repeated join-system messages if already a member
4. User remains a member until explicit leave

### Explicit Leave Flow

1. Client closes socket with reason `explicit_leave`
2. Backend removes member from room document
3. Backend emits `user_left` message event

### User Profile Update Flow

1. `PATCH /users/me` with optional `bio`, `avatar`, `remove_avatar`
2. Backend validates image type/size and stores as data URL
3. Updated user object returned and applied to UI state

### Group Profile Update Flow (Creator/Admin)

1. Creator submits `PATCH /rooms/{room_id}` with optional description/avatar changes
2. Backend enforces authorization (`created_by == current_user`)
3. Updated room returned and patched into room list/current room in UI

## Distributed Considerations

- Messages and persistent entities are distributed correctly through MongoDB + Redis.
- Presence is tracked in Redis with per-room/per-user keys and heartbeat TTL refresh.
  - `GET /rooms/{room_id}/presence` now returns global online users across backend instances/devices.
  - Abrupt disconnect cleanup is eventual (bounded by TTL) while graceful disconnect removes presence immediately.

## Data Model Notes

- User document fields include:
  - `username`, `email`, `hashed_password`, `bio`, `avatar_url`, timestamps
- Room document fields include:
  - `id`, `name`, `description`, `avatar_url`, `created_by`, `members`, timestamps
- New optional fields do not require manual migration.

## Extension Guidelines

### Add a New API Feature

1. Define/extend schema in `models/schemas.py` if needed
2. Add API route in the relevant `api/*.py`
3. Add repository method if data access logic grows
4. Update frontend state wiring in `App.jsx`
5. Add UI controls in responsible component

### Add a New Distributed Event

1. Define event payload shape in WebSocket handler
2. Persist to MongoDB if event requires history
3. Publish through `services/pubsub.py`
4. Handle rendering in client WebSocket listeners

## Current Tradeoffs

- Image storage currently uses base64 data URLs in MongoDB for simplicity.
- For production-scale media, migrate to object storage (S3/Cloud Storage) and store only URLs.
