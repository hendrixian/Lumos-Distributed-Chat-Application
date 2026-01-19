from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, rooms
from .websocket.chat import websocket_endpoint
from .core.config import settings

app = FastAPI(title=settings.app_name)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/rooms", tags=["rooms"])

# WebSocket endpoint
@app.websocket("/ws/{room_id}/{username}")
async def websocket_route(websocket: WebSocket, room_id: str, username: str):
    await websocket_endpoint(websocket, room_id, username)

@app.get("/")
async def root():
    return {"message": "Distributed Chat API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}