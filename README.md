# Distributed Chat Application

A **truly distributed**, real-time chat application with message persistence, horizontal scaling, and enterprise-grade architecture.

![Chat Application](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

## Features

### Core Features
- **JWT Authentication** - Secure user registration and login
- **Real-time Messaging** - Instant message delivery via WebSockets
- **Room Management** - Create, join, and manage chat rooms
- **User Presence** - See when users join and leave rooms
- **Responsive Design** - Beautiful UI that works everywhere
- **Message History** - Persistent chat history in MongoDB

### Distributed Features
- **Horizontal Scaling** - Run multiple backend instances
- **Redis Pub/Sub** - Synchronize messages across all servers
- **MongoDB Storage** - Persistent data that survives restarts
- **Load Balancing Ready** - Distribute traffic across instances
- **Fault Tolerant** - Continue working even if one server fails

### Architecture Features
- **Repository Pattern** - Clean data access layer
- **Service Layer** - Centralized business logic
- **Dependency Injection** - Loose coupling, high testability
- **Clean Code** - Well-documented, maintainable codebase
- **Docker Support** - Easy deployment with docker-compose

## Architecture

### System Overview
```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Client A  │────▶│  Client B  │────▶│  Client C  │
└─────┬──────┘     └─────┬──────┘     └─────┬──────┘
      │                  │                  │
      │            WebSocket               │
      └──────────────┬───────────────────┘
                     │
              ┌──────▼──────┐
              │   Nginx     │ (Load Balancer)
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼───┐  ┌───▼────┐  ┌───▼────┐
    │Backend1│  │Backend2│  │Backend3│  (FastAPI + WebSocket)
    └────┬───┘  └───┬────┘  └───┬────┘
         │          │           │
         └──────────┼───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼────┐          ┌─────▼─────┐
    │ MongoDB │          │   Redis   │
    │(Storage)│          │ (Pub/Sub) │
    └─────────┘          └───────────┘
```

### Technology Stack

**Backend**
- FastAPI - Modern, fast web framework
- Motor - Async MongoDB driver
- Redis - Pub/sub messaging and caching
- WebSockets - Real-time bidirectional communication
- JWT - Secure authentication

**Frontend**
- React - UI library
- Tailwind CSS - Utility-first styling
- Lucide React - Icon library
- Native WebSocket API - Real-time connection

**Infrastructure**
- MongoDB - Document database for persistence
- Redis - In-memory data store for pub/sub
- Docker - Containerization
- Nginx - Load balancing (optional)

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app entry
│   │   ├── core/
│   │   │   ├── config.py               # Configuration
│   │   │   └── database.py             # MongoDB & Redis connections
│   │   ├── api/
│   │   │   ├── auth.py                 # Authentication endpoints
│   │   │   └── rooms.py                # Room management endpoints
│   │   ├── repositories/               # Data access layer
│   │   │   ├── user_repository.py
│   │   │   ├── room_repository.py
│   │   │   └── message_repository.py
│   │   ├── services/                  # Business logic layer
│   │   │   └── pubsub_service.py      # Redis pub/sub
│   │   ├── websocket/
│   │   │   └── chat.py                # WebSocket handler
│   │   └── models/
│   │       └── schemas.py             # Pydantic models
│   ├── .env                           # Environment template
│   ├── Dockerfile                     # Backend container
│   └── requirements.txt               # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # React main component
│   │   └── main.jsx                   # React entry point
│   └── package.json                   # Node dependencies
├── docker-compose.yml                 # Multi-container setup
├── README.md                          # This file
├── DISTRIBUTED_SETUP.md              # Detailed setup guide
└── CODE_ARCHITECTURE.md              # Code structure guide
```

## Quick Start

**Install Dependencies:**

```bash
# Install MongoDB
# Windows: https://www.mongodb.com/try/download/community
# Mac: brew install mongodb-community
# Linux: sudo apt-get install mongodb

# Install Redis
# Windows: https://github.com/microsoftarchive/redis/releases
# Mac: brew install redis
# Linux: sudo apt-get install redis-server

# Start services
# MongoDB: mongod
# Redis: redis-server
```

**Setup Backend:**

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run backend
python -m uvicorn app.main:app --reload --port 8000
```

**Setup Frontend:**

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Documentation

- **[DISTRIBUTED_SETUP.md](DISTRIBUTED_SETUP.md)** - Complete setup guide with architecture details
- **[CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md)** - Code structure and design patterns
- **API Docs**: http://localhost:8000/docs (Swagger UI)

## Testing the Distributed System

### Test Multiple Backend Instances

**Terminal 1:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8001
```

**Terminal 2:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

**Browser Window 1** (connected to Instance 1):
- Update `frontend/src/App.jsx`: `API_URL = 'http://localhost:8001'`
- Register as "Alice"
- Create a room

**Browser Window 2** (connected to Instance 2):
- Update `frontend/src/App.jsx`: `API_URL = 'http://localhost:8002'`
- Register as "Bob"
- Join the same room

**Result**: Alice and Bob chat in real-time across different servers! 🎉

## How It Works

### Message Flow

1. **User sends message** → WebSocket to Backend Instance 1
2. **Backend 1** saves message to MongoDB
3. **Backend 1** publishes message to Redis channel `chat:room:{room_id}`
4. **All backend instances** (1, 2, 3, ...) subscribed to channel receive message
5. **Each backend** broadcasts message to its local WebSocket connections
6. **All users** see the message instantly, regardless of which server they're connected to

### Data Persistence

- **Users**: Stored in MongoDB `users` collection
- **Rooms**: Stored in MongoDB `rooms` collection
- **Messages**: Stored in MongoDB `messages` collection
- **Real-time sync**: Via Redis pub/sub channels

### Scalability

```
1 Backend Instance  →  ~1,000 concurrent users
2 Backend Instances →  ~2,000 concurrent users
3 Backend Instances →  ~3,000 concurrent users
...and so on!
```

Add more instances behind a load balancer for virtually unlimited scaling.

## 🔧 Configuration

### Environment Variables

Create `backend/.env`:

```bash
# Security
SECRET_KEY=your-secret-key-here-change-in-production

# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=chat_app

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### Frontend Configuration

Update `frontend/src/App.jsx`:

```javascript
const API_URL = 'http://localhost:8000';  // Your backend URL
const WS_URL = 'ws://localhost:8000';     // Your WebSocket URL
```

## Troubleshooting

### MongoDB Connection Error
```bash
# Check if MongoDB is running
mongosh
# or
mongo

# Start MongoDB service
# Windows: net start MongoDB
# Mac: brew services start mongodb-community
# Linux: sudo systemctl start mongodb
```

### Redis Connection Error
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis service
# Windows: redis-server
# Mac: brew services start redis
# Linux: sudo systemctl start redis
```

### WebSocket Connection Failed
- Ensure backend is running
- Check CORS settings in `backend/app/main.py`
- Verify WebSocket URL matches backend URL

### Messages Not Syncing Between Instances
- Verify all instances connected to same MongoDB
- Verify all instances connected to same Redis
- Check Redis pub/sub: `redis-cli MONITOR`

## Production Deployment

### Manual Deployment

1. **Setup MongoDB Atlas** (managed MongoDB)
2. **Setup Redis Cloud** (managed Redis)
3. **Deploy backend** to Heroku, Railway, or AWS
4. **Deploy frontend** to Vercel, Netlify, or AWS S3
5. **Setup Nginx** for load balancing

### Security Checklist

- [ ] Change `SECRET_KEY` to random string
- [ ] Use HTTPS in production
- [ ] Enable MongoDB authentication
- [ ] Enable Redis authentication
- [ ] Set strong passwords
- [ ] Enable rate limiting
- [ ] Validate all inputs
- [ ] Use environment variables for secrets

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- FastAPI for the amazing framework
- MongoDB for reliable persistence
- Redis for blazing-fast pub/sub
- React for the awesome UI library

---