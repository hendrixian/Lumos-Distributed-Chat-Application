"""
Room repository - handles all room-related database operations
Provides clean abstraction over MongoDB room collection
"""
from typing import Optional, Dict, List, List
from datetime import datetime
from ..core.database import mongodb


class RoomRepository:
    """Repository for room data operations"""
    
    def __init__(self):
        self.collection_name = "rooms"
    
    @property
    def collection(self):
        """Get rooms collection"""
        return mongodb.get_collection(self.collection_name)
    
    async def create_room(
        self,
        room_id: str,
        name: str,
        created_by: str,
        description: str = "",
    ) -> Dict:
        """
        Create a new chat room
        
        Args:
            room_id: Unique room identifier
            name: Room name
            created_by: Username of creator
            
        Returns:
            Created room document
        """
        room_doc = {
            "id": room_id,
            "name": name,
            "description": description or "",
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "members": []  # Initialize with empty members list
        }
        await self.collection.insert_one(room_doc)
        return room_doc
    
    async def get_room_by_id(self, room_id: str) -> Optional[Dict]:
        """
        Find room by ID
        
        Args:
            room_id: Room ID to search for
            
        Returns:
            Room document or None if not found
        """
        return await self.collection.find_one({"id": room_id})
    
    async def get_all_rooms(self) -> List[Dict]:
        """
        Get all rooms
        
        Returns:
            List of all room documents
        """
        cursor = self.collection.find({})
        rooms = await cursor.to_list(length=None)
        return rooms
    
    async def delete_room(self, room_id: str) -> bool:
        """
        Delete a room
        
        Args:
            room_id: Room ID to delete
            
        Returns:
            True if deleted, False otherwise
        """
        result = await self.collection.delete_one({"id": room_id})
        return result.deleted_count > 0
    
    async def add_member(self, room_id: str, username: str) -> bool:
        """
        Add a member to a room
        
        Args:
            room_id: Room ID
            username: Username to add
            
        Returns:
            True if added, False otherwise
        """
        result = await self.collection.update_one(
            {"id": room_id},
            {"$addToSet": {"members": username}}  # $addToSet prevents duplicates
        )
        return result.modified_count > 0 or result.matched_count > 0
    
    async def remove_member(self, room_id: str, username: str) -> bool:
        """
        Remove a member from a room
        
        Args:
            room_id: Room ID
            username: Username to remove
            
        Returns:
            True if removed, False otherwise
        """
        result = await self.collection.update_one(
            {"id": room_id},
            {"$pull": {"members": username}}
        )
        return result.modified_count > 0
    
    async def get_room_members(self, room_id: str) -> List[str]:
        """
        Get list of members in a room
        
        Args:
            room_id: Room ID
            
        Returns:
            List of usernames
        """
        room = await self.get_room_by_id(room_id)
        return room.get("members", []) if room else []


# Global repository instance
room_repository = RoomRepository()
