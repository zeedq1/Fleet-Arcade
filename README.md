# Fleet Arcade — Online Multiplayer Games

A static browser-based multiplayer arcade for two friends. Host it on GitHub Pages and use room codes to play online through PeerJS.

## Included games

- **Battleship** — deploy five ships, then take turns firing across a 10×10 grid.
- **Tic-Tac-Toe** — classic 3×3, alternating X and O.
- **Connect Four** — drop tokens into a 7-column board and connect four.
- **Rock Paper Scissors** — best of three rounds.

## Files

- `index.html` — game selection, room lobby, and game screens
- `style.css` — responsive styling and animations
- `script.js` — gameplay and PeerJS multiplayer messages

## Publish with GitHub Pages

1. Create a repository on GitHub.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**, select the `main` branch and `/(root)`, then save.
5. Open the Pages URL shown by GitHub once the site is deployed.

## Play with a friend

1. Both players open the published Pages URL.
2. The host chooses a game and clicks **Create room**.
3. Send the six-character room code to your friend.
4. Your friend enters the room code and clicks **Join room**. The host's selected game loads automatically.
5. Play! For Battleship, both players must deploy all five ships and click **I'm ready**.

## Multiplayer notes

- This is a static site and does not require a custom Node.js server or paid hosting.
- Online rooms rely on PeerJS's public signalling service and browser-to-browser connectivity. Network restrictions or service downtime can prevent connections.
- This is a starter project; clients exchange game messages directly, so it is not designed for ranked or cheat-resistant play.
