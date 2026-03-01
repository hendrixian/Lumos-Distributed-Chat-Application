"""
WebSocket chat handler with distributed message broadcasting
Uses Redis pub/sub to synchronize messages across multiple server instances
Stores messages in MongoDB for persistence
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
from datetime import datetime
import json
from ..services.pubsub import pubsub_service
from ..repositories.message_repo import message_repository
from ..repositories.room_repo import room_repository


class ConnectionManager:
    """
    Manages WebSocket connections for chat rooms
    Works with Redis pub/sub for distributed message broadcasting
    """
    
    def __init__(self):
        # room_id -> list of websockets (local to this server instance)
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # websocket -> username mapping
        self.user_mapping: Dict[WebSocket, str] = {}
        # room_id -> set of usernames (local connections)
        self.room_users: Dict[str, set] = {}
    
    async def connect(self, websocket: WebSocket, room_id: str, username: str):
        """
        Accept WebSocket connection and add to room
        """
        print(f"🔗 Attempting to connect {username} to room {room_id}")
        
        try:
            await websocket.accept()
            print(f"✅ WebSocket accepted for {username}")
            
            # Initialize room data structures if needed
            if room_id not in self.active_connections:
                self.active_connections[room_id] = []
                self.room_users[room_id] = set()
                
                print(f"🆕 New room created: {room_id}")
                
                # Subscribe to Redis channel for this room
                result = await pubsub_service.subscribe_to_room(
                    room_id, 
                    lambda msg: self._handle_redis_message(room_id, msg)
                )
                print(f"✅ Redis subscription: {result}")
            
            # Add connection to room
            self.active_connections[room_id].append(websocket)
            self.user_mapping[websocket] = username
            self.room_users[room_id].add(username)
            
            print(f"✅ Added {username} to room {room_id}")
            print(f"   Room now has {len(self.active_connections[room_id])} connections")
            
            # History is loaded via HTTP pagination on the frontend.
            # Keep WebSocket stream realtime-only to prevent duplicate batches.
            
            # Notify all users (across all servers) that user joined
            join_message = {
                "type": "user_joined",
                "room_id": room_id,
                "username": username,
                "content": f"{username} joined the room",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            print(f"💾 Saving join message to MongoDB")
            
            # Save to database
            await message_repository.save_message(
                room_id=room_id,
                username=username,
                content=join_message["content"],
                message_type="user_joined"
            )
            
            # Add member to room in database
            await room_repository.add_member(room_id, username)
            print(f"👥 Added {username} to room members in database")
            
            print(f"📤 Broadcasting join via Redis")
            
            # Broadcast via Redis (reaches all server instances)
            result = await pubsub_service.publish_message(room_id, join_message)
            print(f"✅ Join broadcast complete: {result}")
            
        except Exception as e:
            print(f"❌ Error in connect(): {e}")
            import traceback
            traceback.print_exc()
            raise
    async def disconnect(self, websocket: WebSocket, room_id: str):
        """
        Remove WebSocket connection from room
        
        Args:
            websocket: WebSocket connection
            room_id: Room to leave
            
        Returns:
            Username of disconnected user
        """
        username = None
        
        if room_id in self.active_connections:
            # Remove connection
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            
            # Get username and remove from room users
            username = self.user_mapping.get(websocket)
            if username and room_id in self.room_users:
                self.room_users[room_id].discard(username)
            
            # Clean up user mapping
            if websocket in self.user_mapping:
                del self.user_mapping[websocket]
            
            # Clean up empty rooms
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                if room_id in self.room_users:
                    del self.room_users[room_id]
                # Unsubscribe from Redis channel
                await pubsub_service.unsubscribe_from_room(room_id)
        
        return username
    
    async def broadcast_to_room(self, room_id: str, message: str):
        """
        Broadcast message to all local connections in a room
        (This server instance only)
        
        Args:
            room_id: Room to broadcast to
            message: Message to send
        """
        if room_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except:
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for conn in disconnected:
                await self.disconnect(conn, room_id)
    
    async def _handle_redis_message(self, room_id: str, message: dict):
        """
        Handle message received from Redis pub/sub
        Broadcasts to local WebSocket connections
        
        Args:
            room_id: Room the message is for
            message: Message data from Redis
        """
        message_json = json.dumps(message)
        await self.broadcast_to_room(room_id, message_json)
    
    async def _send_message_history(self, websocket: WebSocket, room_id: str):
        """
        Send recent message history to a newly connected user
        
        Args:
            websocket: WebSocket to send to
            room_id: Room to get history for
        """
        messages = await message_repository.get_room_messages(room_id, limit=50)
        
        for msg in messages:
            message_data = {
                "_id": msg.get("_id"),
                "type": msg.get("type", "message"),
                "room_id": room_id,
                "username": msg["username"],
                "content": msg["content"],
                "timestamp": msg["timestamp"].isoformat(),
                "reply_to": msg.get("reply_to"),
            }
            await websocket.send_text(json.dumps(message_data))


# Global connection manager instance
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, room_id: str, username: str):
    """
    WebSocket endpoint handler for chat
    """
    print(f"🔗 WebSocket connection attempt: room={room_id}, user={username}")
    
    try:
        await manager.connect(websocket, room_id, username)
        print(f"✅ Connected: {username} to room {room_id}")
        
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                print(f"📨 Received message from {username}: {data[:50]}...")
                
                message_data = json.loads(data)
                
                reply_to = message_data.get("reply_to")
                
                print(f"💾 Saving message to MongoDB: {username} in {room_id}")
                
                # Save message first and reuse persisted data in broadcast.
                saved_message = await message_repository.save_message(
                    room_id=room_id,
                    username=username,
                    content=message_data.get("content", ""),
                    message_type="message",
                    reply_to=reply_to,
                )

                message = {
                    "_id": saved_message.get("_id"),
                    "type": "message",
                    "room_id": room_id,
                    "username": username,
                    "content": saved_message.get("content", ""),
                    "timestamp": datetime.utcnow().isoformat(),
                    "reply_to": reply_to,
                }
                
                print(f"📤 Publishing to Redis: {username} in {room_id}")
                
                # Broadcast via Redis pub/sub
                result = await pubsub_service.publish_message(room_id, message)
                print(f"✅ Published: {result}")
                
        except WebSocketDisconnect as e:
            print(f"🔌 WebSocket disconnected: {username}")
            username = await manager.disconnect(websocket, room_id)
            
            # Check disconnect reason
            code = e.code if hasattr(e, 'code') else None
            
            # ONLY remove member and send message on EXPLICIT leave (code 1000)
            if username and code == 1000:
                # Remove member from room in database
                await room_repository.remove_member(room_id, username)
                print(f"👥 Removed {username} from room members (explicit leave)")
                
                # Create leave message
                leave_message = {
                    "type": "user_left",
                    "room_id": room_id,
                    "username": username,
                    "content": f"{username} left the room",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Save to database
                await message_repository.save_message(
                    room_id=room_id,
                    username=username,
                    content=leave_message["content"],
                    message_type="user_left"
                )
                
                # Broadcast via Redis
                await pubsub_service.publish_message(room_id, leave_message)
                print(f"👋 User left broadcast: {username}")
                
            else:
                # Logout, browser close, etc. - user STAYS in members list
                print(f"🚪 Silent disconnect (code={code}): {username}")
                print(f"   → User STAYS in room members (will rejoin on next login)")
                
        except Exception as e:
            print(f"❌ Error in WebSocket loop: {e}")
            import traceback
            traceback.print_exc()
            username = await manager.disconnect(websocket, room_id)
            
            # Don't remove from members on error - user stays in room
            if username:
                print(f"🔌 Error disconnect: {username} stays in room members")
            
    except Exception as e:
        print(f"❌ Failed to connect WebSocket: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.close(code=1011)
        except:
            pass
