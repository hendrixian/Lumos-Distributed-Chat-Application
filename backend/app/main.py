"""
FastAPI main application
Initializes the distributed chat system with MongoDB and Redis
"""
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .api import auth, rooms
from .websocket.chat import websocket_endpoint
from .core.config import settings
from .core.database import mongodb, redis_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    Handles startup and shutdown events for database connections
    """
    # Startup: Connect to databases
    print("\n🚀 Starting Distributed Chat Application...")
    await mongodb.connect()
    await redis_cache.connect()
    print("✓ All systems ready!\n")
    
    yield
    
    # Shutdown: Disconnect from databases
    print("\n🛑 Shutting down...")
    await mongodb.disconnect()
    await redis_cache.disconnect()
    print("✓ Cleanup complete\n")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan
)

# CORS middleware - allows frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/rooms", tags=["rooms"])


@app.websocket("/ws/{room_id}/{username}")
async def websocket_route(websocket: WebSocket, room_id: str, username: str):
    """
    WebSocket endpoint for real-time chat
    
    Args:
        websocket: WebSocket connection
        room_id: Chat room identifier
        username: User's username
    """
    await websocket_endpoint(websocket, room_id, username)


@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "message": "Distributed Chat API",
        "version": "2.0.0",
        "features": ["MongoDB", "Redis", "Distributed WebSocket"]
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mongodb": "connected" if mongodb.client else "disconnected",
        "redis": "connected" if redis_cache.redis else "disconnected"
    }