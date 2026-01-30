# Code Architecture Guide

## 📐 Design Patterns Used

### 1. Repository Pattern
**Purpose**: Separate data access from business logic

**Example**:
```python
# Instead of directly using MongoDB in routes:
@app.get("/users")
async def get_users():
    users = await db.users.find()  # ❌ Tight coupling

# We use repositories:
@app.get("/users")
async def get_users():
    users = await user_repository.get_all_users()  # ✅ Clean abstraction
```

**Benefits**:
- Easy to test (mock repositories)
- Easy to change database
- Clean, readable code

### 2. Service Layer Pattern
**Purpose**: Centralize business logic

**Example**:
```python
# Redis pub/sub logic is in pubsub_service
# Not scattered across different files
await pubsub_service.publish_message(room_id, message)
```

### 3. Dependency Injection
**Purpose**: Loose coupling, testability

**Example**:
```python
async def create_room(
    room: RoomCreate,
    current_user: User = Depends(get_current_user)  # Injected
):
    ...
```

## 🗂️ File Organization

### Core Layer (`app/core/`)
**Foundation of the application**

#### `config.py`
```python
# Centralized configuration
# All settings in one place
# Environment variable management
settings = Settings()  # Singleton
```

#### `database.py`
```python
# Database connection managers
mongodb = Database()      # MongoDB singleton
redis_cache = RedisCache()  # Redis singleton

# Lifecycle methods
await mongodb.connect()
await mongodb.disconnect()
```

### Repository Layer (`app/repositories/`)
**Data access abstraction**

#### `user_repository.py`
```python
# All user database operations
await user_repository.create_user(username, password)
await user_repository.get_user_by_username(username)
await user_repository.user_exists(username)
```

#### `room_repository.py`
```python
# All room database operations
await room_repository.create_room(room_id, name, creator)
await room_repository.get_all_rooms()
await room_repository.delete_room(room_id)
```

#### `message_repository.py`
```python
# All message database operations
await message_repository.save_message(room_id, username, content)
await message_repository.get_room_messages(room_id)
```

**Why separate repositories?**
- Single Responsibility Principle
- Easy to test individual operations
- Clear boundaries between data entities

### Service Layer (`app/services/`)
**Business logic and external service integration**

#### `pubsub_service.py`
```python
# Redis pub/sub management
# Distributed message broadcasting

# Subscribe to room updates
await pubsub_service.subscribe_to_room(room_id, callback)

# Publish message to all servers
await pubsub_service.publish_message(room_id, message)
```

**Key Features**:
- Manages Redis channels
- Background tasks for listening
- Callback system for message handling

### API Layer (`app/api/`)
**HTTP endpoints**

#### `auth.py`
```python
# Authentication endpoints
POST   /auth/register  # Create new user
POST   /auth/login     # Get JWT token
GET    /auth/me        # Get current user

# Uses: user_repository
# Returns: Pydantic models
```

#### `rooms.py`
```python
# Room management endpoints
POST   /rooms/         # Create room
GET    /rooms/         # List rooms
GET    /rooms/{id}     # Get room
DELETE /rooms/{id}     # Delete room

# Uses: room_repository, message_repository
# Returns: Pydantic models
```

### WebSocket Layer (`app/websocket/`)
**Real-time communication**

#### `chat.py`
```python
# WebSocket connection management
# Integrates: Redis pub/sub + MongoDB

ConnectionManager:
  - Manages local WebSocket connections
  - Subscribes to Redis channels
  - Broadcasts messages locally
  - Coordinates with other server instances
```

**Message Flow**:
```
WebSocket → ConnectionManager → Redis Pub → All Servers → All Clients
                ↓
             MongoDB (save)
```

### Models Layer (`app/models/`)
**Data schemas and validation**

#### `schemas.py`
```python
# Pydantic models for validation
UserCreate    # Registration data
User          # User response
Token         # JWT token
Room          # Room data
ChatMessage   # WebSocket message
```

## 🔄 Request Flow Examples

