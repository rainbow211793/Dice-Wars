# Dice Wars — Web (Mobile-friendly) — client-only ZIP

This package contains a **mobile-friendly web client** for Dice Wars. It is multiplayer-capable but **does not include a server**. You must run or deploy a compatible Socket.IO server for multiplayer to work (see notes below).

Files included:
- index.html — responsive UI and lobby
- client.js — Socket.IO client + mobile touch controls
- style.css — responsive styles
- manifest.json — PWA manifest (add icons to make installable)

## How to use
1. Host these files as static files (e.g., GitHub Pages, Netlify, Vercel, or any static host).
2. Enter your server URL in the "Server URL" box (or leave blank to use same origin).
3. Create a room (server must support 'createRoom' event) or enter a room code and Join.

## Compatible server
The client expects a Socket.IO server that supports the following events and replies (these are the same conventions used in the server I previously gave you):
- Client -> server: `createRoom` (no payload). Server should emit back `roomCreated` with `{ roomId }`.
- Client -> server: `joinRoom` with `{ roomId, name }`. Server should emit `joined` with `{ playerId, roomId, players }` and then broadcast `playerList`/`gameState` updates.
- Server -> client: `gameState` will contain `{ players, grid, turnIndex, started }` which the client renders.
- Client -> server: `attack`, `endTurn`, `reinforce` events as used in previous server.

If you need, I can also adapt the server code to match this client exactly and produce a separate server ZIP.

## Notes
- This client is touch-optimized (pointer events) and includes a simple UI for creating/joining rooms.
- To make a fully installable mobile app (APK) from this client, use a wrapper such as Capacitor or Cordova and copy these files into the `www/` directory.

Want me to also produce a matching **server ZIP** that implements the exact `createRoom`/`joined` flow so you can deploy it to Render/Fly/Railway? I can do that next and then produce a single zip containing both server + mobile client, or create a deployment guide for a specific host.
