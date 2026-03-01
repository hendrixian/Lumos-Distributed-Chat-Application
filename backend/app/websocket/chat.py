"""
WebSocket chat handler with distributed message broadcasting.
Uses Redis pub/sub to synchronize messages across multiple server instances.
Stores messages in MongoDB for persistence.
"""

from datetime import datetime
import json
from typing import Dict, List

from fastapi import WebSocket, WebSocketDisconnect

from ..repositories.message_repo import message_repository
from ..repositories.room_repo import room_repository
from ..services.pubsub import pubsub_service

EXPLICIT_LEAVE_REASONS = {"explicit_leave", "User left room"}


class ConnectionManager:
    """
    Manages WebSocket connections for chat rooms.
    Works with Redis pub/sub for distributed message broadcasting.
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
        Accept WebSocket connection and add to room.
        """
        print(f"[ws] connect attempt user={username} room={room_id}")

        try:
            await websocket.accept()
            print(f"[ws] accepted user={username}")

            # Initialize room data structures if needed
            if room_id not in self.active_connections:
                self.active_connections[room_id] = []
                self.room_users[room_id] = set()

                print(f"[ws] init room={room_id}")

                # Subscribe to Redis channel for this room
                result = await pubsub_service.subscribe_to_room(
                    room_id, lambda msg: self._handle_redis_message(room_id, msg)
                )
                print(f"[redis] subscribe room={room_id} result={result}")

            # Add connection to room
            self.active_connections[room_id].append(websocket)
            self.user_mapping[websocket] = username
            self.room_users[room_id].add(username)

            print(
                f"[ws] user={username} connected room={room_id} "
                f"connections={len(self.active_connections[room_id])}"
            )

            # History is loaded via HTTP pagination on the frontend.
            # Keep WebSocket stream realtime-only to prevent duplicate batches.

            # Add member to room in database
            added_member = await room_repository.add_member(room_id, username)
            if added_member:
                print(f"[db] add member user={username} room={room_id}")

                # Notify all users (across all servers) only for first-time join.
                join_message = {
                    "type": "user_joined",
                    "room_id": room_id,
                    "username": username,
                    "content": f"{username} joined the room",
                    "timestamp": datetime.utcnow().isoformat(),
                }

                print(f"[db] save join user={username} room={room_id}")

                # Save to database
                await message_repository.save_message(
                    room_id=room_id,
                    username=username,
                    content=join_message["content"],
                    message_type="user_joined",
                )

                print(f"[redis] publish join room={room_id} user={username}")

                # Broadcast via Redis (reaches all server instances)
                result = await pubsub_service.publish_message(room_id, join_message)
                print(f"[redis] join published room={room_id} result={result}")
            else:
                print(
                    f"[ws] existing member reconnected user={username} room={room_id}; "
                    "skip join message"
                )

        except Exception as exc:
            print(f"[ws] connect error room={room_id} user={username}: {exc}")
            import traceback

            traceback.print_exc()
            raise

    async def disconnect(self, websocket: WebSocket, room_id: str):
        """
        Remove WebSocket connection from room.

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
        (this server instance only).

        Args:
            room_id: Room to broadcast to
            message: Message to send
        """
        if room_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    disconnected.append(connection)

            # Clean up disconnected connections
            for conn in disconnected:
                await self.disconnect(conn, room_id)

    async def _handle_redis_message(self, room_id: str, message: dict):
        """
        Handle message received from Redis pub/sub.
        Broadcasts to local WebSocket connections.

        Args:
            room_id: Room the message is for
            message: Message data from Redis
        """
        message_json = json.dumps(message)
        await self.broadcast_to_room(room_id, message_json)

    async def _send_message_history(self, websocket: WebSocket, room_id: str):
        """
        Send recent message history to a newly connected user.

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

    def get_online_members(self, room_id: str) -> List[str]:
        """
        Return online users for a room known to this server instance.
        """
        return sorted(self.room_users.get(room_id, set()))


# Global connection manager instance
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, room_id: str, username: str):
    """
    WebSocket endpoint handler for chat.
    """
    print(f"[ws] endpoint connect user={username} room={room_id}")

    try:
        await manager.connect(websocket, room_id, username)
        print(f"[ws] connected user={username} room={room_id}")

        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                print(f"[ws] incoming user={username} room={room_id}")

                message_data = json.loads(data)
                reply_to = message_data.get("reply_to")

                print(f"[db] save message user={username} room={room_id}")

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

                print(f"[redis] publish message user={username} room={room_id}")

                # Broadcast via Redis pub/sub
                result = await pubsub_service.publish_message(room_id, message)
                print(f"[redis] message published room={room_id} result={result}")

        except WebSocketDisconnect as exc:
            print(f"[ws] disconnected user={username} room={room_id}")
            username = await manager.disconnect(websocket, room_id)

            code = exc.code if hasattr(exc, "code") else None
            reason = (exc.reason if hasattr(exc, "reason") else "") or ""
            is_explicit_leave = code == 1000 and reason in EXPLICIT_LEAVE_REASONS

            # Remove member and emit a leave event only for explicit leave action.
            if username and is_explicit_leave:
                await room_repository.remove_member(room_id, username)
                print(f"[db] removed member user={username} room={room_id}")

                leave_message = {
                    "type": "user_left",
                    "room_id": room_id,
                    "username": username,
                    "content": f"{username} left the room",
                    "timestamp": datetime.utcnow().isoformat(),
                }

                await message_repository.save_message(
                    room_id=room_id,
                    username=username,
                    content=leave_message["content"],
                    message_type="user_left",
                )

                await pubsub_service.publish_message(room_id, leave_message)
                print(f"[redis] leave published user={username} room={room_id}")
            else:
                print(
                    f"[ws] silent disconnect user={username} room={room_id} "
                    f"code={code} reason={reason or 'none'}"
                )

        except Exception as exc:
            print(f"[ws] loop error room={room_id} user={username}: {exc}")
            import traceback

            traceback.print_exc()
            username = await manager.disconnect(websocket, room_id)

            # Don't remove member on error; user stays in room membership.
            if username:
                print(f"[ws] error disconnect kept member user={username} room={room_id}")

    except Exception as exc:
        print(f"[ws] endpoint failure room={room_id} user={username}: {exc}")
        import traceback

        traceback.print_exc()
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
