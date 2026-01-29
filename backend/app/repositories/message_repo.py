"""
Message repository - handles message storage in MongoDB
Stores chat history for persistence across sessions
"""
from typing import List, Dict
from datetime import datetime
from ..core.database import mongodb


class MessageRepository:
    """Repository for message data operations"""
    
    def __init__(self):
        self.collection_name = "messages"
    
    @property
    def collection(self):
        """Get messages collection"""
        return mongodb.get_collection(self.collection_name)
    
    async def save_message(self, room_id: str, username: str, content: str, 
                          message_type: str = "message") -> Dict:
        """
        Save a message to the database
        
        Args:
            room_id: Room where message was sent
            username: User who sent the message
            content: Message content
            message_type: Type of message (message, user_joined, user_left)
            
        Returns:
            Saved message document
        """
        message_doc = {
            "room_id": room_id,
            "username": username,
            "content": content,
            "type": message_type,
            "timestamp": datetime.utcnow()
        }
        await self.collection.insert_one(message_doc)
        return message_doc
    
    async def get_room_messages(self, room_id: str, limit: int = 100) -> List[Dict]:
        """
        Get recent messages for a room
        
        Args:
            room_id: Room ID
            limit: Maximum number of messages to retrieve
            
        Returns:
            List of message documents
        """
        cursor = self.collection.find(
            {"room_id": room_id}
        ).sort("timestamp", -1).limit(limit)
        
        messages = await cursor.to_list(length=limit)
        # Reverse to show oldest first
        return list(reversed(messages))
    
    async def delete_room_messages(self, room_id: str) -> int:
        """
        Delete all messages in a room
        
        Args:
            room_id: Room ID
            
        Returns:
            Number of messages deleted
        """
        result = await self.collection.delete_many({"room_id": room_id})
        return result.deleted_count


# Global repository instance
message_repository = MessageRepository()