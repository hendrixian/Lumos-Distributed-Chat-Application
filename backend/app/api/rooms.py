"""
Room management API endpoints
Handles creation, retrieval, and deletion of chat rooms
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
import uuid
from datetime import datetime
from ..models.schemas import Room, RoomCreate, User, RoomDetail
from ..repositories.room_repo import room_repository
from ..repositories.message_repo import message_repository
from ..services.pubsub import pubsub_service
from .auth import get_current_user

router = APIRouter()


@router.post("/", response_model=Room, status_code=status.HTTP_201_CREATED)
async def create_room(room: RoomCreate, current_user: User = Depends(get_current_user)):
    """
    Create a new chat room
    
    Args:
        room: Room creation data
        current_user: Current authenticated user
        
    Returns:
        Created room with details
    """
    # Validate room name
    if not room.name or len(room.name.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room name cannot be empty"
        )
    
    if len(room.name) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Room name cannot exceed 50 characters"
        )
    
    # Check if room with same name exists (optional)
    existing_room = await room_repository.get_room_by_name(room.name.strip())
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Room with name '{room.name}' already exists"
        )
    
    # Create room with UUID
    room_id = str(uuid.uuid4())
    room_doc = await room_repository.create_room(
        room_id=room_id,
        name=room.name.strip(),
        created_by=current_user.username
    )
    
    # Log room creation
    print(f"✅ Room created: {room.name} (ID: {room_id}) by {current_user.username}")
    
    return Room(
        id=room_doc["id"],
        name=room_doc["name"],
        created_at=room_doc["created_at"],
        created_by=room_doc["created_by"]
    )


@router.get("/", response_model=List[Room])
async def get_rooms(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all available chat rooms with pagination
    
    Args:
        current_user: Current authenticated user
        skip: Number of rooms to skip
        limit: Maximum number of rooms to return
        
    Returns:
        List of rooms
    """
    rooms = await room_repository.get_all_rooms(skip=skip, limit=limit)
    
    return [
        Room(
            id=room["id"],
            name=room["name"],
            created_at=room["created_at"],
            created_by=room["created_by"]
        )
        for room in rooms
    ]


@router.get("/{room_id}", response_model=RoomDetail)
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Get detailed information about a specific room
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        Detailed room data with member count and recent activity
        
    Raises:
        HTTPException: If room not found
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Get additional room info
    message_count = await message_repository.count_room_messages(room_id)
    recent_messages = await message_repository.get_room_messages(room_id, limit=5)
    
    return RoomDetail(
        id=room["id"],
        name=room["name"],
        created_at=room["created_at"],
        created_by=room["created_by"],
        message_count=message_count,
        last_activity=recent_messages[-1]["timestamp"] if recent_messages else room["created_at"]
    )


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Delete a chat room (only creator can delete)
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        No content on success
        
    Raises:
        HTTPException: If room not found or user not authorized
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if user is creator
    if room["created_by"] != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the room creator can delete this room"
        )
    
    # Get message count for logging
    message_count = await message_repository.count_room_messages(room_id)
    
    # Delete room and all its messages
    await room_repository.delete_room(room_id)
    deleted_count = await message_repository.delete_room_messages(room_id)
    
    # Notify via Redis that room was deleted
    await pubsub_service.publish_message(
        "system",
        {
            "type": "room_deleted",
            "room_id": room_id,
            "room_name": room["name"],
            "deleted_by": current_user.username,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    
    # Log deletion
    print(f"🗑️ Room deleted: {room['name']} (ID: {room_id}) by {current_user.username}")
    print(f"   Deleted {deleted_count} messages")
    
    # Return no content (204)
    return None
