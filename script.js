/* Battleship Online — peer-to-peer multiplayer via PeerJS.
   Host a static copy on GitHub Pages; no private server or API key required. */
(() => {
  "use strict";
  const SIZE = 10;
  const SHIPS = [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Destroyer", size: 2 }
  ];
  const $ = (id) => document.getElementById(id);
  const els = {
    lobby: $("lobby"), waiting: $("waitingPanel"), game: $("gamePanel"), miniGame: $("miniGamePanel"),
    modeSelect: $("gameModeSelect"), modeHint: $("gameModeHint"), waitingGame: $("waitingGameLabel"),
    miniTitle: $("miniGameTitle"), miniTurn: $("miniTurnChip"), miniPlayer: $("miniPlayerLabel"),
    miniRoom: $("miniRoomCode"), miniInstruction: $("miniInstruction"), miniBoard: $("miniBoard"),
    miniControls: $("miniControls"), miniLog: $("miniLog"), leaveMini: $("leaveMiniGameBtn"),
    status: $("connectionStatus"), dot: $("statusDot"), lobbyNotice: $("lobbyNotice"),
    create: $("createRoomBtn"), joinForm: $("joinForm"), roomInput: $("roomInput"),
    code: $("roomCodeDisplay"), copy: $("copyCodeBtn"), waitingNotice: $("waitingNotice"),
    cancel: $("cancelRoomBtn"), ownBoard: $("ownBoard"), enemyBoard: $("enemyBoard"),
    ownCols: $("ownCols"), enemyCols: $("enemyCols"), ownRows: $("ownRows"), enemyRows: $("enemyRows"),
    shipSelect: $("shipSelect"), rotate: $("rotateBtn"), random: $("randomBtn"), ready: $("readyBtn"),
    ownCount: $("ownCount"), enemyCount: $("enemyCount"), ownHelp: $("ownHelp"), enemyHelp: $("enemyHelp"),
    title: $("gameTitle"), turn: $("turnChip"), log: $("battleLog"), leave: $("leaveGameBtn"), toast: $("toast")
  };
  let peer = null, conn = null, isHost = false, roomCode = "", connected = false;
  let gameMode = "battleship", localSeat = 0, miniState = null;
  let orientation = "horizontal", readySent = false, opponentReady = false, gameStarted = false, myTurn = false, gameOver = false;
  let fleet = [], shots = [], enemyShots = [], selectedShip = "Carrier", toastTimer = null;
  const placed = new Set();
  const otherFleet = new Map();

  function makeEmptyBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }
  function resetGameState() {
    fleet = []; shots = []; enemyShots = []; otherFleet.clear(); placed.clear();
    orientation = "horizontal"; readySent = false; opponentReady = false; gameStarted = false; myTurn = false; gameOver = false;
    selectedShip = "Carrier"; els.shipSelect.value = selectedShip; updateRotateButton();
  }
  function setStatus(text, online = false) {
    els.status.textContent = text;
    els.dot.classList.toggle("online", online);
  }
  function showToast(text) {
    els.toast.textContent = text; els.toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }
  function showOnly(panel) {
    [els.lobby, els.waiting, els.game, els.miniGame].forEach(p => p.classList.add("hidden"));
    panel.classList.remove("hidden");
  }
  function addLog(text, type = "") {
    const p = document.createElement("p"); p.className = "log-entry";
    if (type) p.classList.add(type);
    p.textContent = text;
    if (els.log.firstElementChild && els.log.firstElementChild.textContent.startsWith("Waiting for")) els.log.innerHTML = "";
    els.log.prepend(p);
  }
  function send(message) {
    if (!conn || !conn.open) { showToast("Connection lost. Return to the lobby and reconnect."); return; }
    conn.send(message);
  }
  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
  }
  function makePeer(id) {
    return new Promise((resolve, reject) => {
      try {
        peer = id ? new Peer(id) : new Peer();
      } catch (e) { reject(e); return; }
      peer.on("open", resolve);
      peer.on("error", err => {
        if (err.type === "unavailable-id") reject(new Error("That room code is already in use. Create another room."));
        else if (err.type === "peer-unavailable") reject(new Error("Room not found. Check the code and try again."));
        else if (err.type === "network" || err.type === "server-error") reject(new Error("Could not reach the multiplayer connection service. Try again."));
        else if (err.type === "browser-incompatible") reject(new Error("This browser does not support the required connection."));
        else console.warn("PeerJS:", err);
      });
      peer.on("disconnected", () => setStatus("Reconnecting…", false));
      peer.on("close", () => setStatus("Disconnected", false));
    });
  }
  function attachConnection(connection) {
    conn = connection;
    conn.on("open", () => {
      connected = true;
      setStatus("Connected", true);
      if (isHost) {
        els.waitingNotice.textContent = "Opponent connected. Preparing match…";
        initModeScreen();
        send({ type: "welcome", roomCode, gameMode });
      }
    });
    conn.on("data", handleMessage);
    conn.on("close", () => {
      connected = false;
      setStatus("Opponent disconnected", false);
      if (!gameOver) showToast("Your opponent disconnected.");
    });
    conn.on("error", err => { console.warn(err); showToast("Connection error. Try reconnecting."); });
  }
  function handleMessage(msg) {
    if (!msg || typeof msg.type !== "string") return;
    switch (msg.type) {
      case "welcome": {
        roomCode = msg.roomCode || roomCode;
        const hostedMode = ["battleship", "tictactoe", "connectfour", "rps"].includes(msg.gameMode) ? msg.gameMode : "battleship";
        if (gameMode !== hostedMode) { gameMode = hostedMode; els.modeSelect.value = gameMode; initModeScreen(); }
        els.waitingGame.textContent = "Game: " + gameName(gameMode);
        els.miniRoom.textContent = roomCode;
        addMiniLog("Connected to room " + roomCode + ".");
        if (gameMode === "battleship") addLog("Connected to room " + roomCode + ".");
        send({ type: "hello" });
        break;
      }
      case "hello":
        if (isHost) {
          send({ type: "opponent-joined" });
          showToast("Opponent joined the room.");
          if (gameMode !== "battleship") startMiniGame();
        }
        break;
      case "opponent-joined":
        els.waitingNotice.textContent = "Opponent connected. Setting up the match…";
        break;
      case "game-start":
        gameStarted = true;
        localSeat = isHost ? 0 : 1;
        miniState = msg.state;
        showOnly(els.miniGame);
        els.miniRoom.textContent = roomCode;
        addMiniLog("Match started. Good luck!");
        renderMiniGame();
        break;
      case "mini-move":
        if (gameMode === "tictactoe" || gameMode === "connectfour") applyBoardMove(1 - localSeat, msg.action, true);
        break;
      case "rps-choice":
        if (gameMode === "rps" && miniState && !miniState.choices[1 - localSeat]) {
          miniState.choices[1 - localSeat] = msg.choice;
          resolveRpsRound();
          renderMiniGame();
        }
        break;
      case "rps-next":
        if (gameMode === "rps" && miniState && !miniState.matchWinner) {
          miniState.readyNext[1 - localSeat] = true;
          tryAdvanceRps();
          renderMiniGame();
        }
        break;
      case "ready":
        opponentReady = true;
        els.enemyCount.textContent = "Fleet ready";
        addLog("Your opponent has deployed their fleet.");
        updateReadyState();
        break;
      case "start":
        gameStarted = true;
        myTurn = msg.firstTurn;
        renderAll();
        updateTurnUI();
        addLog("Both fleets are ready. Battle stations!");
        break;
      case "shot":
        handleIncomingShot(msg.x, msg.y);
        break;
      case "shot-result":
        handleShotResult(msg.x, msg.y, msg.hit, msg.sunk, msg.shipName, msg.winner);
        break;
      case "turn":
        myTurn = true; updateTurnUI();
        break;
      case "opponent-turn":
        myTurn = false; updateTurnUI();
        break;
      case "restart-request":
        showToast("Your opponent asked to restart. Return to the lobby to create a new room.");
        break;
      case "leave":
        connected = false; setStatus("Opponent left", false);
        showToast("Your opponent left the match.");
        break;
    }
  }
  async function createRoom() {
    els.create.disabled = true; els.lobbyNotice.textContent = "Connecting to multiplayer service…";
    try {
      isHost = true; roomCode = randomCode(); gameMode = els.modeSelect.value;
      els.code.textContent = roomCode;
      els.waitingGame.textContent = "Game: " + gameName(gameMode);
      await makePeer("fleet-" + roomCode.toLowerCase());
      setStatus("Room ready", true);
      showOnly(els.waiting);
      peer.on("connection", connection => {
        if (conn && conn.open) { connection.close(); return; }
        attachConnection(connection);
      });
    } catch (err) {
      if (peer) { peer.destroy(); peer = null; }
      setStatus("Not connected", false);
      els.lobbyNotice.textContent = err.message || "Could not create room. Please try again.";
      showToast(els.lobbyNotice.textContent);
    } finally { els.create.disabled = false; }
  }
  async function joinRoom(code) {
    code = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) { showToast("Enter the 6-character room code."); return; }
    els.lobbyNotice.textContent = "Joining room…";
    els.create.disabled = true;
    try {
      isHost = false; roomCode = code; gameMode = els.modeSelect.value;
      await makePeer();
      attachConnection(peer.connect("fleet-" + code.toLowerCase(), { reliable: true }));
      initModeScreen();
      if (gameMode === "battleship") addLog("Joining room " + code + "…");
      else addMiniLog("Joining room " + code + "…");
      setStatus("Connecting…", false);
      // PeerJS can report unavailable after the connection attempt; keep UI responsive.
      setTimeout(() => { if (!connected && !conn?.open) showToast("Still connecting… check the room code if this takes too long."); }, 5000);
    } catch (err) {
      if (peer) { peer.destroy(); peer = null; }
      setStatus("Not connected", false);
      els.lobbyNotice.textContent = err.message || "Could not join room.";
      showToast(els.lobbyNotice.textContent);
    } finally { els.create.disabled = false; }
  }
  function gameName(mode) {
    return ({ battleship: "Battleship", tictactoe: "Tic-Tac-Toe", connectfour: "Connect Four", rps: "Rock Paper Scissors" })[mode] || "Battleship";
  }
  function initModeScreen() {
    if (gameMode === "battleship") {
      initGameScreen();
      return;
    }
    resetGameState();
    miniState = null;
    showOnly(els.miniGame);
    els.miniRoom.textContent = roomCode || "------";
    els.miniTitle.textContent = gameName(gameMode);
    els.miniPlayer.textContent = isHost ? "You are Player 1" : "You are Player 2";
    els.miniBoard.innerHTML = ""; els.miniControls.innerHTML = ""; els.miniLog.innerHTML = "";
    els.miniInstruction.textContent = "Connecting to opponent…";
    els.miniTurn.textContent = "CONNECTING";
    addMiniLog(isHost ? "Room ready. Waiting for your opponent." : "Connecting to host…");
  }
  function addMiniLog(text) {
    if (!els.miniLog) return;
    const p = document.createElement("p"); p.className = "log-entry"; p.textContent = text;
    const first = els.miniLog.firstElementChild;
    if (first && first.textContent.startsWith("Room connected")) els.miniLog.innerHTML = "";
    els.miniLog.prepend(p);
  }
  function startMiniGame() {
    if (!connected || !conn || !conn.open || gameMode === "battleship") return;
    localSeat = 0;
    gameStarted = true; gameOver = false;
    if (gameMode === "tictactoe") miniState = { board: Array(9).fill(null), turn: 0, winner: null, draw: false };
    else if (gameMode === "connectfour") miniState = { board: Array(42).fill(null), turn: 0, winner: null, draw: false };
    else miniState = { round: 1, score: [0, 0], choices: [null, null], roundWinner: null, matchWinner: null, readyNext: [false, false] };
    showOnly(els.miniGame);
    els.miniRoom.textContent = roomCode;
    els.miniTitle.textContent = gameName(gameMode);
    send({ type: "game-start", gameMode, state: miniState });
    addMiniLog("Match started. Good luck!");
    renderMiniGame();
  }
  function boardWinner(board, rows, cols, needed) {
    const directions = [[0,1],[1,0],[1,1],[1,-1]];
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      const mark = board[r*cols+c]; if (!mark) continue;
      for (const [dr,dc] of directions) {
        let count=1;
        for (let k=1;k<needed;k++) {
          const rr=r+dr*k, cc=c+dc*k;
          if (rr<0 || rr>=rows || cc<0 || cc>=cols || board[rr*cols+cc]!==mark) break;
          count++;
        }
        if (count>=needed) return mark;
      }
    }
    return null;
  }
  function applyBoardMove(seat, action, remote) {
    if (!miniState || miniState.winner || miniState.draw || miniState.turn !== seat) return;
    const mark = seat === 0 ? "X" : "O";
    if (gameMode === "tictactoe") {
      const i = Number(action?.index);
      if (!Number.isInteger(i) || i < 0 || i > 8 || miniState.board[i]) return;
      miniState.board[i] = mark;
      miniState.winner = boardWinner(miniState.board,3,3,3);
      miniState.draw = !miniState.winner && miniState.board.every(Boolean);
    } else if (gameMode === "connectfour") {
      const col = Number(action?.col);
      if (!Number.isInteger(col) || col < 0 || col > 6) return;
      let row = -1;
      for (let r=5;r>=0;r--) if (!miniState.board[r*7+col]) { row=r; break; }
      if (row < 0) return;
      miniState.board[row*7+col] = mark;
      miniState.winner = boardWinner(miniState.board,6,7,4);
      miniState.draw = !miniState.winner && miniState.board.every(Boolean);
    }
    if (miniState.winner || miniState.draw) {
      addMiniLog(miniState.winner ? (miniState.winner + " wins the match.") : "It's a draw.");
    } else miniState.turn = 1 - miniState.turn;
    if (!remote) send({ type: "mini-move", action });
    renderMiniGame();
  }
  function resolveRpsRound() {
    if (!miniState || miniState.choices.some(choice => !choice) || miniState.roundWinner !== null) return;
    const [a,b] = miniState.choices;
    let winner = -1;
    if (a !== b) winner = ((a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper")) ? 0 : 1;
    miniState.roundWinner = winner;
    if (winner >= 0) miniState.score[winner]++;
    addMiniLog(winner < 0 ? `Round ${miniState.round}: draw.` : `Round ${miniState.round}: Player ${winner+1} wins.`);
    if (miniState.score[0] >= 2 || miniState.score[1] >= 2 || miniState.round >= 3) {
      miniState.matchWinner = miniState.score[0] === miniState.score[1] ? -1 : (miniState.score[0] > miniState.score[1] ? 0 : 1);
      addMiniLog(miniState.matchWinner < 0 ? "Match ended in a draw." : `Player ${miniState.matchWinner+1} wins the series.`);
    }
  }
  function tryAdvanceRps() {
    if (!miniState || miniState.matchWinner !== null || !miniState.readyNext.every(Boolean)) return;
    miniState.round++;
    miniState.choices = [null, null]; miniState.roundWinner = null; miniState.readyNext = [false, false];
    addMiniLog(`Round ${miniState.round} begins.`);
  }
  function chooseRps(choice) {
    if (!miniState || miniState.choices[localSeat] || miniState.roundWinner !== null || miniState.matchWinner !== null) return;
    miniState.choices[localSeat] = choice;
    send({ type: "rps-choice", choice });
    resolveRpsRound();
    renderMiniGame();
  }
  function renderMiniGame() {
    if (!miniState) {
      els.miniTurn.textContent = connected ? "READY" : "CONNECTING";
      els.miniInstruction.textContent = connected ? "Waiting for the host to start the match…" : "Connecting to your opponent…";
      els.miniBoard.innerHTML = ""; els.miniControls.innerHTML = ""; return;
    }
    els.miniTitle.textContent = gameName(gameMode);
    els.miniPlayer.textContent = isHost ? "Player 1 · X" : "Player 2 · O";
    els.miniBoard.className = "mini-board"; els.miniBoard.innerHTML = ""; els.miniControls.innerHTML = "";
    if (gameMode === "tictactoe" || gameMode === "connectfour") {
      const isTic = gameMode === "tictactoe", rows = isTic ? 3 : 6, cols = isTic ? 3 : 7;
      els.miniBoard.classList.add(isTic ? "tic-board" : "connect-board");
      const ended = !!miniState.winner || miniState.draw;
      if (ended) {
        els.miniTurn.textContent = "MATCH COMPLETE";
        els.miniInstruction.textContent = miniState.draw ? "Draw game. Nobody wins this round." : `${miniState.winner} wins!`;
      } else {
        els.miniTurn.textContent = miniState.turn === localSeat ? "YOUR TURN" : "OPPONENT'S TURN";
        els.miniInstruction.textContent = miniState.turn === localSeat ? (isTic ? "Place your mark in an empty square." : "Drop a token into any column that isn't full.") : "Waiting for your opponent to move…";
      }
      miniState.board.forEach((value, index) => {
        const cell = document.createElement("button"); cell.type = "button"; cell.className = "mini-cell";
        cell.textContent = value || (isTic ? "" : "");
        if (value) cell.classList.add(value === "X" ? "mark-x" : "mark-o");
        const action = isTic ? { index } : { col: index % cols };
        const fullColumn = !isTic && !!miniState.board[index % cols];
        cell.disabled = !gameStarted || ended || miniState.turn !== localSeat || (!!value && isTic) || fullColumn;
        cell.addEventListener("click", () => applyBoardMove(localSeat, action, false));
        els.miniBoard.appendChild(cell);
      });
    } else if (gameMode === "rps") {
      els.miniBoard.classList.add("rps-board");
      els.miniTurn.textContent = miniState.matchWinner !== null ? "MATCH COMPLETE" : `ROUND ${miniState.round} / 3`;
      const score = document.createElement("div"); score.className = "rps-score";
      score.innerHTML = `<div class="score-block"><span>PLAYER 1</span><strong>${miniState.score[0]}</strong></div><div class="score-divider">:</div><div class="score-block"><span>PLAYER 2</span><strong>${miniState.score[1]}</strong></div>`;
      els.miniBoard.appendChild(score);
      if (miniState.matchWinner !== null) {
        els.miniInstruction.textContent = miniState.matchWinner < 0 ? "The series is a draw!" : `Player ${miniState.matchWinner+1} wins the series!`;
      } else if (miniState.roundWinner !== null) {
        els.miniInstruction.textContent = miniState.roundWinner < 0 ? "It's a draw this round!" : `Player ${miniState.roundWinner+1} wins this round!`;
      } else if (miniState.choices[localSeat]) {
        els.miniInstruction.textContent = "Choice locked in. Waiting for opponent to reveal…";
      } else {
        els.miniInstruction.textContent = "Choose rock, paper, or scissors. First to two round wins takes the series.";
      }
      if (miniState.matchWinner === null && miniState.roundWinner === null) {
        const choices = document.createElement("div"); choices.className = "rps-choices";
        [["rock","✊","ROCK"],["paper","✋","PAPER"],["scissors","✌","SCISSORS"]].forEach(([key,emoji,label]) => {
          const btn = document.createElement("button"); btn.type = "button"; btn.className = "rps-choice";
          btn.innerHTML = `<span>${emoji}</span>${label}`; btn.disabled = !!miniState.choices[localSeat]; btn.addEventListener("click", () => chooseRps(key)); choices.appendChild(btn);
        });
        els.miniControls.appendChild(choices);
      } else if (miniState.matchWinner === null) {
        const next = document.createElement("button"); next.type = "button"; next.className = "button primary";
        next.textContent = miniState.readyNext[localSeat] ? "Waiting for opponent…" : "Next round"; next.disabled = miniState.readyNext[localSeat];
        next.addEventListener("click", () => { miniState.readyNext[localSeat] = true; send({ type: "rps-next" }); tryAdvanceRps(); renderMiniGame(); });
        els.miniControls.appendChild(next);
      }
    }
  }
  function initGameScreen() {
    resetGameState();
    showOnly(els.game);
    els.log.innerHTML = "";
    addLog(isHost ? "Room ready. Deploy your fleet." : "Connecting to host. Deploy your fleet once connected.");
    renderAll(); updateReadyState();
  }
  function makeLabels(cols, rows) {
    cols.innerHTML = ""; rows.innerHTML = "";
    for (let i = 0; i < SIZE; i++) {
      const c = document.createElement("span"); c.textContent = String.fromCharCode(65 + i); cols.appendChild(c);
      const r = document.createElement("span"); r.textContent = String(i + 1); rows.appendChild(r);
    }
  }
  function renderAll() {
    makeLabels(els.ownCols, els.ownRows); makeLabels(els.enemyCols, els.enemyRows);
    renderOwnBoard(); renderEnemyBoard(); updateCounts(); updateTurnUI();
  }
  function renderOwnBoard() {
    els.ownBoard.innerHTML = "";
    const grid = makeEmptyBoard();
    fleet.forEach(ship => ship.cells.forEach(([x, y]) => { grid[y][x] = ship.name; }));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement("button"); cell.type = "button"; cell.className = "cell";
      cell.setAttribute("aria-label", `Your waters ${String.fromCharCode(65+x)}${y+1}`);
      if (grid[y][x]) cell.classList.add("own-ship");
      if (enemyShots.some(s => s.x === x && s.y === y)) {
        const shot = enemyShots.find(s => s.x === x && s.y === y);
        cell.classList.add(shot.hit ? "hit" : "miss");
        if (shot.sunk) cell.classList.add("sunk");
      }
      cell.addEventListener("click", () => placeSelectedShip(x, y));
      els.ownBoard.appendChild(cell);
    }
    els.ownBoard.classList.toggle("interactive", !readySent && !gameStarted);
  }
  function renderEnemyBoard() {
    els.enemyBoard.innerHTML = "";
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement("button"); cell.type = "button"; cell.className = "cell";
      cell.setAttribute("aria-label", `Fire at ${String.fromCharCode(65+x)}${y+1}`);
      const shot = shots.find(s => s.x === x && s.y === y);
      if (shot) cell.classList.add(shot.hit ? "hit" : "miss");
      cell.disabled = !gameStarted || !myTurn || gameOver || !!shot;
      cell.addEventListener("click", () => fireAt(x, y));
      els.enemyBoard.appendChild(cell);
    }
    els.enemyBoard.classList.toggle("interactive", gameStarted && myTurn && !gameOver);
  }
  function shipCells(x, y, size, dir = orientation) {
    const cells = [];
    for (let i = 0; i < size; i++) cells.push([x + (dir === "horizontal" ? i : 0), y + (dir === "vertical" ? i : 0)]);
    return cells;
  }
  function canPlace(cells) {
    return cells.every(([x,y]) => x >= 0 && x < SIZE && y >= 0 && y < SIZE &&
      !fleet.some(ship => ship.cells.some(([sx,sy]) => sx === x && sy === y)));
  }
  function placeSelectedShip(x, y) {
    if (readySent || gameStarted) return;
    const ship = SHIPS.find(s => s.name === selectedShip);
    if (!ship || placed.has(ship.name)) { showToast("That ship is already placed. Choose another."); return; }
    const cells = shipCells(x, y, ship.size);
    if (!canPlace(cells)) { showToast("That ship doesn't fit there. Try another spot or rotate it."); return; }
    fleet.push({ name: ship.name, size: ship.size, cells });
    placed.add(ship.name);
    const next = SHIPS.find(s => !placed.has(s.name));
    if (next) { selectedShip = next.name; els.shipSelect.value = next.name; }
    renderOwnBoard(); updateCounts(); updateReadyState();
  }
  function updateRotateButton() { els.rotate.textContent = "Rotate: " + orientation; }
  function randomiseFleet() {
    if (readySent || gameStarted) return;
    fleet = []; placed.clear();
    for (const ship of SHIPS) {
      let success = false, tries = 0;
      while (!success && tries++ < 3000) {
        const dir = Math.random() < .5 ? "horizontal" : "vertical";
        const x = Math.floor(Math.random() * SIZE), y = Math.floor(Math.random() * SIZE);
        const cells = shipCells(x, y, ship.size, dir);
        if (canPlace(cells)) { fleet.push({ ...ship, cells }); placed.add(ship.name); success = true; }
      }
      if (!success) { showToast("Could not place fleet. Try randomising again."); return; }
    }
    const next = SHIPS.find(s => !placed.has(s.name));
    selectedShip = next ? next.name : SHIPS[0].name; els.shipSelect.value = selectedShip;
    renderOwnBoard(); updateCounts(); updateReadyState(); showToast("Fleet deployed.");
  }
  function updateCounts() {
    els.ownCount.textContent = `${fleet.length}/5 ships placed`;
    els.enemyCount.textContent = opponentReady ? "Fleet ready" : "Awaiting opponent";
  }
  function updateReadyState() {
    const allPlaced = fleet.length === SHIPS.length;
    els.ready.disabled = !allPlaced || readySent || gameOver;
    els.ready.textContent = readySent ? "Fleet deployed" : "I'm ready";
    els.ownHelp.textContent = readySent ? "Fleet locked in. Waiting for both players to be ready." : `${fleet.length}/5 ships placed. Select a ship and click a cell, or randomise.`;
    if (readySent && opponentReady && connected && !gameStarted && isHost) {
      gameStarted = true;
      const firstTurn = Math.random() < .5;
      myTurn = firstTurn;
      send({ type: "start", firstTurn: !firstTurn });
      renderAll(); updateTurnUI(); addLog("Both fleets are ready. Battle stations!");
    }
  }
  function updateTurnUI() {
    if (gameOver) {
      els.turn.textContent = "MATCH COMPLETE"; els.title.textContent = "Battle concluded";
      els.enemyHelp.textContent = "The battle is over. Leave the game to return to the lobby.";
    } else if (!gameStarted) {
      els.turn.textContent = "SETUP PHASE"; els.title.textContent = "Prepare your fleet";
      els.enemyHelp.textContent = "Fire here once both fleets are ready.";
    } else if (myTurn) {
      els.turn.textContent = "YOUR TURN"; els.title.textContent = "Engage the enemy";
      els.enemyHelp.textContent = "Select a square on the opponent's grid to fire.";
    } else {
      els.turn.textContent = "OPPONENT'S TURN"; els.title.textContent = "Awaiting enemy fire";
      els.enemyHelp.textContent = "Your opponent is choosing a target.";
    }
    renderEnemyBoard();
  }
  function markSunkCells(targetFleet, x, y) {
    const ship = targetFleet.find(s => s.cells.some(([sx,sy]) => sx === x && sy === y));
    if (!ship) return { sunk: false, shipName: "" };
    const hitsOnShip = ship.cells.every(([sx,sy]) => shots.some(s => s.x === sx && s.y === sy && s.hit));
    return { sunk: hitsOnShip, shipName: ship.name };
  }
  function fireAt(x, y) {
    if (!gameStarted || !myTurn || gameOver || shots.some(s => s.x === x && s.y === y)) return;
    myTurn = false;
    shots.push({ x, y, hit: false });
    send({ type: "shot", x, y });
    updateTurnUI();
    addLog(`Fired at ${String.fromCharCode(65+x)}${y+1}. Waiting for impact…`);
  }
  function handleIncomingShot(x, y) {
    const ship = fleet.find(s => s.cells.some(([sx,sy]) => sx === x && sy === y));
    const hit = !!ship;
    const already = enemyShots.some(s => s.x === x && s.y === y);
    if (already) return;
    const shot = { x, y, hit, sunk: false };
    enemyShots.push(shot);
    let sunk = false, winner = false;
    if (hit) {
      sunk = ship.cells.every(([sx,sy]) => enemyShots.some(s => s.x === sx && s.y === sy && s.hit));
      shot.sunk = sunk;
      if (sunk) addLog(`Your ${ship.name} was sunk!`, "bad");
      else addLog(`Your opponent hit your fleet at ${String.fromCharCode(65+x)}${y+1}.`, "bad");
      winner = fleet.every(s => s.cells.every(([sx,sy]) => enemyShots.some(t => t.x === sx && t.y === sy && t.hit)));
    } else addLog(`Your opponent missed at ${String.fromCharCode(65+x)}${y+1}.`);
    send({ type: "shot-result", x, y, hit, sunk, shipName: ship ? ship.name : "", winner });
    if (winner) {
      gameOver = true; myTurn = false; send({ type: "game-over", winner: "opponent" });
      addLog("Your entire fleet has been sunk. Match lost.", "bad");
    } else {
      // The receiver gets the next turn locally; the shooter remains locked out.
      myTurn = true;
    }
    renderOwnBoard(); updateTurnUI();
  }
  function handleShotResult(x, y, hit, sunk, shipName, winner) {
    const shot = shots.find(s => s.x === x && s.y === y);
    if (!shot) return;
    shot.hit = !!hit; shot.sunk = !!sunk;
    const coord = `${String.fromCharCode(65+x)}${y+1}`;
    if (hit) addLog(sunk ? `Direct hit at ${coord}. Enemy ${shipName} sunk!` : `Direct hit at ${coord}.`, "good");
    else addLog(`Splash at ${coord}. Miss.`, "");
    if (winner) {
      gameOver = true; myTurn = false; addLog("All enemy ships destroyed. Victory!", "good");
      showToast("Victory! You sank the entire enemy fleet.");
    }
    renderEnemyBoard(); updateTurnUI();
  }
  function leaveGame() {
    if (conn && conn.open) send({ type: "leave" });
    if (peer) peer.destroy();
    peer = null; conn = null; connected = false; isHost = false; roomCode = "";
    resetGameState(); miniState = null; gameMode = "battleship"; els.modeSelect.value = gameMode; setStatus("Not connected", false); showOnly(els.lobby);
    els.lobbyNotice.textContent = "Both players need an internet connection. The game uses PeerJS to connect browsers.";
  }

  els.create.addEventListener("click", createRoom);
  els.joinForm.addEventListener("submit", e => { e.preventDefault(); joinRoom(els.roomInput.value); });
  els.copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(roomCode); showToast("Room code copied."); }
    catch { showToast("Your room code is " + roomCode); }
  });
  els.cancel.addEventListener("click", leaveGame);
  els.leave.addEventListener("click", leaveGame);
  els.leaveMini.addEventListener("click", leaveGame);
  const modeHints = {
    battleship: "Deploy your fleet and sink your opponent's ships.",
    tictactoe: "Take turns placing X and O. Get three in a row to win.",
    connectfour: "Drop tokens into the grid. Connect four before your opponent.",
    rps: "Choose rock, paper, or scissors. Best of three rounds."
  };
  els.modeSelect.addEventListener("change", () => { els.modeHint.textContent = modeHints[els.modeSelect.value] || modeHints.battleship; });
  els.shipSelect.addEventListener("change", () => { selectedShip = els.shipSelect.value; });
  els.rotate.addEventListener("click", () => { orientation = orientation === "horizontal" ? "vertical" : "horizontal"; updateRotateButton(); });
  els.random.addEventListener("click", randomiseFleet);
  els.ready.addEventListener("click", () => {
    if (fleet.length !== SHIPS.length || readySent) return;
    readySent = true; send({ type: "ready" }); updateReadyState(); renderOwnBoard();
    addLog("Your fleet is deployed. Waiting for your opponent.");
    if (opponentReady && isHost) updateReadyState();
  });
  // Game-over messages are handled here to keep the turn protocol simple.
  const originalHandler = handleMessage;
  // Keep the browser from leaving a dangling peer when the tab closes.
  window.addEventListener("beforeunload", () => { if (peer) peer.destroy(); });
  makeLabels(els.ownCols, els.ownRows); makeLabels(els.enemyCols, els.enemyRows);
})();