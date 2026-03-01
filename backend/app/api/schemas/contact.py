#this code file is added by thu for add contact request
from pydantic import BaseModel

class AddContactRequest(BaseModel):
    username: str

class RespondContactRequest(BaseModel):
    request_id: str
    action: str  # "accept" or "reject"
    request_type: str = "contact"  # "contact" or "room_join"
