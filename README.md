# Kart Party 🏁

A playable, browser-based 3D split-screen kart racer controlled by phones. One shared TV/host screen; up to four players. Built with Node.js, Socket.IO, and Babylon.js.

## Quick start

1. Install **Node.js 18+**.
2. Run `npm install` in this folder.
3. Run `npm start`.
4. Open `http://localhost:3000/host.html` on your computer/TV and click **Create Lobby**.
5. Open `http://YOUR-COMPUTER-LAN-IP:3000/play.html` on phones connected to the same Wi-Fi (replace with your computer's LAN IP), or use your public deployed URL.
6. Enter name, room code, and choose an emoji or upload a picture. Start the game on the host.
7. Vote on a map (20 seconds), continue past Classic 3-Lap Race, choose character/kart/ability, ready up, and race!

## Deploying from GitHub

Push the extracted project files (not just the ZIP) to GitHub. Deploy on a service that supports **Node.js servers and persistent WebSocket connections**, e.g. Render or Railway. Use:

- Build command: `npm install`
- Start command: `npm start`
- Port: provided by the hosting service as `PORT`
- Health endpoint: `/health`

A static-only host such as GitHub Pages cannot run the Socket.IO server. Babylon.js is loaded from a CDN, so the TV browser needs internet access even if the Node.js server is on your local network.

## Controls

- Drag left/right on the virtual joystick to steer.
- Hold **GO** to accelerate.
- Hold **BRAKE** to slow down or reverse.
- Hold **DRIFT** to turn more sharply.
- Tap **POWER** when charged (20 seconds). Glowing orbs subtract 10 seconds from the charge timer.
- The first racer to complete 3 laps wins. Race automatically ends after 4 minutes if needed.

## What is implemented

- Host room codes, player names, emoji and uploaded avatars (resized client-side)
- Up to four connected phone controllers
- 20-second track voting and tied-vote random selection
- Classic three-lap race mode
- Character, kart and special ability selection
- Four themed track palettes (same oval track geometry in this version)
- Babylon.js third-person 3D racing with 1–4 camera viewports
- Acceleration, steering, braking, drifting, off-track slowdown
- Boost, shield, pulse and blink abilities (shield currently protects from pulse)
- Glowing ability-charge orbs, per-player 20-second cooldown
- Finishing positions, elapsed times, DNF leaderboard, rematch flow

## Important limitations / next improvements

This is a **complete playable first version / MVP**, not a polished commercial kart game. Track layouts share one oval geometry with different themes. Karts/characters are represented with simple 3D shapes; their choices are cosmetic in this version. There is no player account, matchmaking, persistent progression, audio, or AI bots. Host reload during a race will interrupt the race. Lobby state is in memory and is lost when the server restarts. Custom photos exist only in memory for the duration of the room. A stable internet connection and a modern browser with WebGL are needed.

Race physics are calculated on the host browser, so the host is trusted. This is suitable for friendly party play but not cheat-resistant competitive online play. The host and phones should use a low-latency network for the best response. Performance will vary with device and display.

## Project structure

- `server.js` — lobby state, Socket.IO events, voting, abilities, results
- `public/host.html` + `public/host.js` — TV UI and Babylon.js 3D game
- `public/play.html` + `public/play.js` — phone joining, customization, touch controller
- `public/style.css` — styling
- `public/common.js` — shared UI helpers

## License

Original starter game code provided for your project. No proprietary Mario Kart or Overcooked assets are included.
