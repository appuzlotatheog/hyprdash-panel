# HyprDash Panel

A modern, high-performance game server management panel featuring a premium UI, AI assistance, and robust server controls.

## Features

-   **Premium UI/UX**: Built with React, Tailwind CSS, and glassmorphism design.
-   **AI Assistant**: Integrated "Master Control Program" (MCP) for natural language server management using Groq AI.
-   **Real-time Control**: Socket.IO based console, stats, and file operations.
-   **Security**: Role-based access control, Two-Factor Authentication (2FA), and secure file handling.
-   **Scalability**: Supports multiple nodes (daemons) and database hosts.

## Tech Stack

-   **Backend**: Node.js, Express, Socket.IO, Prisma ORM
-   **Frontend**: React, Vite, Tailwind CSS, TanStack Query
-   **Database**: MySQL / MariaDB (via Prisma)

## Prerequisites

-   Node.js v16 or higher
-   MySQL or MariaDB server
-   HyprDash Daemon (running on target nodes)

## Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/appuzlotatheog/hyprdash-panel.git
    cd hyprdash-panel
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    cd web && npm install && cd ..
    ```

3.  **Configuration**
    Copy `.env` example (create one if missing):
    ```env
    PORT=3001
    DATABASE_URL="mysql://user:password@localhost:3306/hyprdash"
    JWT_SECRET="your-super-secret-key-change-this"
    CORS_ORIGIN="http://localhost:5173"
    GROQ_API_KEY="your-groq-api-key"
    ```

4.  **Database Setup**
    ```bash
    npm run db:push
    npm run db:seed  # Optional: Seeds default admin (admin@example.com / admin123)
    ```

## Running the Application

### Development Mode
Runs both backend and frontend in watch mode.
```bash
npm run dev
```
-   Backend: `http://localhost:3001`
-   Frontend: `http://localhost:5173`

### Production Build
```bash
npm run build
npm start
```

## AI Configuration
To enable the AI MCP features, ensure `GROQ_API_KEY` is set in your `.env` file. The AI can manage databases, file operations, and server power states.

## License
MIT
