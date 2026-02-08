from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.core.database import mongodb
from app.api.auth import get_current_user
from .schemas.contact import AddContactRequest, RespondContactRequest
from app.core.ws_manager import manager   # WebSocket manager

router = APIRouter()


# ============================
# Send contact request
# ============================
@router.post("/add")
async def add_contact(
    data: AddContactRequest,
    current_user=Depends(get_current_user)
):
    users_col = mongodb.get_collection("users")
    requests_col = mongodb.get_collection("contact_requests")
    notifications_col = mongodb.get_collection("notifications")

    # 1. Find target user
    target_user = await users_col.find_one({"username": data.username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Prevent adding yourself
    if data.username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # 3. Prevent duplicate request
    existing = await requests_col.find_one({
        "from_username": current_user.username,
        "to_username": data.username,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Request already sent")

    # 4. Save contact request
    await requests_col.insert_one({
        "from_username": current_user.username,
        "to_username": data.username,
        "status": "pending",
        "created_at": datetime.utcnow()
    })

    # 5. Save notification
    await notifications_col.insert_one({
        "username": data.username,
        "type": "contact_request",
        "message": f"{current_user.username} sent you a contact request",
        "read": False,
        "created_at": datetime.utcnow()
    })

    # 6. Real-time push (if online)
    await manager.send(
        data.username,
        {
            "type": "contact_request",
            "from_username": current_user.username
        }
    )

    return {"message": "Contact request sent"}


# ============================
# Get incoming requests
# ============================
@router.get("/requests")
async def get_requests(current_user=Depends(get_current_user)):
    requests_col = mongodb.get_collection("contact_requests")

    cursor = requests_col.find({
        "to_username": current_user.username,
        "status": "pending"
    })

    results = []
    async for req in cursor:
        results.append({
            "request_id": str(req["_id"]),
            "from_username": req["from_username"],
            "created_at": req["created_at"]
        })

    return results


# ============================
# Accept / Reject request
# ============================
@router.post("/respond")
async def respond_request(
    data: RespondContactRequest,
    current_user=Depends(get_current_user)
):
    requests_col = mongodb.get_collection("contact_requests")
    users_col = mongodb.get_collection("users")
    notifications_col = mongodb.get_collection("notifications")
    rooms_col = mongodb.get_collection("rooms")

    # 1. Find request
    request = await requests_col.find_one({
        "_id": ObjectId(data.request_id),
        "to_username": current_user.username
    })

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    sender = request["from_username"]

    # ========================
    # ACCEPT
    # ========================
    if data.action == "accept":
        # Add contacts
        await users_col.update_one(
            {"username": sender},
            {"$addToSet": {"contacts": current_user.username}}
        )
        await users_col.update_one(
            {"username": current_user.username},
            {"$addToSet": {"contacts": sender}}
        )

        # Create DM room
        #room = await rooms_col.insert_one({
           # "type": "dm",
           # "participants": [sender, current_user.username],
           # "created_at": datetime.utcnow()
       # })

        # Update request
        await requests_col.update_one(
            {"_id": request["_id"]},
            {"$set": {"status": "accepted"}}
        )

        # Notify sender
        await notifications_col.insert_one({
            "username": sender,
            "type": "contact_accepted",
            "message": f"{current_user.username} accepted your contact request",
            "read": False,
            "created_at": datetime.utcnow()
        })

        await manager.send(
            sender,
            {
                "type": "contact_accepted",
                "room_id": str(room.inserted_id),
                "by": current_user.username
            }
        )

        return {"message": "Contact accepted"}

    # ========================
    # REJECT
    # ========================
    elif data.action == "reject":
        await requests_col.update_one(
            {"_id": request["_id"]},
            {"$set": {"status": "rejected"}}
        )

        await notifications_col.insert_one({
            "username": sender,
            "type": "contact_rejected",
            "message": f"{current_user.username} rejected your contact request",
            "read": False,
            "created_at": datetime.utcnow()
        })

        await manager.send(
            sender,
            {
                "type": "contact_rejected",
                "by": current_user.username
            }
        )

        return {"message": "Contact rejected"}

    else:
        raise HTTPException(status_code=400, detail="Invalid action")