### User Registration Flow
```
1. POST /auth/register
2. auth.py → register()
3. user_repository.user_exists()  # Check if exists
4. user_repository.create_user()  # Save to MongoDB
5. Return User model
```

### Sending a Message Flow
```
1. WebSocket message received
2. chat.py → websocket_endpoint()
3. message_repository.save_message()  # Save to MongoDB
4. pubsub_service.publish_message()   # Broadcast via Redis
5. All servers receive via Redis
6. Each server broadcasts to local WebSocket connections
7. All clients see the message
```

### Joining a Room Flow
```
1. WebSocket connect
2. ConnectionManager.connect()
3. pubsub_service.subscribe_to_room()    # Subscribe to Redis channel
4. message_repository.get_room_messages() # Get history from MongoDB
5. Send history to user
6. User ready to chat
```

## 🎨 Code Style Guide

### Function Documentation
```python
async def create_room(self, room_id: str, name: str, created_by: str) -> Dict:
    """
    Create a new chat room
    
    Args:
        room_id: Unique room identifier
        name: Room name
        created_by: Username of creator
        
    Returns:
        Created room document
    """
```

### Type Hints
```python
# Always use type hints
async def get_user(username: str) -> Optional[Dict]:
    ...

# For complex types
from typing import List, Dict, Optional
```

### Naming Conventions
```python
# Classes: PascalCase
class ConnectionManager:

# Functions/Variables: snake_case
async def create_room():
user_repository = UserRepository()

# Constants: UPPER_SNAKE_CASE
MAX_CONNECTIONS = 1000
```

### Error Handling
```python
# Use FastAPI HTTPException
if not room:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Room not found"
    )
```

## 🧩 Key Components Explained

### Singleton Pattern
```python
# Only one instance of database connections
mongodb = Database()      # Global
redis_cache = RedisCache()  # Global

# Everyone uses the same instance
# No duplicate connections
```

### Async/Await
```python
# All I/O operations are async
await mongodb.connect()
await user_repository.create_user(...)
await websocket.send_text(...)

# Benefits:
# - Non-blocking I/O
# - Better performance
# - Handle many concurrent connections
```

### Lifespan Management
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await mongodb.connect()
    await redis_cache.connect()
    
    yield  # App runs
    
    # Shutdown
    await mongodb.disconnect()
    await redis_cache.disconnect()
```

## 🔧 Adding New Features

### Add a New Entity (e.g., "Friends")

**1. Create Repository**
```python
# app/repositories/friend_repository.py
class FriendRepository:
    async def add_friend(self, user: str, friend: str):
        ...
```

**2. Create API Endpoints**
```python
# app/api/friends.py
@router.post("/friends/add")
async def add_friend(...):
    await friend_repository.add_friend(...)
```

**3. Add to main.py**
```python
from .api import friends
app.include_router(friends.router, prefix="/friends")
```

### Add a New Service

**1. Create Service**
```python
# app/services/notification_service.py
class NotificationService:
    async def send_notification(self, user: str, message: str):
        ...
```

**2. Use in Endpoints**
```python
from ..services.notification_service import notification_service
await notification_service.send_notification(...)
```

## 📚 Dependencies Between Layers

```
API Layer (auth.py, rooms.py)
    ↓ uses
Repository Layer (user_repository, room_repository)
    ↓ uses
Core Layer (database, config)

Service Layer (pubsub_service)
    ↓ uses
Core Layer (redis_cache)

WebSocket Layer (chat.py)
    ↓ uses
Repository + Service Layers
```

**Rule**: Never skip layers (e.g., API → Database directly)

## ✅ Best Practices Used

1. **Separation of Concerns**: Each module has one job
2. **Single Responsibility**: Each class does one thing
3. **DRY (Don't Repeat Yourself)**: Reusable repositories/services
4. **Dependency Injection**: Loose coupling
5. **Type Safety**: Type hints everywhere
6. **Error Handling**: Proper exceptions
7. **Documentation**: Docstrings for all functions
8. **Async by Default**: All I/O is non-blocking

