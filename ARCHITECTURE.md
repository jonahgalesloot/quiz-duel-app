# Quizzard App Architecture

## Overview
This document describes the reorganized file structure for the Quizzard app, which has been modularized for better maintainability and separation of concerns.

## Directory Structure

```
quizzard-app/
├── game/                          # Game logic (isolated module)
│   ├── engine.js                  # Game engine (match flow, scoring)
│   ├── state.js                   # Game state management
│   ├── matchmaking.js             # Matchmaking queue and logic
│   ├── gameSession.js             # Game session management
│   └── timer.js                   # Question timer handling
│
├── routes/
│   ├── api/
│   │   ├── auth/                  # Authentication-related APIs
│   │   │   ├── avatar-upload.js   # Avatar upload (B2 storage)
│   │   │   ├── avatar-download.js # Avatar download/fallback
│   │   │   └── user.js            # User info endpoints
│   │   ├── game/                  # Game-related APIs
│   │   │   ├── questions.js       # Question retrieval
│   │   │   ├── questionSets.js    # Question set management
│   │   │   └── ai-grade.js        # AI grading endpoint
│   │   └── settings/              # User settings APIs
│   │       └── playSettings.js    # Game settings management
│   ├── socket/                    # Socket.io handlers
│   │   ├── index.js               # Main socket coordinator
│   │   ├── matchmaking.js         # Socket matchmaking handler
│   │   ├── gameSession.js         # Socket game session handler
│   │   └── chat.js                # Socket chat handler
│   ├── auth.js                    # Authentication routes
│   └── pages.js                   # Page serving routes
│
├── public/                        # Static assets
├── utils/                         # Utility functions
└── server.js                      # Main server entry point
```

## Key Design Principles

### 1. Game Module Isolation
The `game/` directory functions as a separate module that:
- Handles all game logic independently
- Only interacts with pages for initial routing
- Communicates with server for socket operations
- Maintains clean separation from other app concerns

### 2. Modular Socket Handling
Socket functionality is split into focused modules:
- **matchmaking.js**: Queue management and player matching
- **gameSession.js**: Game flow and question handling
- **chat.js**: Real-time chat functionality
- **index.js**: Coordinates all socket handlers

### 3. Organized API Structure
APIs are grouped by functionality:
- **auth/**: User authentication and profile management
- **game/**: Game-related data and AI grading
- **settings/**: User preferences and configuration

### 4. Clean Separation of Concerns
- **Game Logic**: Isolated in `game/` directory
- **Socket Communication**: Handled by `routes/socket/`
- **API Endpoints**: Organized by domain in `routes/api/`
- **Static Assets**: Served from `public/`

## API Endpoints

### Authentication APIs (`/api/auth/`)
- `POST /api/auth/avatar-upload` - Upload user avatar
- `GET /api/auth/avatar-download/:username` - Get user avatar
- `GET /api/auth/user` - Get current user info

### Game APIs (`/api/game/`)
- `GET /api/game/questions` - Get question sets
- `GET /api/game/questionSets` - Get available question sets
- `POST /api/game/ai-grade` - AI grading for answers

### Settings APIs (`/api/settings/`)
- `GET /api/settings/play` - Get user play settings
- `POST /api/settings/play` - Update user play settings

## Socket Events

### Matchmaking
- `joinMatchmaking` - Join the matchmaking queue
- `disconnect` - Handle player disconnection

### Game Session
- `playerReady` - Player ready signal
- `submitAnswer` - Submit answer to question
- `chatMessage` - Send chat message

## Benefits of This Structure

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Isolated modules are easier to test
3. **Scalability**: New features can be added without affecting existing code
4. **Clarity**: Clear separation makes the codebase easier to understand
5. **Reusability**: Game logic can be reused in different contexts

## Migration Notes

- Old socket.js functionality is now split across multiple files
- API routes have been reorganized by domain
- Game logic is more isolated and modular
- All existing functionality is preserved with cleaner organization 