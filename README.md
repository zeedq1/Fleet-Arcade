# Fleet Arcade — Render Multiplayer Edition

Fleet Arcade is a responsive, browser-based multiplayer arcade with **25 games**, room codes, nickname support, invite links, searchable categories, favourites, random game selection and optional sound effects. The website and game server run together on Render, so a player's computer does not host the match.

## 25 games

### Existing classics
- **Battleship** — deploy five ships and sink the opponent's fleet.
- **Tic-Tac-Toe** — classic X/O duel.
- **Connect Four** — connect four discs in a row.
- **Rock Paper Scissors** — best of three hand-sign rounds.

### 21 additional games
1. **Higher or Lower** — take turns guessing a number from 1 to 100.
2. **Math Sprint** — solve ten arithmetic problems and compete on score.
3. **Memory Match** — match eight pairs of hidden cards.
4. **Word Scramble** — be the first to unscramble the word.
5. **Hangman Duel** — alternate letter guesses to solve the word.
6. **Coin Flip** — pick heads or tails for five rounds.
7. **Dice Duel** — roll and race to 30 points.
8. **Nim Pile** — take one to three stones; taking the last wins.
9. **Connect Three** — connect three marks on a 4×4 board.
10. **Reversi** — flip discs and finish with the most territory.
11. **Wordle Race** — race to guess a six-letter word in six attempts.
12. **Typing Race** — type the shared phrase exactly to win.
13. **Reaction Test** — wait for the signal and click quickly.
14. **Trivia Duel** — answer five general-knowledge questions.
15. **Penalty Shootout** — choose a shot and goalkeeper dive across five rounds.
16. **Blackjack Duel** — aim for a total close to 21 without busting.
17. **Code Breaker** — use exact/misplaced clues to crack a four-digit code.
18. **Odd One Out** — spot the item that does not belong over five rounds.
19. **Sequence Recall** — memorise a number sequence and reproduce it.
20. **Grid Conquest** — claim spaces on a 5×5 grid.
21. **Emoji Riddle** — decode an emoji clue before your opponent.

## Project files

- `server.js` — Express web server, Socket.IO connections, room lifecycle, and server-validated moves.
- `package.json` — Node dependencies and start command.
- `public/index.html` — web interface and game catalogue.
- `public/style.css` — responsive design, animations and game layouts.
- `public/script.js` — lobby, game rendering and multiplayer client.
- `render.yaml` — optional Render Blueprint configuration.

## Deploy to Render

### Option A — Render dashboard
1. Download and extract the ZIP.
2. Create a new GitHub repository, such as `fleet-arcade`.
3. Upload the **contents** of the `fleet-arcade` folder to the repository root. The root should contain `server.js`, `package.json`, `render.yaml`, `README.md`, and a `public` folder.
4. Go to [Render Dashboard](https://dashboard.render.com/) and sign in.
5. Choose **New → Web Service** and connect the GitHub repository.
6. Set **Runtime** to Node, **Build Command** to `npm install`, and **Start Command** to `npm start`.
7. For casual testing, you can select a free instance if Render offers it for your account/region.
8. Deploy and open the `https://your-service-name.onrender.com` address Render provides.
9. Share that URL with your friend; both players use the same website.

### Option B — Render Blueprint
1. Upload the project to GitHub as above.
2. In Render, choose **New → Blueprint**, select your repository, and follow the prompts in `render.yaml`.

## Play together
1. Open the Render website.
2. Optionally enter a nickname, and choose a game from the searchable catalogue or random picker.
3. Click **Create room**, then copy the room code or invite link.
4. Your friend opens the URL and enters the code, or uses the invite link to join automatically.
5. Play in the browser. Favourites, nickname and sound preference are saved in that browser.

## Hosting notes

- Render serves the page and multiplayer server from the same Node service; GitHub Pages is not required for this version.
- The server listens on `process.env.PORT` and binds to `0.0.0.0`.
- Game rooms are held in server memory. Render restarts/redeployments end active matches; there are no user accounts or persistent rankings yet.
- A free web service may sleep when idle and take time to wake. See [Render's current free-instance limits](https://render.com/docs/free).
- The server validates the major moves, choices and answers for the added games. This is a casual starter arcade, not a competitive anti-cheat platform. There is no database or API key needed.
- Run locally with `npm install` followed by `npm start`, then open `http://localhost:10000`.
