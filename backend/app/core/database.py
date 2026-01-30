"""
Database connection manager for MongoDB and Redis
Handles connection lifecycle and provides database instances
"""
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis
from typing import Optional
from .config import settings

class Database:
    """Singleton database manager for MongoDB"""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
    
    async def connect(self):
        """Establish MongoDB connection"""
        self.client = AsyncIOMotorClient(settings.mongodb_url)
        self.db = self.client[settings.mongodb_db_name]
        print(f"✓ Connected to MongoDB: {settings.mongodb_db_name}")
    
    async def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            print("✓ Disconnected from MongoDB")
    
    def get_collection(self, name: str):
        """Get a MongoDB collection"""
        return self.db[name]


class RedisCache:
    """Singleton Redis cache manager"""
    
    def __init__(self):
        self.redis: Optional[Redis] = None
    
    async def connect(self):
        """Establish Redis connection"""
        self.redis = Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password,
            db=settings.redis_db,
            decode_responses=True
        )
        await self.redis.ping()
        print(f"✓ Connected to Redis: {settings.redis_host}:{settings.redis_port}")
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            print("✓ Disconnected from Redis")
    
    def get_client(self) -> Redis:
        """Get Redis client instance"""
        return self.redis


# Global instances
mongodb = Database()
redis_cache = RedisCache()