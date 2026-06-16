# Point Blank — FE & BE Integration Specifications

This document outlines the API endpoints, WebSocket event protocols, and data structures (DS) required to integrate the **Point Blank** PWA Frontend with a real-time WebSocket Backend (e.g., Cloudflare Workers Durable Objects).

---

## 1. Core Architecture Overview

```mermaid
sequenceDiagram
    participant FE as PWA Client (FE)
    participant API as HTTP API Gateway
    participant WS as WebSocket Room Server (BE)

    FE->>API: POST /api/room/create (Host settings)
    API-->>FE: 201 Created (Room Code + Join Token)
    FE->>WS: Connect ws://backend/room/{code}
    Note over FE,WS: WebSocket Handshake & Auth
    WS-->>FE: Event: room_state (Initial Sync)
```

1. **HTTP API**: Used for room creation, code validation, and lightweight catalog queries.
2. **WebSockets (State Synchronization)**: Used for active lobbies, chat feeds, game-state changes, reactions, and player sync. The Backend maintains the source of truth for the room state and broadcasts it to all clients.

---

## 2. HTTP REST Endpoints

### Authentication & Account Management

#### User Sign Up
* **Endpoint**: `POST /api/auth/signup`
* **Request Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "secure-password",
    "name": "Alex",
    "color": "#FF5C39"
  }
  ```
* **Response Payload (201 Created)**:
  ```json
  {
    "token": "session-jwt-token-xyz",
    "account": {
      "id": "u-user-uuid",
      "email": "user@example.com",
      "name": "Alex",
      "color": "#FF5C39",
      "credits": 500,
      "packs": ["Classic", "Memes & Internet"],
      "upgrades": [],
      "wins": 0,
      "games": 0,
      "createdAt": 1781293812000,
      "history": [
        { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
      ]
    }
  }
  ```

#### User Login
* **Endpoint**: `POST /api/auth/login`
* **Request Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "secure-password"
  }
  ```
* **Response Payload (200 OK)**:
  ```json
  {
    "token": "session-jwt-token-xyz",
    "account": {
      "id": "u-user-uuid",
      "email": "user@example.com",
      "name": "Alex",
      "color": "#FF5C39",
      "credits": 500,
      "packs": ["Classic", "Memes & Internet"],
      "upgrades": [],
      "wins": 0,
      "games": 0,
      "createdAt": 1781293812000,
      "history": [
        { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
      ]
    }
  }
  ```

#### Get Current Profile
* **Endpoint**: `GET /api/auth/me`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Response Payload (200 OK)**:
  ```json
  {
    "id": "u-user-uuid",
    "email": "user@example.com",
    "name": "Alex",
    "color": "#FF5C39",
    "credits": 500,
    "packs": ["Classic", "Memes & Internet"],
    "upgrades": [],
    "wins": 0,
    "games": 0,
    "createdAt": 1781293812000,
    "history": [
      { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
    ]
  }
  ```

#### Update Profile
* **Endpoint**: `PUT /api/auth/profile`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Request Payload**:
  ```json
  {
    "name": "NewAlex",
    "color": "#7C5CFF"
  }
  ```
* **Response Payload (200 OK)**:
  ```json
  {
    "id": "u-user-uuid",
    "email": "user@example.com",
    "name": "NewAlex",
    "color": "#7C5CFF",
    "credits": 500,
    "packs": ["Classic", "Memes & Internet"],
    "upgrades": [],
    "wins": 0,
    "games": 0,
    "createdAt": 1781293812000,
    "history": [
      { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
    ]
  }
  ```

### Economy & Marketplace Transactions

#### Get Marketplace Catalog
* **Endpoint**: `GET /api/economy/catalog`
* **Response Payload (200 OK)**:
  ```json
  {
    "packs": [
      { "name": "Classic", "cards": 480, "free": true },
      { "name": "Tech & Startups", "cards": 180, "price": 120, "free": false },
      { "name": "College Life", "cards": 210, "price": 140, "free": false }
    ],
    "upgrades": [
      { "id": "mp10", "name": "Bigger Party", "desc": "Host rooms with up to 10 players", "price": 300 },
      { "id": "swapPlus", "name": "Swap Master", "desc": "Swap up to 5 cards, and earn swaps every 2 rounds", "price": 250 }
    ],
    "creditBundles": [
      { "coins": 500, "tag": "$4.99" },
      { "coins": 1200, "tag": "$9.99", "best": true },
      { "coins": 3000, "tag": "$19.99" }
    ]
  }
  ```

#### Buy Credits (Coin Top-up)
* **Endpoint**: `POST /api/economy/buy-credits`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Request Payload**:
  ```json
  {
    "coins": 1200,
    "tag": "$9.99"
  }
  ```
* **Response Payload (200 OK)**:
  ```json
  {
    "success": true,
    "credits": 1700,
    "history": [
      { "label": "Coin top-up ($9.99)", "delta": 1200, "ts": 1781293815000 },
      { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
    ]
  }
  ```

#### Purchase Card Pack
* **Endpoint**: `POST /api/economy/buy-pack`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Request Payload**:
  ```json
  {
    "packName": "Tech & Startups",
    "price": 120
  }
  ```
* **Response Payload (200 OK)**:
  ```json
  {
    "success": true,
    "credits": 1580,
    "unlockedPacks": ["Classic", "Memes & Internet", "Tech & Startups"],
    "history": [
      { "label": "Pack: Tech & Startups", "delta": -120, "ts": 1781293818000 },
      { "label": "Coin top-up ($9.99)", "delta": 1200, "ts": 1781293815000 },
      { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
    ]
  }
  ```

#### Purchase Upgrade
* **Endpoint**: `POST /api/economy/buy-upgrade`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Request Payload**:
  ```json
  {
    "upgradeId": "swapPlus",
    "price": 250
  }
  ```
* **Response Payload (200 OK)**:
  ```json
  {
    "success": true,
    "credits": 1330,
    "unlockedUpgrades": ["swapPlus"],
    "history": [
      { "label": "Upgrade: Swap Master", "delta": -250, "ts": 1781293822000 },
      { "label": "Pack: Tech & Startups", "delta": -120, "ts": 1781293818000 },
      { "label": "Coin top-up ($9.99)", "delta": 1200, "ts": 1781293815000 },
      { "label": "Welcome bonus", "delta": 500, "ts": 1781293812000 }
    ]
  }
  ```

### Custom Cards Studio

#### Get Custom Cards
* **Endpoint**: `GET /api/custom-cards`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Response Payload (200 OK)**:
  ```json
  [
    { "id": "card-1", "type": "prompt", "text": "My custom prompt ____." },
    { "id": "card-2", "type": "answer", "text": "My custom answer card." }
  ]
  ```

#### Create Custom Card
* **Endpoint**: `POST /api/custom-cards`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Request Payload**:
  ```json
  {
    "type": "prompt",
    "text": "My new dynamic custom prompt ____."
  }
  ```
* **Response Payload (201 Created)**:
  ```json
  {
    "id": "card-3",
    "type": "prompt",
    "text": "My new dynamic custom prompt ____."
  }
  ```

#### Delete Custom Card
* **Endpoint**: `DELETE /api/custom-cards/:id`
* **Headers**: `Authorization: Bearer session-jwt-token-xyz`
* **Response Payload (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### Room Management

### Create Room
* **Endpoint**: `POST /api/room/create`
* **Request Payload**:
  ```json
  {
    "hostName": "Alex",
    "maxPlayers": 5,
    "scoreLimit": 3,
    "timer": 45,
    "packs": ["Classic", "Memes & Internet"],
    "family": false,
    "custom": false
  }
  ```
* **Response Payload (201 Created)**:
  ```json
  {
    "code": "GRUV",
    "token": "host-auth-jwt-token-xyz",
    "playerId": "p-host-uuid"
  }
  ```

### Verify Room Code
* **Endpoint**: `GET /api/room/verify/:code`
* **Response Payload (200 OK - Valid)**:
  ```json
  {
    "valid": true,
    "status": "lobby",
    "playersCount": 2,
    "maxPlayers": 5
  }
  ```
* **Response Payload (404 Not Found - Invalid)**:
  ```json
  {
    "valid": false,
    "error": "Room not found or game already finished."
  }
  ```

### Admin Operations & Seeding

#### Import Initial Card Packages
* **Endpoint**: `POST /api/admin/packs/import`
* **Sample JSON File**: [initial-packs.json](file:///Users/sidhanshu/Github/cah-game/context/initial-packs.json)
* **Headers**: `X-Admin-Token: admin-secret-token-123`
* **Request Payload**:
  ```json
  {
    "packs": [
      {
        "name": "Classic",
        "free": true,
        "prompts": [
          "My secret talent is ____.",
          "The real reason I was late today: ____."
        ],
        "answers": [
          "a suspicious amount of glitter",
          "aggressive interpretive dance"
        ]
      },
      {
        "name": "Tech & Startups",
        "free": false,
        "price": 120,
        "prompts": [
          "Step 1: ____. Step 2: profit."
        ],
        "answers": [
          "the neighbor's wifi",
          "homemade kombucha"
        ]
      }
    ]
  }
  ```
* **Response Payload (200 OK)**:
  ```json
  {
    "success": true,
    "importedCount": 2,
    "totalPrompts": 3,
    "totalAnswers": 4
  }
  ```

---

## 3. Data Structures (DS)

### User Account
```typescript
interface UserAccount {
  id: string;          // User ID (UUID)
  email: string;       // User's email address
  name: string;        // Nickname
  color: string;       // Avatar HEX color (e.g. #FF5C39)
  credits: number;     // Simulated coins balance
  packs: string[];     // Unlocked custom packs list
  upgrades: string[];  // Active capability upgrades list
  history: {           // Coin transactions list
    label: string;
    delta: number;
    ts: number;
  }[];
  wins: number;        // Total game victories
  games: number;       // Total game runs
  createdAt: number;   // Timestamp (Unix ms)
}
```

### Player
```typescript
interface Player {
  id: string;          // Unique socket ID / Session ID
  name: string;        // Nickname
  color: string;       // Avatar HEX color (e.g. #FF5C39)
  score: number;       // Wins count
  isYou?: boolean;     // Set locally on the client
  isHost: boolean;     // True if player created the room
  isReady: boolean;    // Ready status in lobby
  isConnected: boolean;// Socket connection health
  isSpectator?: boolean; // True if player joined as a spectator
}
```

### Chat Message
```typescript
interface ChatMessage {
  id: string;          // Unique message ID (UUID / hash)
  who: string;         // Player ID of sender, or "system" for admin logs
  name: string;        // Nickname of sender, or "System" for admin logs
  text: string;        // Chat text content (censored if family mode is enabled)
  ts: number;          // Timestamp (Unix ms)
}
```

### Room State (Source of Truth)
```typescript
interface RoomState {
  code: string;        // 4-letter room code (e.g. GRUV)
  status: 'lobby' | 'pick' | 'judging' | 'reveal' | 'ended';
  settings: {
    maxPlayers: number;
    scoreLimit: number;
    timer: number;
    packs: string[];
    family: boolean;
    custom: boolean;
  };
  players: Player[];
  judgeId: string;     // Player ID of current judge
  roundNum: number;    // Current round number (1-indexed)
  prompt: string;      // Active question card (e.g. "My secret talent is ____.")
  submissions: {
    pid: string;       // Player ID
    text: string;      // Selected answer (Empty string if flipped is false)
    flipped: boolean;  // True once all answers are in and flipped by judge
  }[];
  winnerId: string | null; // Player ID of round winner
  winnerSub: string | null;// Winner's answer text
  timeLeft: number;    // Remaining turn time
  chatHistory: ChatMessage[]; // Last 50 messages sent in this room (includes system logs)
}
```

---

## 4. Room Roles & Permissions Mapping

The server enforces role-based access control (RBAC) on HTTP REST and WebSocket connections based on the following roles:

1. **Host/Owner**: The player who created the room (`isHost: true`).
2. **Player**: A standard active participant in the game (`isHost: false`, `isSpectator: false`).
3. **Spectator**: A passive observer (`isSpectator: true`).

### Permissions Matrix

| Event / Action | Host / Owner | Player | Spectator | Validation / Rules |
| :--- | :---: | :---: | :---: | :--- |
| **Change Settings** | Yes | No | No | Lobby settings can only be altered by the host connection. |
| **Start Game** | Yes | No | No | Only the host can transition the room from `lobby` to `pick`. |
| **Toggle Ready** | Yes | Yes | No | Spectators cannot ready up or prevent the game from starting. |
| **Chat & React** | Yes | Yes | Yes | All connected users can send chats and float reactions. |
| **Submit Cards** | Yes | Yes | No | Spectators do not receive a card hand and cannot submit answers. |
| **Swap Cards** | Yes | Yes | No | Spectators cannot request card replacements. |
| **Crown Winner** | Yes* | Yes* | No | Only the active round judge (`judgeId`) can crown a card. *If host or player is the current round judge. |
| **Kick Player** | Yes | No | No | Only the host can execute the `kick_player` command. |
| **Replay Game** | Yes | No | No | Only the host can trigger the `replay_game` reset. |

---

## 5. WebSocket Protocols & Event Payloads

### Client to Server Events (`C2S`)

#### Join Room
Triggered on WebSocket handshake connection.
* **Params**: Query parameters `?name=Alex&color=%23FF5C39&token=xyz&spectator=true`

#### Toggle Ready (`ready`)
Toggles ready state in lobby.
* **Payload**:
  ```json
  { "event": "ready", "ready": true }
  ```

#### Submit Answer Card (`submit_card`)
Sends selected card text.
* **Payload**:
  ```json
  { "event": "submit_card", "text": "a suspicious amount of glitter" }
  ```

#### Swap Answer Cards (`swap_cards`)
Replaces multiple cards in hand.
* **Payload**:
  ```json
  { "event": "swap_cards", "cardTexts": ["unsolicited life advice", "lukewarm soup"] }
  ```

#### Crown Winner (`crown_winner`)
Judge crowns the winning submission.
* **Payload**:
  ```json
  { "event": "crown_winner", "pid": "p-player-uuid" }
  ```

#### Send Emoji Reaction (`spawn_reaction`)
Floats emojis across other players' viewports.
* **Payload**:
  ```json
  { "event": "spawn_reaction", "emoji": "🔥", "x": 42.5 }
  ```

#### Next Round (`next_round`)
Proceeds to the next gameplay cycle.
* **Payload**:
  ```json
  { "event": "next_round" }
  ```

#### Send Chat Message (`chat`)
Sends a message to the lobby chat box.
* **Payload**:
  ```json
  { "event": "chat", "text": "hey everyone!" }
  ```

#### Kick Player (`kick_player`)
Host removes a player from the room.
* **Payload**:
  ```json
  { "event": "kick_player", "pid": "p-player-uuid" }
  ```

#### Replay Game (`replay_game`)
Host triggers a room reset at the end screen to play again.
* **Payload**:
  ```json
  { "event": "replay_game" }
  ```

---

### Server to Client Events (`S2C`)

#### Sync State (`room_state`)
Broadcasted when players join, submit cards, change ready state, or advance round phases.
* **Payload**:
  ```json
  {
    "event": "room_state",
    "state": { ...RoomState }
  }
  ```

#### Broadcast Chat Message (`chat_received`)
Broadcasting incoming chat lines.
* **Payload**:
  ```json
  {
    "event": "chat_received",
    "msg": {
      "id": "msg-12938",
      "who": "p-player-uuid",
      "name": "Priya",
      "text": "hey everyone!",
      "ts": 1781293812
    }
  }
  ```

#### Broadcast Reaction (`reaction_received`)
Syncing reaction floating positions.
* **Payload**:
  ```json
  {
    "event": "reaction_received",
    "emoji": "💀",
    "x": 68.2
  }
  ```

#### Kicked from Room (`player_kicked`)
Notifies the targeted player they were removed from the room.
* **Payload**:
  ```json
  {
    "event": "player_kicked",
    "reason": "kicked by host"
  }
  ```

---

## 6. Room Orchestration & Edge Cases

### 1. Server-Side Bot Simulation
To ensure a consistent multiplayer experience, the Backend Server manages bot states and actions durably:
- **Bot Allocation**: If the human player count is less than `settings.maxPlayers` when the game starts, the server populates the remaining slots with Bot instances (`isBot: true` in the players roster).
- **Bot Submissions**: In the `pick` phase, the server sets random timers (e.g., 2 to 6 seconds) for each bot to select and lock in a card from the deck pool.
- **Bot Judging**: In the `judging` phase, if a bot is the judge, the server sets a timer (e.g., 5 to 10 seconds) and randomly selects one of the submitted cards as the winner.
- **Bot Reactions**: During the `reveal` phase, bots randomly broadcast float emoji reactions through the socket.

### 2. Card Swap Credit Validation
The server securely validates card swap attempts:
- The server tracks the number of swaps used (`swapsUsed: number` on the server-side player state) per connection.
- A player is only allowed to swap cards if `Math.floor((roundState.roundNum - 1) / swapInterval) - swapsUsed > 0` (where `swapInterval` is 3, or 2 if they own the `swapPlus` upgrade).
- Server rejects unauthorized `swap_cards` payloads.

### 3. Reconnection & Session Recovery
If a user loses internet connectivity or refreshes their browser:
- The server retains the player profile in the room roster but marks `isConnected: false`.
- The player has a 45-second grace period to reconnect.
- Upon reconnecting, the client establishes a WebSocket connection passing the original `token` and `playerId` in query params.
- The server matches the player ID, updates `isConnected: true`, and immediately sends the full `room_state` sync payload containing the user's active card hand.
- If the grace period expires, the host player is notified, and the disconnected player is kicked or converted to a bot.

