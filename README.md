# Fleet Arcade Ultimate — 100 Games

A redesigned Fleet Arcade project with a 100-item catalogue, single-player sessions, online versus rooms, and co-op score hunts. The games use reusable mini-game engines, with distinct prompts, topics, lengths, and goals per catalogue item.

## Included
- 100 catalogue entries across Reflex, Arcade, Numbers, Words, Trivia, Memory, Logic, Puzzle, and Co-op categories
- Single-player mode with five rounds, personal bests, and session counts stored in the browser
- Online room codes, invite links, nicknames, versus scoring, co-op team totals, round progression, and live room player lists
- Shared challenge seed so connected players receive the same round prompt
- Search, category filters, mode filters, sort, favourites, sound toggle, responsive layout
- Node.js + Express + Socket.IO server, Render config and `/health` check

## Local run
1. Install Node.js 20 or newer.
2. From the project root run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:10000`.

## Deploy to Render
1. Extract the ZIP.
2. Create a GitHub repository and upload the *contents* of this folder, keeping `server.js`, `package.json` and `render.yaml` in the repository root and the client files in `public/`.
3. In Render, choose **New → Web Service**, connect that repository, and use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. Choose a plan and deploy. Render's free instances can sleep when idle, so first connection after a quiet period may be slow.
5. Open the Render URL. Host chooses a game → Versus room or Co-op room, then shares the room code. Other players use the code box on the home page. The host starts with at least two players.

## Game modes
- **Solo:** locally generated five-round run; no server connection required.
- **Versus:** every player gets the same seed-based challenge and their points are compared.
- **Co-op:** the same challenges are played, and everyone's points add to one team total.

## Current prototype limitations
- This is a casual arcade prototype, not a cheat-proof competitive platform. Round scores are client-reported; a malicious client could forge them.
- Rooms and scores live in server memory, so a server restart ends active matches and clears room state.
- The 100 titles are built from reusable mechanics (reaction, tapping, maths, trivia, word scramble, typing, sequence recall, memory match, code guessing, higher/lower, odd-one-out and pattern solving). Titles with a similar mechanic are variants, not 100 entirely bespoke game engines.
- Some modes are challenge-based rather than real-time physics games. Co-op is a shared score objective; players solve the same round and combine their points.
- A full live browser + multiplayer playtest should be run after deployment. Syntax/structure checks alone cannot guarantee every hosted network will work.
