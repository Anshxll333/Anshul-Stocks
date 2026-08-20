# Project Setup Guide

This guide explains how to install and setup the **Anshul Stocks** development environment.

## Prerequisites
Before you start, make sure you have installed:
1. **Node.js** (v18 or higher recommended)
2. **npm** (v9 or higher)
3. **PostgreSQL** (v14 or higher)

---

## 1. Database Configuration
1. Make sure your local PostgreSQL database server is running.
2. Connect to it via your CLI or any GUI manager (like pgAdmin or DBeaver) and create a database:
   ```sql
   CREATE DATABASE anshul_stocks;
   ```
3. Copy the backend `.env` configuration file and adjust `DATABASE_URL` as needed:
   `postgresql://[user]:[password]@[host]:5432/anshul_stocks`

---

## 2. Backend Installation & Synchronization
1. Go to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the schema migrations using Drizzle ORM:
   ```bash
   # Generates schema snapshot under database
   npm run db:generate
   
   # Pushes schema tables directly to PostgreSQL
   npm run db:push
   ```
4. Start the NestJS backend:
   ```bash
   npm run start:dev
   ```

---

## 3. Frontend Installation
1. Go to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.
