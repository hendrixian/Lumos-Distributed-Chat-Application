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
        created_by=room_doc["created_by"],
        members=room_doc.get("members", [])
    )


@router.get("/", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    """
    Get all available chat rooms
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List of all rooms with member counts
    """
    rooms = await room_repository.get_all_rooms()

    visible_rooms = []
    for room in rooms:
        room_type = room.get("type", "group")
        participants = room.get("participants", [])

        # DM rooms are private to their participants.
        if room_type == "dm" and current_user.username not in participants:
            continue

        visible_rooms.append(
            Room(
                id=room["id"],
                name=room["name"],
                created_at=room["created_at"],
                created_by=room["created_by"],
                members=room.get("members", []),
            )
        )

    return visible_rooms


@router.get("/{room_id}", response_model=Room)
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Get a specific room by ID
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        Room data with current members
        
    Raises:
        HTTPException: If room not found
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if room.get("type") == "dm" and current_user.username not in room.get("participants", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this DM room",
        )
    
    return Room(
        id=room["id"],
        name=room["name"],
        created_at=room["created_at"],
        created_by=room["created_by"],
        members=room.get("members", [])
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

    if room.get("type") == "dm":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="DM rooms cannot be deleted from this endpoint",
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


@router.get("/{room_id}/members", response_model=List[str])
async def get_room_members(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Get list of members currently in a room
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        List of usernames of members in the room
        
    Raises:
        HTTPException: If room not found
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if room.get("type") == "dm" and current_user.username not in room.get("participants", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this DM room",
        )
    
    return room.get("members", [])


@router.get("/{room_id}/members/count")
async def get_room_member_count(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Get count of members currently in a room
    
    Args:
        room_id: Room identifier
        current_user: Current authenticated user
        
    Returns:
        Dictionary with member count and list of members
        
    Raises:
        HTTPException: If room not found
    """
    room = await room_repository.get_room_by_id(room_id)
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    if room.get("type") == "dm" and current_user.username not in room.get("participants", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this DM room",
        )
    
    members = room.get("members", [])
    
    return {
        "room_id": room_id,
        "room_name": room["name"],
        "member_count": len(members),
        "members": members
    }
