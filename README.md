<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/db422de9-bf04-4498-81e3-567679174b7f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the backend:
   `npm run dev:backend`
4. Run the frontend:
   `npm run dev`

## Deployment (Next.js + Socket.io)

Karena Vercel tidak mendukung WebSocket secara langsung, proyek ini menggunakan arsitektur terpisah:

### 1. Backend (Socket.io)
Deploy file `game-server.ts` ke platform yang mendukung server persistent (seperti Render, Railway, atau Koyeb).
- **Build Command:** `npm install`
- **Start Command:** `npm run start:backend`

### 2. Frontend (Next.js)
Deploy ke Vercel seperti biasa.
- **Environment Variable:** Tambahkan `NEXT_PUBLIC_SOCKET_URL` dengan URL backend Anda.
