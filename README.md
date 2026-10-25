# Fleet Arcade — Render Multiplayer Edition

Fleet Arcade is a two-player browser game hub. This version runs the website **and** its multiplayer server in one Node.js service, so a player's computer does not host the match.

## Games included

- **Battleship** — five-ship fleet placement, alternating shots, hits, misses, and sinking ships.
- **Tic-Tac-Toe** — two-player 3×3 grid.
- **Connect Four** — two-player 7-column game with server-checked wins.
- **Rock Paper Scissors** — best of three rounds.

## Project files

- `server.js` — Express web server and Socket.IO multiplayer game server.
- `package.json` — Node.js dependencies and start command.
- `public/index.html` — website and game screens.
- `public/style.css` — responsive design, game boards, and animations.
- `public/script.js` — client-side interface and room communication.
- `render.yaml` — optional Render Blueprint configuration.

## Deploy to Render

### Option A: GitHub repository + Render dashboard

1. Download and extract this project ZIP.
2. Create a new GitHub repository, for example `fleet-arcade`.
3. Upload the **contents** of the extracted project to the repository root. The repository should show `server.js`, `package.json`, `render.yaml`, `README.md`, and a `public` folder containing the three website files. Do not upload the ZIP itself as the only file.
4. Go to [Render](https://dashboard.render.com/) and sign in.
5. Click **New** → **Web Service** and connect your GitHub repository.
6. Use these settings:
   - **Runtime / Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free (for testing)
7. Click **Create Web Service** and wait for the deployment to finish.
8. Open the `https://your-service-name.onrender.com` URL Render gives you. Share that URL with your friend; both players use the same address.

### Option B: Render Blueprint

The ZIP also includes `render.yaml`. After uploading the files to GitHub, go to Render and choose **New** → **Blueprint**, connect the repository, and follow the prompts. Render will read the service settings from `render.yaml`.

## Play a game

1. Open your Render URL.
2. Choose Battleship, Tic-Tac-Toe, Connect Four, or Rock Paper Scissors.
3. One player clicks **Create room** and shares the six-character room code.
4. The other player enters that code and clicks **Join room**.
5. Play in the browser. The server validates turns and moves for the mini-games, and validates Battleship fleets and shots.

## Important hosting notes

- You do **not** need GitHub Pages for this version; Render serves the webpage and runs the multiplayer server together.
- The server listens on `process.env.PORT` and binds to `0.0.0.0`, as Render expects.
- The Free Render web service sleeps after 15 minutes without inbound traffic and may take about a minute to wake. In-memory game rooms are lost if the service restarts or redeploys, so this is intended for casual testing rather than persistent accounts or ranked matches.
- No database, API key, or payment is required for this starter version. Render's free-plan limits may change; check [Render's current free-instance limits](https://render.com/docs/free).
- Multiplayer rooms are temporary and currently support two players. Leaving or disconnecting ends that room.
