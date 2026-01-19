# Distributed Chat Application

A real-time chat application built with React, FastAPI, and WebSockets. Features include user authentication, room management, and instant messaging.

![Chat Application](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white)

## Features

- 🔐 **JWT Authentication** - Secure user registration and login
- 💬 **Real-time Messaging** - Instant message delivery using WebSockets
- 🏠 **Room Management** - Create, join, and delete chat rooms
- 👥 **User Presence** - See when users join and leave rooms
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Modern UI** - Beautiful interface with Tailwind CSS

## Tech Stack

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **WebSockets** - Real-time bidirectional communication
- **JWT** - Secure authentication tokens
- **Pydantic** - Data validation using Python type hints
- **Uvicorn** - ASGI server for running the application

### Frontend
- **React** - UI library for building interactive interfaces
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful, consistent icons
- **Native WebSocket API** - Browser WebSocket client

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application setup
│   │   ├── api/
│   │   │   ├── auth.py          # Authentication endpoints
│   │   │   └── rooms.py         # Room management endpoints
│   │   ├── websocket/
│   │   │   └── chat.py          # WebSocket connection manager
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic models
│   │   └── core/
│   │       └── config.py        # Application configuration
│   ├── requirements.txt         # Python dependencies
│   └── run.sh                   # Startup script
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main React component
│   │   └── main.jsx            # React entry point
│   └── package.json            # Node dependencies
└── README.md
```

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
# Using the provided script
chmod +x run.sh
./run.sh

# Or manually
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Create a new React project with Vite:
```bash
npm create vite@latest frontend -- --template react
cd frontend
```
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

2. Install dependencies:
```bash
npm install
npm install lucide-react
```

3. Replace the contents of `src/App.jsx` with the React component code provided

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI).

### Authentication Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and receive JWT token
- `GET /auth/me` - Get current user info (requires authentication)

### Room Endpoints

- `POST /rooms/` - Create a new room (requires authentication)
- `GET /rooms/` - List all rooms (requires authentication)
- `GET /rooms/{room_id}` - Get room details (requires authentication)
- `DELETE /rooms/{room_id}` - Delete a room (requires authentication, only creator)

### WebSocket Endpoint

- `WS /ws/{room_id}/{username}` - Connect to a chat room

## Usage

### 1. Register/Login
- Open the application in your browser
- Create a new account or login with existing credentials
- You'll be redirected to the main chat interface

### 2. Create a Room
- Click the "Create Room" button
- Enter a room name
- Click "Add" to create the room

### 3. Join a Room
- Click on any room from the sidebar
- You'll automatically join the room
- Start chatting with other users in real-time

### 4. Send Messages
- Type your message in the input field at the bottom
- Press Enter or click the Send button
- Your message will be delivered instantly to all users in the room

### 5. Leave a Room
- Click the "Leave Room" button
- You'll be disconnected from the room's WebSocket connection

## Configuration

### Backend Configuration

Edit `backend/app/core/config.py` to customize settings:

```python
class Settings(BaseSettings):
    app_name: str = "Distributed Chat App"
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
```

**Important:** Change the `secret_key` in production!

### Frontend Configuration

Update API URLs in `frontend/src/App.jsx`:

```javascript
const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';
```

## Data Storage

Currently, the application uses **in-memory storage** for:
- User accounts
- Chat rooms
- Active WebSocket connections

**Note:** All data will be lost when the server restarts.

### Upgrading to Persistent Storage

For production use, consider adding:
- **PostgreSQL** or **MongoDB** for user and room data
- **Redis** for session management and caching
- **Message Queue** (RabbitMQ, Kafka) for distributed WebSocket connections

## Security Considerations

- ✅ Passwords are hashed using bcrypt
- ✅ JWT tokens for authentication
- ✅ CORS enabled for local development
- ⚠️ Change `secret_key` in production
- ⚠️ Use HTTPS in production
- ⚠️ Implement rate limiting for API endpoints
- ⚠️ Add input validation and sanitization

## Deployment

### Backend Deployment (Example with Docker)

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Deployment

Build the production version:

```bash
npm run build
```

Deploy the `dist/` folder to any static hosting service (Vercel, Netlify, AWS S3, etc.)

## Troubleshooting

### WebSocket Connection Failed
- Ensure the backend is running on port 8000
- Check CORS settings in `backend/app/main.py`
- Verify the WebSocket URL matches your backend URL

### Authentication Issues
- Clear browser local storage
- Check if JWT token is being sent in Authorization header
- Verify secret_key matches between requests

### Messages Not Appearing
- Check browser console for errors
- Verify WebSocket connection is established
- Ensure you're in the same room as other users

## Future Enhancements

- [ ] Persistent message history
- [ ] Private/direct messaging
- [ ] File and image sharing
- [ ] User profiles and avatars
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Message reactions
- [ ] Room search and filtering
- [ ] Admin panel
- [ ] Mobile app (React Native)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using FastAPI and React