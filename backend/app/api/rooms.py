"""
Room management API endpoints
Handles creation, retrieval, and deletion of chat rooms
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends, Query, File, Form, UploadFile
from typing import List
import uuid
from ..models.schemas import Room, RoomCreate, RoomMemberAdd, User
from ..repositories.room_repo import room_repository
from ..repositories.message_repo import message_repository
from ..core.database import mongodb
from ..core.ws_manager import manager as notification_manager
from ..core.image_utils import image_file_to_data_url
from ..websocket.chat import manager as chat_manager
from .auth import get_current_user

router = APIRouter()


def _normalize_visibility(raw_visibility: str | None) -> str:
    visibility = (raw_visibility or "public").strip().lower()
    if visibility not in {"public", "private"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="visibility must be either 'public' or 'private'",
        )
    return visibility


def _ensure_room_access(room: dict, username: str) -> None:
    room_type = room.get("type", "group")
    if room_type == "dm":
        if username not in room.get("participants", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this DM room",
            )
        return

    if username not in room.get("members", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must join this room first",
        )


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
    visibility = _normalize_visibility(room.visibility)
    room_doc = await room_repository.create_room(
        room_id=room_id,
        name=room.name,
        description=room.description or "",
        created_by=current_user.username,
        visibility=visibility,
    )
    
    return Room(
        id=room_doc["id"],
        name=room_doc["name"],
        description=room_doc.get("description", ""),
        visibility=room_doc.get("visibility", "public"),
        avatar_url=room_doc.get("avatar_url", ""),
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
                visibility=room.get("visibility", "public"),
                avatar_url=room.get("avatar_url", ""),
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

    _ensure_room_access(room, current_user.username)
    
    return Room(
        id=room["id"],
        name=room["name"],
        description=room.get("description", ""),
        visibility=room.get("visibility", "public"),
        avatar_url=room.get("avatar_url", ""),
        created_at=room["created_at"],
        created_by=room["created_by"],
        type=room.get("type", "group"),
        members=room.get("members", [])
    )


@router.patch("/{room_id}", response_model=Room)
async def update_room(
    room_id: str,
    description: str | None = Form(default=None),
    visibility: str | None = Form(default=None),
    avatar: UploadFile | None = File(default=None),
    remove_avatar: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
):
    """
    Update group room metadata (creator/admin only).
    """
    room = await room_repository.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room.get("type") == "dm":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="DM rooms cannot be updated from this endpoint",
        )

    if room["created_by"] != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can update room details",
        )

    update_fields = {"updated_at": datetime.utcnow()}
    if description is not None:
        update_fields["description"] = description.strip()
    if visibility is not None:
        update_fields["visibility"] = _normalize_visibility(visibility)
    if remove_avatar:
        update_fields["avatar_url"] = ""
    if avatar is not None:
        update_fields["avatar_url"] = await image_file_to_data_url(avatar)

    rooms_collection = mongodb.get_collection("rooms")
    await rooms_collection.update_one(
        {"id": room_id},
        {"$set": update_fields},
    )
    updated_room = await room_repository.get_room_by_id(room_id)

    return Room(
        id=updated_room["id"],
        name=updated_room["name"],
        description=updated_room.get("description", ""),
        visibility=updated_room.get("visibility", "public"),
        avatar_url=updated_room.get("avatar_url", ""),
        created_at=updated_room["created_at"],
        created_by=updated_room["created_by"],
        type=updated_room.get("type", "group"),
        members=updated_room.get("members", []),
    )


@router.post("/{room_id}/join")
async def join_public_room(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Join a public group room directly.
    """
    room = await room_repository.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room.get("type") == "dm":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot join DM rooms from this endpoint",
        )

    if room.get("visibility", "public") != "public":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This room is private. Send a join request instead.",
        )

    await room_repository.add_member(room_id, current_user.username)
    updated_room = await room_repository.get_room_by_id(room_id)
    if not updated_room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    return {
        "message": "Joined room successfully",
        "room": Room(
            id=updated_room["id"],
            name=updated_room["name"],
            description=updated_room.get("description", ""),
            visibility=updated_room.get("visibility", "public"),
            avatar_url=updated_room.get("avatar_url", ""),
            created_at=updated_room["created_at"],
            created_by=updated_room["created_by"],
            type=updated_room.get("type", "group"),
            members=updated_room.get("members", []),
        ),
    }


@router.post("/{room_id}/join-request")
async def request_join_private_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Send a join request for a private group room.
    """
    room = await room_repository.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room.get("type") == "dm":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot request to join DM rooms",
        )

    if room.get("visibility", "public") != "private":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This room is public. Use join room instead.",
        )

    if current_user.username in room.get("members", []):
        return {"message": "You are already a room member"}

    admin_username = room.get("created_by")
    if current_user.username == admin_username:
        return {"message": "You are already the room admin"}

    requests_col = mongodb.get_collection("room_join_requests")

    existing_pending = await requests_col.find_one(
        {
            "type": "room_join",
            "room_id": room_id,
            "from_username": current_user.username,
            "status": "pending",
        }
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pending join request already exists for this room",
        )

    insert_result = await requests_col.insert_one(
        {
            "type": "room_join",
            "room_id": room_id,
            "room_name": room.get("name", ""),
            "from_username": current_user.username,
            "to_username": admin_username,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "responded_at": None,
        }
    )
    request_id = str(insert_result.inserted_id)

    notifications_col = mongodb.get_collection("notifications")
    await notifications_col.insert_one(
        {
            "username": admin_username,
            "type": "room_join_request",
            "message": (
                f"{current_user.username} requested to join room "
                f"'{room.get('name', 'Unknown Room')}'"
            ),
            "from_username": current_user.username,
            "request_id": request_id,
            "room_id": room_id,
            "read": False,
            "created_at": datetime.utcnow(),
        }
    )

    await notification_manager.send(
        admin_username,
        {
            "type": "room_join_request",
            "from_username": current_user.username,
            "request_id": request_id,
            "room_id": room_id,
            "room_name": room.get("name", ""),
        },
    )

    return {"message": "Join request sent", "request_id": request_id}


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

    _ensure_room_access(room, current_user.username)
    
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

    _ensure_room_access(room, current_user.username)
    
    members = room.get("members", [])
    
    return {
        "room_id": room_id,
        "room_name": room["name"],
        "member_count": len(members),
        "members": members
    }


@router.get("/{room_id}/presence")
async def get_room_presence(room_id: str, current_user: User = Depends(get_current_user)):
    """
    Get current online members for a room.
    """
    room = await room_repository.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    _ensure_room_access(room, current_user.username)

    room_members = set(room.get("members", []))
    online_members = [
        username
        for username in chat_manager.get_online_members(room_id)
        if username in room_members
    ]

    return {
        "room_id": room_id,
        "online_count": len(online_members),
        "online_members": online_members,
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

    _ensure_room_access(room, current_user.username)

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
