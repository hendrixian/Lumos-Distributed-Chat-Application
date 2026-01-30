"""
Room management API endpoints
Handles creation, retrieval, and deletion of chat rooms
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
import uuid
from ..models.schemas import Room, RoomCreate, User
from ..repositories.room_repo import room_repository
from ..repositories.message_repo import message_repository
from .auth import get_current_user

router = APIRouter()


@router.post("/", response_model=Room)
async def create_room(room: RoomCreate, current_user: User = Depends(get_current_user)):
    """
    Create a new chat room
    
    Args:
        room: Room creation data
        current_user: Current authenticated user
        
    Returns:
        Created room
    """
    room_id = str(uuid.uuid4())
    room_doc = await room_repository.create_room(
        room_id=room_id,
        name=room.name,
        created_by=current_user.username
    )
    
    return Room(
        id=room_doc["id"],
        name=room_doc["name"],
        created_at=room_doc["created_at"],
        created_by=room_doc["created_by"]
    )


@router.get("/", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    """
    Get all available chat rooms
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List of all rooms
    """
    rooms = await room_repository.get_all_rooms()
    
    return [
        Room(
            id=room["id"],
            name=room["name"],
            created_at=room["created_at"],
            created_by=room["created_by"]
        )
        for room in rooms
    ]


@router.get("/{room_id}", response_model=Room)
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Get a specific room by ID
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        Room data
        
    Raises:
        HTTPException: If room not found
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    return Room(
        id=room["id"],
        name=room["name"],
        created_at=room["created_at"],
        created_by=room["created_by"]
    )


@router.delete("/{room_id}")
async def delete_room(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Delete a chat room (only creator can delete)
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If room not found or user not authorized
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    if room["created_by"] != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can delete the room"
        )
    
    # Delete room and all its messages
    await room_repository.delete_room(room_id)
    await message_repository.delete_room_messages(room_id)
    
    return {"message": "Room deleted successfully"}