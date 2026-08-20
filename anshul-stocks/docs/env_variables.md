# Environment Variables Guide

This document describes all environment configurations utilized in the **Anshul Stocks** stack.

## Frontend Configuration

Create a file named `.env` in the `frontend` folder:

```ini
# Base URL pointing to the NestJS backend instance
VITE_API_URL=http://localhost:3000
```

---

## Backend Configuration

Create a file named `.env` in the `backend` folder:

```ini
# Port where the server will listen (defaults to 3000)
PORT=3000

# Application environment ('development' or 'production')
NODE_ENV=development

# PostgreSQL connection string for Drizzle ORM
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anshul_stocks

# JWT secret key used to sign and verify authorization tokens
JWT_SECRET=supersecretjwtkeyforanshulstocksapplication2026
```
