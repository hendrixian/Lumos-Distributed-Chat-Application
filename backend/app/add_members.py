"""
Migration script to add 'members' field to existing rooms in MongoDB
Run this once to update your existing room documents
"""
import asyncio
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'  # Adjust path if needed
load_dotenv(dotenv_path=env_path)

# Get MongoDB configuration from environment
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "chat_db")


async def migrate_rooms():
    """Add members field to all existing rooms"""
    
    print(f"📡 Connecting to MongoDB...")
    print(f"   URL: {MONGODB_URL[:20]}...")  # Show partial URL for security
    print(f"   Database: {MONGODB_DB_NAME}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB_NAME]
    rooms_collection = db["rooms"]
    
    print("\n🔍 Checking for rooms without 'members' field...")
    
    # Find all rooms that don't have a members field
    rooms_without_members = await rooms_collection.count_documents(
        {"members": {"$exists": False}}
    )
    
    print(f"📊 Found {rooms_without_members} rooms to update")
    
    if rooms_without_members > 0:
        # Add empty members array to all rooms that don't have it
        result = await rooms_collection.update_many(
            {"members": {"$exists": False}},
            {"$set": {"members": []}}
        )
        
        print(f"✅ Updated {result.modified_count} rooms")
        print(f"   Added empty 'members' field to all existing rooms")
    else:
        print("✅ All rooms already have 'members' field")
    
    # Show sample of updated rooms
    print("\n📋 Sample of rooms (showing first 5):")
    count = 0
    async for room in rooms_collection.find().limit(5):
        members_count = len(room.get("members", []))
        print(f"   - {room['name']} (ID: {room['id']}) - {members_count} members")
        count += 1
    
    if count == 0:
        print("   (No rooms found in database)")
    
    client.close()
    print("\n✨ Migration complete!")


if __name__ == "__main__":
    print("🚀 Starting migration to add 'members' field to rooms...")
    print("=" * 60)
    
    try:
        asyncio.run(migrate_rooms())
    except Exception as e:
        print(f"\n❌ Migration failed with error:")
        print(f"   {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()