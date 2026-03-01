from typing import List, Dict, Optional
from datetime import datetime
from bson import ObjectId
from ..core.database import mongodb


class MessageRepository:
    """Repository for message data operations"""

    def __init__(self):
        self.collection_name = "messages"

    @property
    def collection(self):
        """Get messages collection"""
        return mongodb.get_collection(self.collection_name)

    # ==========================================
    # SAVE MESSAGE
    # ==========================================
    async def save_message(
        self,
        room_id: str,
        username: str,
        content: str,
        message_type: str = "message",
        reply_to: Optional[str] = None
    ) -> Dict:
        """Save a new message to the database"""

        message_doc = {
            "room_id": room_id,
            "username": username,
            "content": content,
            "type": message_type,
            "timestamp": datetime.utcnow(),
        }

        if reply_to:
            message_doc["reply_to"] = reply_to

        result = await self.collection.insert_one(message_doc)

        # Attach string _id for frontend use
        message_doc["_id"] = str(result.inserted_id)

        return message_doc

    # ==========================================
    # GET ROOM MESSAGES (LAZY LOAD SUPPORT)
    # ==========================================
    async def get_room_messages(
        self,
        room_id: str,
        limit: int = 50,
        before: Optional[str] = None
    ) -> List[Dict]:
        """
        Get paginated room messages using MongoDB _id pagination.

        Args:
            room_id: Room ID
            limit: Max messages to return
            before: Load messages older than this ObjectId

        Returns:
            List of message documents (oldest first)
        """

        query = {"room_id": room_id}

        # If loading older messages
        if before:
            query["_id"] = {"$lt": ObjectId(before)}

        # Sort newest first for efficient pagination
        cursor = (
            self.collection
            .find(query)
            .sort("_id", -1)
            .limit(limit)
        )

        messages = await cursor.to_list(length=limit)

        # Reverse so frontend gets oldest → newest
        messages.reverse()

        # Convert ObjectId to string
        for m in messages:
            m["_id"] = str(m["_id"])

        return messages

    # ==========================================
    # DELETE ROOM MESSAGES
    # ==========================================
    async def delete_room_messages(self, room_id: str) -> int:
        """Delete all messages in a room"""
        result = await self.collection.delete_many({"room_id": room_id})
        return result.deleted_count


# Global repository instance
message_repository = MessageRepository()
