"""
Redis Pub/Sub service for distributed message broadcasting
Enables multiple server instances to communicate with each other
"""
import json
import asyncio
from typing import Callable, Dict
from ..core.database import redis_cache


class PubSubService:
    """
    Handles Redis pub/sub for distributed message broadcasting
    Each server instance subscribes to room channels and publishes messages
    """
    
    def __init__(self):
        self.subscribers: Dict[str, asyncio.Task] = {}
        self.callbacks: Dict[str, Callable] = {}
    
    def _get_channel_name(self, room_id: str) -> str:
        """
        Generate Redis channel name for a room
        
        Args:
            room_id: Room identifier
            
        Returns:
            Channel name string
        """
        return f"chat:room:{room_id}"
    
    async def publish_message(self, room_id: str, message: dict):
        """
        Publish a message to a room channel
        All server instances subscribed to this channel will receive it
        
        Args:
            room_id: Room to publish to
            message: Message data to broadcast
        """
        redis = redis_cache.get_client()
        channel = self._get_channel_name(room_id)
        message_json = json.dumps(message)
        await redis.publish(channel, message_json)
    
    async def subscribe_to_room(self, room_id: str, callback: Callable):
        """
        Subscribe to a room's message channel
        
        Args:
            room_id: Room to subscribe to
            callback: Function to call when message received
        """
        channel = self._get_channel_name(room_id)
        
        # Store callback for this channel
        self.callbacks[channel] = callback
        
        # Start subscriber task if not already running
        if channel not in self.subscribers:
            task = asyncio.create_task(self._subscriber_task(channel))
            self.subscribers[channel] = task
    
    async def unsubscribe_from_room(self, room_id: str):
        """
        Unsubscribe from a room's message channel
        
        Args:
            room_id: Room to unsubscribe from
        """
        channel = self._get_channel_name(room_id)
        
        # Cancel subscriber task
        if channel in self.subscribers:
            self.subscribers[channel].cancel()
            del self.subscribers[channel]
        
        # Remove callback
        if channel in self.callbacks:
            del self.callbacks[channel]
    
    async def _subscriber_task(self, channel: str):
        """
        Background task that listens for messages on a channel
        
        Args:
            channel: Redis channel to listen to
        """
        redis = redis_cache.get_client()
        pubsub = redis.pubsub()
        
        try:
            await pubsub.subscribe(channel)
            print(f"✓ Subscribed to Redis channel: {channel}")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    # Parse message data
                    data = json.loads(message["data"])
                    
                    # Call the registered callback
                    if channel in self.callbacks:
                        await self.callbacks[channel](data)
        
        except asyncio.CancelledError:
            print(f"✓ Unsubscribed from Redis channel: {channel}")
        
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()


# Global pub/sub service instance
pubsub_service = PubSubService()