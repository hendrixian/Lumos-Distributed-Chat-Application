# simulate_multiple_users.py
import asyncio
import websockets
import json
from datetime import datetime

async def simulate_user(username, room_id, messages):
    """Simulate a user joining and sending messages"""
    uri = f"ws://localhost:8002/ws/{room_id}/{username}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✅ {username} connected")
            
            # Wait a bit
            await asyncio.sleep(1)
            
            # Send messages
            for i, msg in enumerate(messages):
                message = {"content": msg}
                await websocket.send(json.dumps(message))
                print(f"📤 {username} sent: {msg}")
                
                # Wait for response
                response = await websocket.recv()
                print(f"📥 {username} received: {response[:50]}...")
                await asyncio.sleep(2)
                
    except Exception as e:
        print(f"❌ {username} error: {e}")

async def main():
    room_id = "115e0c7b-a789-4524-a8cd-3df07f409de7"
    
    # Simulate 3 users
    users = [
        ("bob", ["Hello everyone!", "How are you?"]),
        ("alice", ["Hi Bob!", "Nice to meet you all"]),
        ("charlie", ["Hey team!", "Let's get started"])
    ]
    
    # Run all users concurrently
    tasks = [simulate_user(username, room_id, messages) 
             for username, messages in users]
    
    await asyncio.gather(*tasks)
    
    # Check Redis after simulation
    print("\n📊 Simulation complete!")
    print("Check Redis with:")
    print(f"  LRANGE chat:history:{room_id} 0 10")
    print(f"  PUBSUB NUMSUB chat:room:{room_id}")

if __name__ == "__main__":
    asyncio.run(main())