# Distributed Chat Application

A real-time chat application built with FastAPI, React, MongoDB, and Redis, designed for horizontal scaling and persistent messaging.

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

## Features

### Chat and Rooms
- JWT authentication (register/login)
- Public room creation and room membership management
- Real-time messaging over WebSocket
- Message persistence in MongoDB
- Room presence (`members` + `online`)
- Users stay in a room until they explicitly click **Leave Room**
- Join/leave system messages only on intentional membership changes

### Profile and Group Customization
- User profile editing:
  - Profile photo upload/remove
  - Bio update
- Group (room) editing by room creator/admin:
  - Group photo upload/remove
  - Group description update
- Admin badge shown in group member list

### UX Improvements
- Faster login transition (non-blocking post-login hydration)
- Loading animation during login/register instead of a frozen screen

### Distributed Architecture
- Redis Pub/Sub for multi-instance message fan-out
- MongoDB for durable storage
- Ready for load-balanced horizontal scaling

## Tech Stack

### Backend
- FastAPI
- Motor (async MongoDB driver)
- Redis
- WebSockets
- JWT (python-jose)

### Frontend
- React
- Tailwind CSS
- Lucide React

## Quick Start

## 1) Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB running
- Redis running

## 2) Backend Setup
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

pip install -r ../requirements.txt
python -m uvicorn app.main:app --reload --port 8002
```

## 3) Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 4) Open App
- Frontend: Vite default URL (usually `http://localhost:5173`)
- Backend API docs: `http://localhost:8002/docs`

## Configuration

Backend reads environment variables from `backend/.env`:

```env
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

MONGODB_URL=mongodb+srv://<username>:<password>@chatapp.k7wrdrd.mongodb.net/chatapp?retryWrites=true&w=majority&appName=chatapp
MONGODB_DB_NAME=chatapp


REDIS_HOST=redis-10419.c1.ap-southeast-1-1.ec2.cloud.redislabs.com
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

Update frontend backend URLs in `frontend/src/App.jsx`:

```js
const API_URL = 'http://localhost:8002';
const WS_URL = 'ws://localhost:8002';
```

## MongoDB Notes (Important)

No manual MongoDB migration is required for the new profile/group customization features.

- New optional fields are added automatically when users/rooms are updated:
  - `users.bio`
  - `users.avatar_url`
  - `rooms.avatar_url`
- Existing documents without these fields still work (code uses defaults).

## Image Upload Rules

- Allowed types: PNG, JPEG, WEBP, GIF
- Max file size: 2 MB
- Current storage format: Base64 data URL in MongoDB

## Key API Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### User Profile
- `GET /users/me`
- `PATCH /users/me` (`bio`, `avatar`, `remove_avatar`)

### Rooms
- `GET /rooms/`
- `POST /rooms/`
- `PATCH /rooms/{room_id}` (creator/admin only; `description`, `avatar`, `remove_avatar`)
- `GET /rooms/{room_id}/presence`
- `POST /rooms/{room_id}/members`

## Docs
- [DISTRIBUTED_SETUP.md](DISTRIBUTED_SETUP.md)
- [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md)

## Troubleshooting

### Cannot connect to MongoDB
- Verify MongoDB is running
- Verify `MONGODB_URL` and `MONGODB_DB_NAME` in `backend/.env`

### Cannot connect to Redis
- Verify Redis is running
- Verify `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`

### WebSocket issues
- Ensure backend is running on the same URL configured in frontend
- Ensure `WS_URL` matches backend host/port

## Security Reminder

If credentials or secrets were committed accidentally, rotate them immediately:
- MongoDB credentials
- Redis password
- `SECRET_KEY`

## License

MIT. See [LICENSE](LICENSE).
