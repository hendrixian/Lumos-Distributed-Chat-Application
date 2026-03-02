"""
FastAPI main application.
Initializes chat APIs, database connections, and websocket routes.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, contacts, rooms, users
from .api.contacts import ensure_contact_indexes
from .api.ws import router as notification_ws_router
from .core.config import settings
from .core.database import mongodb, redis_cache
from .websocket.chat import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("\nStarting Distributed Chat Application...")
    await mongodb.connect()
    await redis_cache.connect()
    await ensure_contact_indexes()
    print("All systems ready\n")

    yield

    # Shutdown
    print("\nShutting down...")
    await mongodb.disconnect()
    await redis_cache.disconnect()
    print("Cleanup complete\n")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

default_allow_origins = [
    "http://127.0.0.1:8002",
    "http://localhost:8002",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_allow_origins,
    # Allow LAN origins like http://192.168.x.x:5173 for multi-device testing.
    allow_origin_regex=r"^https?://(?:localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(contacts.router, prefix="/contacts", tags=["contacts"])
app.include_router(notification_ws_router, tags=["notifications"])


@app.websocket("/ws/{room_id}/{username}")
async def websocket_route(websocket: WebSocket, room_id: str, username: str):
    await websocket_endpoint(websocket, room_id, username)


@app.get("/")
async def root():
    return {
        "message": "Distributed Chat API",
        "version": "2.0.0",
        "features": ["MongoDB", "Redis", "Distributed WebSocket"],
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "mongodb": "connected" if mongodb.client else "disconnected",
        "redis": "connected" if redis_cache.redis else "disconnected",
    }
