from datetime import datetime
from typing import Any, Dict, List
import uuid

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.core.database import mongodb
from app.core.ws_manager import manager
from app.models.schemas import User
from .schemas.contact import AddContactRequest, RespondContactRequest

router = APIRouter()
MAX_REJECTIONS_PER_PAIR = 3


def _as_object_id(raw_id: str) -> ObjectId:
    try:
        return ObjectId(raw_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid request_id") from exc


def _participants_key(user_a: str, user_b: str) -> str:
    return "|".join(sorted([user_a, user_b]))


def _serialize_notification(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "notification_id": str(doc["_id"]),
        "type": doc["type"],
        "message": doc["message"],
        "read": doc.get("read", False),
        "from_username": doc.get("from_username"),
        "request_id": doc.get("request_id"),
        "room_id": doc.get("room_id"),
        "created_at": doc["created_at"],
    }


async def _create_notification(
    username: str,
    notification_type: str,
    message: str,
    from_username: str = "",
    request_id: str = "",
    room_id: str = "",
) -> None:
    notifications_col = mongodb.get_collection("notifications")
    await notifications_col.insert_one(
        {
            "username": username,
            "type": notification_type,
            "message": message,
            "from_username": from_username or None,
            "request_id": request_id or None,
            "room_id": room_id or None,
            "read": False,
            "created_at": datetime.utcnow(),
        }
    )


async def ensure_contact_indexes() -> None:
    requests_col = mongodb.get_collection("contact_requests")
    notifications_col = mongodb.get_collection("notifications")
    rooms_col = mongodb.get_collection("rooms")

    await requests_col.create_index(
        [("from_username", 1), ("to_username", 1), ("status", 1)]
    )
    await requests_col.create_index(
        [("from_username", 1), ("to_username", 1), ("responded_at", -1)]
    )
    await requests_col.create_index([("to_username", 1), ("status", 1), ("created_at", -1)])
    await notifications_col.create_index([("username", 1), ("created_at", -1)])
    await rooms_col.create_index([("type", 1), ("participants_key", 1)])


@router.post("/add")
async def add_contact(
    data: AddContactRequest,
    current_user: User = Depends(get_current_user),
):
    users_col = mongodb.get_collection("users")
    requests_col = mongodb.get_collection("contact_requests")

    target_username = data.username.strip()
    if not target_username:
        raise HTTPException(status_code=400, detail="Username is required")
    if target_username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    target_user = await users_col.find_one({"username": target_username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    sender_user = await users_col.find_one({"username": current_user.username}) or {}
    if target_username in (sender_user.get("contacts") or []):
        raise HTTPException(status_code=400, detail="User is already your contact")

    rejected_count = await requests_col.count_documents(
        {
            "from_username": current_user.username,
            "to_username": target_username,
            "status": "rejected",
        }
    )
    if rejected_count >= MAX_REJECTIONS_PER_PAIR:
        raise HTTPException(
            status_code=403,
            detail="You cannot send more requests to this user after 3 rejections",
        )

    existing_pending = await requests_col.find_one(
        {
            "status": "pending",
            "$or": [
                {
                    "from_username": current_user.username,
                    "to_username": target_username,
                },
                {
                    "from_username": target_username,
                    "to_username": current_user.username,
                },
            ],
        }
    )
    if existing_pending:
        raise HTTPException(status_code=400, detail="A pending request already exists")

    insert_result = await requests_col.insert_one(
        {
            "from_username": current_user.username,
            "to_username": target_username,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "responded_at": None,
        }
    )
    request_id = str(insert_result.inserted_id)

    await _create_notification(
        username=target_username,
        notification_type="contact_request",
        message=f"{current_user.username} sent you a contact request",
        from_username=current_user.username,
        request_id=request_id,
    )

    await manager.send(
        target_username,
        {
            "type": "contact_request",
            "from_username": current_user.username,
            "request_id": request_id,
        },
    )

    return {"message": "Contact request sent", "request_id": request_id}


@router.get("/requests")
async def get_requests(current_user: User = Depends(get_current_user)):
    requests_col = mongodb.get_collection("contact_requests")
    cursor = requests_col.find(
        {"to_username": current_user.username, "status": "pending"}
    ).sort("created_at", -1)

    results: List[Dict[str, Any]] = []
    async for req in cursor:
        results.append(
            {
                "request_id": str(req["_id"]),
                "from_username": req["from_username"],
                "created_at": req["created_at"],
            }
        )
    return results


@router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications_col = mongodb.get_collection("notifications")
    cursor = notifications_col.find({"username": current_user.username}).sort(
        "created_at", -1
    )

    notifications: List[Dict[str, Any]] = []
    async for item in cursor:
        notifications.append(_serialize_notification(item))
    return notifications


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
):
    notifications_col = mongodb.get_collection("notifications")
    result = await notifications_col.update_one(
        {
            "_id": _as_object_id(notification_id),
            "username": current_user.username,
        },
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@router.post("/respond")
async def respond_request(
    data: RespondContactRequest,
    current_user: User = Depends(get_current_user),
):
    requests_col = mongodb.get_collection("contact_requests")
    users_col = mongodb.get_collection("users")
    rooms_col = mongodb.get_collection("rooms")

    request = await requests_col.find_one(
        {
            "_id": _as_object_id(data.request_id),
            "to_username": current_user.username,
            "status": "pending",
        }
    )
    if not request:
        raise HTTPException(status_code=404, detail="Pending request not found")

    sender = request["from_username"]
    action = data.action.lower()

    if action == "accept":
        await users_col.update_one(
            {"username": sender},
            {"$addToSet": {"contacts": current_user.username}},
        )
        await users_col.update_one(
            {"username": current_user.username},
            {"$addToSet": {"contacts": sender}},
        )

        participants = sorted([sender, current_user.username])
        participants_key = _participants_key(sender, current_user.username)

        room_doc = await rooms_col.find_one(
            {"type": "dm", "participants_key": participants_key}
        )
        if not room_doc:
            room_id = str(uuid.uuid4())
            room_name = f"DM: {participants[0]} & {participants[1]}"
            room_doc = {
                "id": room_id,
                "name": room_name,
                "created_by": current_user.username,
                "created_at": datetime.utcnow(),
                "members": participants,
                "type": "dm",
                "participants": participants,
                "participants_key": participants_key,
            }
            await rooms_col.insert_one(room_doc)

        await requests_col.update_one(
            {"_id": request["_id"]},
            {
                "$set": {
                    "status": "accepted",
                    "responded_at": datetime.utcnow(),
                }
            },
        )

        await _create_notification(
            username=sender,
            notification_type="contact_accepted",
            message=f"{current_user.username} accepted your contact request",
            from_username=current_user.username,
            request_id=str(request["_id"]),
            room_id=room_doc["id"],
        )

        await manager.send(
            sender,
            {
                "type": "contact_accepted",
                "by": current_user.username,
                "to_username": current_user.username,
                "room_id": room_doc["id"],
                "request_id": str(request["_id"]),
            },
        )

        return {"message": "Contact accepted", "room_id": room_doc["id"]}

    if action == "reject":
        await requests_col.update_one(
            {"_id": request["_id"]},
            {
                "$set": {
                    "status": "rejected",
                    "responded_at": datetime.utcnow(),
                }
            },
        )

        await _create_notification(
            username=sender,
            notification_type="contact_rejected",
            message=f"{current_user.username} rejected your contact request",
            from_username=current_user.username,
            request_id=str(request["_id"]),
        )

        await manager.send(
            sender,
            {
                "type": "contact_rejected",
                "by": current_user.username,
                "to_username": current_user.username,
                "request_id": str(request["_id"]),
            },
        )

        return {"message": "Contact rejected"}

    raise HTTPException(status_code=400, detail="Invalid action")
