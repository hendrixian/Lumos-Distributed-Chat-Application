"""
User repository - handles all user-related database operations
Provides clean abstraction over MongoDB user collection
"""
from typing import Optional, Dict
from ..core.database import mongodb


class UserRepository:
    """Repository for user data operations"""
    
    def __init__(self):
        self.collection_name = "users"
    
    @property
    def collection(self):
        """Get users collection"""
        return mongodb.get_collection(self.collection_name)
    
    async def create_user(self, username: str, hashed_password: str) -> Dict:
        """
        Create a new user in the database
        
        Args:
            username: Unique username
            hashed_password: Hashed password
            
        Returns:
            Created user document
        """
        user_doc = {
            "username": username,
            "hashed_password": hashed_password
        }
        await self.collection.insert_one(user_doc)
        return user_doc
    
    async def get_user_by_username(self, username: str) -> Optional[Dict]:
        """
        Find user by username
        
        Args:
            username: Username to search for
            
        Returns:
            User document or None if not found
        """
        return await self.collection.find_one({"username": username})
    
    async def user_exists(self, username: str) -> bool:
        """
        Check if user exists
        
        Args:
            username: Username to check
            
        Returns:
            True if user exists, False otherwise
        """
        count = await self.collection.count_documents({"username": username})
        return count > 0


# Global repository instance
user_repository = UserRepository()