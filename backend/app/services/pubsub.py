# Create or update services/pubsub.py
import json
import asyncio
from typing import Dict, Callable, Any
from redis.asyncio import Redis
from ..core.database import redis_cache

class PubSubService:
    """
    Redis Pub/Sub service for distributed messaging
    """
    
    def __init__(self):
        self.redis: Redis = None
        self.pubsub = None
        self.handlers: Dict[str, Callable] = {}
        self.listener_task = None
    
    async def initialize(self):
        """Initialize Redis connection"""
        self.redis = redis_cache.get_client()
        if not self.redis:
            raise ConnectionError("Redis client not available")
        
        # Create pubsub object
        self.pubsub = self.redis.pubsub()
        print("✅ PubSub service initialized")
    
    async def publish_message(self, room_id: str, message: dict) -> dict:
        """
        Publish message to Redis channel
        Returns: {"published": bool, "subscribers": int}
        """
        if not self.redis:
            await self.initialize()
        
        channel = f"chat:room:{room_id}"
        message_json = json.dumps(message)
        
        try:
            # Publish and get number of subscribers
            subscribers = await self.redis.publish(channel, message_json)
            
            print(f"📤 Published to {channel}: {subscribers} subscribers")
            print(f"   Message: {message.get('type')} from {message.get('username')}")
            
            # Also store in Redis for persistence (optional)
            history_key = f"chat:history:{room_id}"
            await self.redis.lpush(history_key, message_json)
            await self.redis.ltrim(history_key, 0, 99)  # Keep last 100 messages
            
            return {
                "published": True,
                "channel": channel,
                "subscribers": subscribers,
                "message_type": message.get("type")
            }
            
        except Exception as e:
            print(f"❌ Failed to publish to Redis: {e}")
            return {"published": False, "error": str(e)}
    
    async def subscribe_to_room(self, room_id: str, handler: Callable) -> dict:
        """
        Subscribe to Redis channel for a room
        Returns: {"subscribed": bool, "channel": str}
        """
        if not self.redis:
            await self.initialize()
        
        channel = f"chat:room:{room_id}"
        
        try:
            # Subscribe to the channel
            await self.pubsub.subscribe(channel)
            
            # Store the handler
            self.handlers[channel] = handler
            
            print(f"✅ Subscribed to channel: {channel}")
            print(f"   Active subscriptions: {len(self.handlers)}")
            
            # Start listener if not already running
            if not self.listener_task or self.listener_task.done():
                self.listener_task = asyncio.create_task(self._listen_messages())
                print("📡 Started Redis message listener")
            
            return {"subscribed": True, "channel": channel}
            
        except Exception as e:
            print(f"❌ Failed to subscribe to {channel}: {e}")
            return {"subscribed": False, "error": str(e)}
    
    async def unsubscribe_from_room(self, room_id: str) -> dict:
        """Unsubscribe from a room channel"""
        channel = f"chat:room:{room_id}"
        
        if channel in self.handlers:
            await self.pubsub.unsubscribe(channel)
            del self.handlers[channel]
            print(f"✅ Unsubscribed from channel: {channel}")
            return {"unsubscribed": True, "channel": channel}
        
        return {"unsubscribed": False, "error": "Not subscribed"}
    
    async def _listen_messages(self):
        """Listen for messages from subscribed channels"""
        print("👂 Starting to listen for Redis messages...")
        
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    channel = message["channel"]
                    data = json.loads(message["data"])
                    
                    print(f"📥 Received on {channel}: {data.get('type')} from {data.get('username')}")
                    
                    # Call the handler if it exists
                    if channel in self.handlers:
                        await self.handlers[channel](data)
                    else:
                        print(f"⚠️  No handler for channel: {channel}")
                        
        except asyncio.CancelledError:
            print("🛑 Redis listener task cancelled")
        except Exception as e:
            print(f"❌ Error in Redis listener: {e}")
    
    async def get_active_channels(self):
        """Get list of active pub/sub channels"""
        if not self.redis:
            return []
        
        channels = await self.redis.pubsub_channels()
        return [channel for channel in channels if channel.startswith("chat:room:")]
    
    async def get_subscriber_count(self, room_id: str):
        """Get number of subscribers for a room"""
        if not self.redis:
            return 0
        
        channel = f"chat:room:{room_id}"
        result = await self.redis.pubsub_numsub(channel)
        return result[0][1] if result else 0


# Create global instance
pubsub_service = PubSubService()