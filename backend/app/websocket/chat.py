from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
from datetime import datetime
import json

class ConnectionManager:
    def __init__(self):
        # room_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # websocket -> username
        self.user_mapping: Dict[WebSocket, str] = {}
        # room_id -> set of usernames
        self.room_users: Dict[str, set] = {}

    async def connect(self, websocket: WebSocket, room_id: str, username: str):
        await websocket.accept()
        
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
            self.room_users[room_id] = set()
        
        self.active_connections[room_id].append(websocket)
        self.user_mapping[websocket] = username
        self.room_users[room_id].add(username)
        
        # Notify others that user joined
        join_message = {
            "type": "user_joined",
            "room_id": room_id,
            "username": username,
            "content": f"{username} joined the room",
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(room_id, json.dumps(join_message))

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            
            username = self.user_mapping.get(websocket)
            if username and room_id in self.room_users:
                self.room_users[room_id].discard(username)
            
            if websocket in self.user_mapping:
                del self.user_mapping[websocket]
            
            # Clean up empty rooms
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                if room_id in self.room_users:
                    del self.room_users[room_id]
            
            return username
        return None

    async def broadcast(self, room_id: str, message: str):
        if room_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except:
                    disconnected.append(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn, room_id)

    def get_room_users(self, room_id: str) -> List[str]:
        return list(self.room_users.get(room_id, set()))

manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket, room_id: str, username: str):
    await manager.connect(websocket, room_id, username)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Create message object
            message = {
                "type": "message",
                "room_id": room_id,
                "username": username,
                "content": message_data.get("content", ""),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await manager.broadcast(room_id, json.dumps(message))
    
    except WebSocketDisconnect:
        username = manager.disconnect(websocket, room_id)
        if username:
            leave_message = {
                "type": "user_left",
                "room_id": room_id,
                "username": username,
                "content": f"{username} left the room",
                "timestamp": datetime.utcnow().isoformat()
            }
            await manager.broadcast(room_id, json.dumps(leave_message))