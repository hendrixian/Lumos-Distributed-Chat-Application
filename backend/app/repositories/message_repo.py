from typing import List, Dict, Optional
from datetime import datetime, timezone
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
        reply_to: Optional[str] = None,
        client_message_id: Optional[str] = None,
    ) -> Dict:
        """Save a new message to the database"""

        timestamp = datetime.now(timezone.utc)
        message_doc = {
            "room_id": room_id,
            "username": username,
            "content": content,
            "type": message_type,
            "timestamp": timestamp,
        }

        if reply_to:
            message_doc["reply_to"] = reply_to
        if client_message_id:
            message_doc["client_message_id"] = client_message_id

        # Message delivery lifecycle fields for UI indicators.
        if message_type == "message":
            message_doc["delivery_status"] = "delivered"
            message_doc["read_by"] = []

        result = await self.collection.insert_one(message_doc)

        # Attach string _id for frontend use
        message_doc["_id"] = str(result.inserted_id)

        return message_doc

    async def mark_messages_read(
        self,
        room_id: str,
        reader_username: str,
        message_ids: List[str],
    ) -> List[str]:
        """
        Mark messages as read by a user and return affected message IDs.
        """
        if not message_ids:
            return []

        object_ids: List[ObjectId] = []
        for raw_id in message_ids:
            try:
                object_ids.append(ObjectId(raw_id))
            except Exception:
                continue

        if not object_ids:
            return []

        query = {
            "room_id": room_id,
            "_id": {"$in": object_ids},
            "type": "message",
            "username": {"$ne": reader_username},
        }

        matched_docs = await self.collection.find(query, {"_id": 1}).to_list(length=len(object_ids))
        if not matched_docs:
            return []

        matched_ids = [doc["_id"] for doc in matched_docs]
        await self.collection.update_many(
            {"_id": {"$in": matched_ids}},
            {"$addToSet": {"read_by": reader_username}},
        )

        return [str(message_id) for message_id in matched_ids]

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
