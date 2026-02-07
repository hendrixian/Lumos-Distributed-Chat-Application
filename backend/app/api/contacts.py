from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from app.core.database import mongodb
from app.api.auth import get_current_user
from .schemas.contact import AddContactRequest, RespondContactRequest

router = APIRouter()

@router.post("/add")
async def add_contact(
    data: AddContactRequest,
    current_user=Depends(get_current_user)  # Pydantic User model
):
    #users_col = mongodb.db.users
    #requests_col = mongodb.db.contact_requests
    users_col = mongodb.get_collection("users")
    requests_col = mongodb.get_collection("contact_requests")


    # 1. Find target user
    target_user = await users_col.find_one({"username": data.username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Prevent adding yourself
    if target_user["username"] == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # 3. Check existing request
    existing = await requests_col.find_one({
        "from_username": current_user.username,
        "to_username": target_user["username"],
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Request already sent")

    # 4. Create request
    await requests_col.insert_one({
        "from_username": current_user.username,
        "to_username": target_user["username"],
        "status": "pending",
        "created_at": datetime.utcnow()
    })

    return {"message": "Contact request sent"}


@router.get("/requests")
async def get_requests(current_user=Depends(get_current_user)):
    requests_col = mongodb.db.contact_requests
    users_col = mongodb.db.users

    cursor = requests_col.find({
        "to_username": current_user.username,
        "status": "pending"
    })

    results = []
    async for req in cursor:
        sender = await users_col.find_one({"username": req["from_username"]})
        results.append({
            "request_id": str(req["_id"]),
            "from_username": sender["username"],
            "created_at": req["created_at"]
        })

    return results


@router.post("/respond")
async def respond_request(
    data: RespondContactRequest,
    current_user=Depends(get_current_user)
):
    requests_col = mongodb.db.contact_requests
    users_col = mongodb.db.users

    request = await requests_col.find_one({
        "_id": ObjectId(data.request_id),
        "to_username": current_user.username
    })

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if data.action == "accept":
        # Add each other as contacts
        await users_col.update_one(
            {"username": request["from_username"]},
            {"$addToSet": {"contacts": current_user.username}}
        )
        await users_col.update_one(
            {"username": current_user.username},
            {"$addToSet": {"contacts": request["from_username"]}}
        )

        await requests_col.update_one(
            {"_id": request["_id"]},
            {"$set": {"status": "accepted"}}
        )

        return {"message": "Contact accepted"}

    elif data.action == "reject":
        await requests_col.update_one(
            {"_id": request["_id"]},
            {"$set": {"status": "rejected"}}
        )
        return {"message": "Contact rejected"}

    else:
        raise HTTPException(status_code=400, detail="Invalid action")
