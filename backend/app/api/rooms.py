"""
Room management API endpoints
Handles creation, retrieval, and deletion of chat rooms
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List
import uuid
from ..models.schemas import Room, RoomCreate, RoomMemberAdd, User
from ..repositories.room_repo import room_repository
from ..repositories.message_repo import message_repository
from ..core.database import mongodb
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
        description=room.description or "",
        created_by=current_user.username
    )
    
    return Room(
        id=room_doc["id"],
        name=room_doc["name"],
        description=room_doc.get("description", ""),
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

        # DM rooms are visible only to their two participants.
        if room_type == "dm" and current_user.username not in participants:
            continue

        visible_rooms.append(
            Room(
                id=room["id"],
                name=room["name"],
                description=room.get("description", ""),
                created_at=room["created_at"],
                created_by=room["created_by"],
                type=room_type,
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
        description=room.get("description", ""),
        created_at=room["created_at"],
        created_by=room["created_by"],
        type=room.get("type", "group"),
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


@router.post("/{room_id}/members")
async def add_room_member(
    room_id: str,
    payload: RoomMemberAdd,
    current_user: User = Depends(get_current_user),
):
    """
    Add a member to a room (only room creator can add members).
    """
    room = await room_repository.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room["created_by"] != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can add members",
        )

    username = payload.username.strip()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )

    users_collection = mongodb.get_collection("users")
    user_doc = await users_collection.find_one({"username": username})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await room_repository.add_member(room_id, username)
    updated_members = await room_repository.get_room_members(room_id)

    return {
        "room_id": room_id,
        "added_username": username,
        "members": updated_members,
    }


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


@router.get("/{room_id}/messages")
async def get_room_messages(
    room_id: str,
    limit: int = Query(50, ge=1, le=100),
    before: str | None = None,
    current_user: User = Depends(get_current_user),
):
    """
    Get paginated room messages (oldest -> newest).

    Args:
        room_id: Room identifier
        limit: Maximum number of messages to return
        before: Optional Mongo ObjectId cursor to fetch older messages
        current_user: Current authenticated user
    """
    room = await room_repository.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room.get("type") == "dm" and current_user.username not in room.get("participants", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this DM room",
        )

    try:
        messages = await message_repository.get_room_messages(
            room_id=room_id,
            limit=limit,
            before=before,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pagination cursor",
        )

    return [
        {
            "_id": msg.get("_id"),
            "room_id": msg.get("room_id"),
            "username": msg.get("username"),
            "content": msg.get("content"),
            "type": msg.get("type", "message"),
            "timestamp": msg.get("timestamp").isoformat() if msg.get("timestamp") else None,
            "reply_to": msg.get("reply_to"),
        }
        for msg in messages
    ]
