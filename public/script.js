'use strict';
(() => {
  const SIZE = 10;
  const SHIPS = [
    { name: 'Carrier', size: 5 }, { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 }, { name: 'Submarine', size: 3 }, { name: 'Destroyer', size: 2 }
  ];
  const GAME_NAMES = {
    battleship: 'Battleship', tictactoe: 'Tic-Tac-Toe',
    connectfour: 'Connect Four', rps: 'Rock Paper Scissors'
  };
  const GAME_HINTS = {
    battleship: "Deploy your fleet and sink your opponent's ships.",
    tictactoe: 'Get three marks in a row before your opponent.',
    connectfour: 'Drop tokens and connect four in a row.',
    rps: 'Choose rock, paper, or scissors in a best-of-three match.'
  };
  const $ = id => document.getElementById(id);
  const els = {
    lobby: $('lobby'), waiting: $('waitingPanel'), mini: $('miniGamePanel'), battle: $('gamePanel'),
    status: $('connectionStatus'), dot: $('statusDot'), lobbyNotice: $('lobbyNotice'),
    gameSelect: $('gameModeSelect'), gameHint: $('gameModeHint'), create: $('createRoomBtn'),
    joinForm: $('joinForm'), roomInput: $('roomInput'), roomCode: $('roomCodeDisplay'),
    waitingGame: $('waitingGameLabel'), waitingNotice: $('waitingNotice'), copy: $('copyCodeBtn'),
    cancel: $('cancelRoomBtn'), miniTitle: $('miniGameTitle'), miniTurn: $('miniTurnChip'),
    miniPlayer: $('miniPlayerLabel'), miniRoom: $('miniRoomCode'), miniInstruction: $('miniInstruction'),
    miniBoard: $('miniBoard'), miniControls: $('miniControls'), miniLog: $('miniLog'), leaveMini: $('leaveMiniGameBtn'),
    shipSelect: $('shipSelect'), rotate: $('rotateBtn'), random: $('randomBtn'), ready: $('readyBtn'),
    ownCols: $('ownCols'), enemyCols: $('enemyCols'), ownRows: $('ownRows'), enemyRows: $('enemyRows'),
    ownBoard: $('ownBoard'), enemyBoard: $('enemyBoard'), ownCount: $('ownCount'), enemyCount: $('enemyCount'),
    ownHelp: $('ownHelp'), enemyHelp: $('enemyHelp'), gameTitle: $('gameTitle'), turn: $('turnChip'),
    battleLog: $('battleLog'), leaveBattle: $('leaveGameBtn'), toast: $('toast')
  };

  const socket = io({ transports: ['websocket', 'polling'], timeout: 20000 });
  let roomCode = '', currentGame = '', playerIndex = 0, matchActive = false;
  let orientation = 'horizontal', selectedShip = 'Carrier';
  let fleet = [], placed = new Set(), readySent = false;
  let miniState = null, battleState = null, toastTimer = null;
  let previousMyShots = 0, previousIncomingShots = 0;

  function setStatus(text, online = false) {
    els.status.textContent = text;
    els.dot.classList.toggle('online', online);
  }
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
  }
  function showOnly(panel) {
    [els.lobby, els.waiting, els.mini, els.battle].forEach(node => node.classList.add('hidden'));
    panel.classList.remove('hidden');
  }
  function appendLog(container, text, tone = '') {
    const p = document.createElement('p');
    p.className = `log-entry ${tone}`.trim();
    p.textContent = text;
    if (container.firstElementChild && container.firstElementChild.textContent.startsWith('Waiting for')) container.innerHTML = '';
    container.prepend(p);
  }
  function playerName(index) { return index === playerIndex ? 'You' : `Player ${index + 1}`; }
  function setLobbyMessage(message) { els.lobbyNotice.textContent = message; }
  function resetClientState() {
    roomCode = ''; currentGame = ''; playerIndex = 0; matchActive = false;
    orientation = 'horizontal'; selectedShip = 'Carrier'; fleet = []; placed = new Set(); readySent = false;
    miniState = null; battleState = null; previousMyShots = 0; previousIncomingShots = 0;
    els.miniLog.innerHTML = '<p>Room connected. Match starting…</p>';
    els.battleLog.innerHTML = '<p>Waiting for the match to begin…</p>';
    els.shipSelect.value = selectedShip; updateRotateButton();
  }
  function announceGame(game) {
    currentGame = game;
    if (game === 'battleship') showOnly(els.battle);
    else showOnly(els.mini);
    if (game === 'battleship') {
      els.gameTitle.textContent = 'Prepare your fleet';
      els.battleLog.innerHTML = '';
      appendLog(els.battleLog, 'Connected to the room. Deploy your fleet.');
      renderBattle();
    } else {
      els.miniTitle.textContent = GAME_NAMES[game] || 'Online game';
      els.miniRoom.textContent = roomCode;
      els.miniLog.innerHTML = '';
      appendLog(els.miniLog, 'Both players are connected. Have fun!');
      renderMini();
    }
  }

  socket.on('connect', () => setStatus('Connected to game server', true));
  socket.on('disconnect', reason => {
    setStatus('Disconnected — reconnecting…', false);
    if (matchActive) toast('Connection to the game server was lost. The room may have ended.');
    console.warn('Socket disconnected:', reason);
  });
  socket.on('connect_error', () => {
    setStatus('Connecting to server…', false);
    setLobbyMessage('Connecting to the online game server. If this lasts, refresh the page.');
  });
  socket.on('server-ready', () => setLobbyMessage('Server connected. Create a room or join a friend with a room code.'));
  socket.on('arcade-error', data => {
    const message = data && data.message ? data.message : 'Something went wrong.';
    setLobbyMessage(message); toast(message);
    els.create.disabled = false;
  });
  socket.on('room-created', data => {
    roomCode = data.code; currentGame = data.game; playerIndex = 0;
    els.roomCode.textContent = roomCode;
    els.waitingGame.textContent = `Game: ${GAME_NAMES[currentGame] || currentGame}`;
    els.waitingNotice.textContent = 'Waiting for a player to join…';
    setStatus('Room created', true); showOnly(els.waiting);
    els.create.disabled = false;
  });
  socket.on('match-start', data => {
    roomCode = data.code || roomCode;
    currentGame = data.game || currentGame;
    matchActive = true;
    setStatus('In online match', true);
    announceGame(currentGame);
    toast(`${GAME_NAMES[currentGame]} room connected!`);
  });
  socket.on('game-state', data => {
    if (!data) return;
    if (data.player === 0 || data.player === 1) playerIndex = data.player;
    if (data.code) roomCode = data.code;
    if (data.game && !currentGame) currentGame = data.game;
    if (data.game === 'battleship') {
      applyBattleState(data.state || {});
      renderBattle();
    } else {
      miniState = data.state || null;
      if (els.mini.classList.contains('hidden') && matchActive && currentGame !== 'battleship') showOnly(els.mini);
      renderMini();
    }
  });
  socket.on('battle-error', data => toast((data && data.message) || 'Fleet could not be placed.'));
  socket.on('opponent-left', () => {
    matchActive = false;
    setStatus('Opponent left', false);
    toast('Your opponent left the room. Return to the lobby to start another game.');
    if (currentGame !== 'battleship') {
      els.miniInstruction.textContent = 'Your opponent disconnected. Return to the lobby to play again.';
      els.miniControls.innerHTML = '';
    } else els.enemyHelp.textContent = 'Your opponent disconnected. Return to the lobby to play again.';
  });

  els.gameSelect.addEventListener('change', () => { els.gameHint.textContent = GAME_HINTS[els.gameSelect.value] || ''; });
  els.create.addEventListener('click', () => {
    if (!socket.connected) return toast('Still connecting to the game server. Try again in a moment.');
    els.create.disabled = true;
    socket.emit('create-room', { game: els.gameSelect.value });
  });
  els.joinForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!socket.connected) return toast('Still connecting to the game server. Try again in a moment.');
    const code = els.roomInput.value.trim().toUpperCase();
    if (code.length !== 6) return toast('Enter the six-character room code.');
    socket.emit('join-room', { code });
  });
  els.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomCode); toast('Room code copied.'); }
    catch (_) { toast(`Share this code with your friend: ${roomCode}`); }
  });
  els.cancel.addEventListener('click', leaveRoom);
  els.leaveMini.addEventListener('click', leaveRoom);
  els.leaveBattle.addEventListener('click', leaveRoom);

  function leaveRoom() {
    if (socket.connected && roomCode) socket.emit('leave-room');
    resetClientState();
    showOnly(els.lobby); setStatus(socket.connected ? 'Connected to game server' : 'Disconnected', socket.connected);
    setLobbyMessage('Choose a game, create a room, and share its code with a friend.');
    els.create.disabled = false; els.roomInput.value = '';
  }

  // Mini-game rendering and actions
  function renderMini() {
    if (!currentGame || currentGame === 'battleship' || !miniState) return;
    const state = miniState;
    els.miniTitle.textContent = GAME_NAMES[currentGame];
    els.miniRoom.textContent = roomCode || '------';
    els.miniPlayer.textContent = `You are Player ${playerIndex + 1}${currentGame === 'tictactoe' ? ` (${playerIndex === 0 ? 'X' : 'O'})` : ''}`;
    els.miniBoard.innerHTML = ''; els.miniControls.innerHTML = '';
    if (currentGame === 'tictactoe') renderTicTacToe(state);
    else if (currentGame === 'connectfour') renderConnectFour(state);
    else if (currentGame === 'rps') renderRPS(state);
  }
  function resultText(state) {
    if (state.status !== 'finished') return '';
    if (state.winner === null || state.winner === undefined) return 'Draw!';
    return state.winner === playerIndex ? 'You win!' : 'You lose!';
  }
  function setMiniTurn(state, labels = ['Player 1', 'Player 2']) {
    if (state.status === 'finished') {
      const label = resultText(state);
      els.miniTurn.textContent = 'MATCH COMPLETE'; els.miniInstruction.textContent = `${label} Return to the lobby to start another game.`;
    } else {
      els.miniTurn.textContent = state.turn === playerIndex ? 'YOUR TURN' : 'OPPONENT’S TURN';
      els.miniInstruction.textContent = state.turn === playerIndex ? 'Your move — choose a spot.' : `${labels[state.turn]}'s move. Wait for your turn.`;
    }
  }
  function renderTicTacToe(state) {
    els.miniBoard.className = 'mini-board tic-board';
    setMiniTurn(state);
    state.board.forEach((mark, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'mini-cell';
      button.textContent = mark || '';
      if (mark === 'X') button.classList.add('mark-x'); if (mark === 'O') button.classList.add('mark-o');
      button.disabled = state.status !== 'playing' || state.turn !== playerIndex || !!mark;
      button.setAttribute('aria-label', `Square ${index + 1}${mark ? ` ${mark}` : ''}`);
      button.addEventListener('click', () => socket.emit('mini-move', { action: 'tictactoe', index }));
      els.miniBoard.appendChild(button);
    });
  }
  function renderConnectFour(state) {
    els.miniBoard.className = 'mini-board connect-board';
    setMiniTurn(state);
    state.board.forEach((row, y) => row.forEach((mark, x) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'mini-cell';
      if (mark === 'X') button.classList.add('mark-x'); if (mark === 'O') button.classList.add('mark-o');
      button.setAttribute('aria-label', `Column ${x + 1}, row ${y + 1}${mark ? `, ${mark}` : ''}`);
      button.disabled = state.status !== 'playing' || state.turn !== playerIndex || !!state.board[0][x];
      button.addEventListener('click', () => socket.emit('mini-move', { action: 'connectfour', column: x }));
      els.miniBoard.appendChild(button);
    }));
    if (state.status === 'playing') els.miniInstruction.textContent = state.turn === playerIndex ? 'Click any open space in a column to drop your token.' : 'Waiting for your opponent to drop a token.';
  }
  function renderRPS(state) {
    els.miniBoard.className = 'mini-board';
    const score = document.createElement('div'); score.className = 'rps-score';
    score.innerHTML = `<div class="score-block"><strong>${state.scores[0]}</strong><span>PLAYER 1</span></div><div class="score-divider">—</div><div class="score-block"><strong>${state.scores[1]}</strong><span>PLAYER 2</span></div>`;
    els.miniBoard.appendChild(score);
    const choices = state.choices || [null, null];
    const ownChoice = choices[playerIndex];
    const reveal = state.lastResult;
    els.miniTurn.textContent = state.status === 'finished' ? 'MATCH COMPLETE' : state.waitingForNextRound ? 'ROUND RESULT' : `ROUND ${state.round} / 3`;
    if (state.status === 'finished') els.miniInstruction.textContent = `${resultText(state)} Final score: ${state.scores[0]}–${state.scores[1]}. Return to lobby to play again.`;
    else if (state.waitingForNextRound && reveal) {
      const choiceEmoji = { rock: '✊', paper: '✋', scissors: '✌️' };
      const who = reveal.winner === null ? 'Round tied' : reveal.winner === playerIndex ? 'You won this round' : 'Opponent won this round';
      els.miniInstruction.textContent = `${who}: ${choiceEmoji[reveal.choices[0]]} vs ${choiceEmoji[reveal.choices[1]]}.`;
    } else els.miniInstruction.textContent = ownChoice ? 'Choice locked in — waiting for your opponent…' : 'Choose your move. First to two round wins takes the match.';
    const options = [
      { value: 'rock', label: 'Rock', icon: '✊' }, { value: 'paper', label: 'Paper', icon: '✋' }, { value: 'scissors', label: 'Scissors', icon: '✌️' }
    ];
    options.forEach(option => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'rps-choice';
      button.innerHTML = `<span aria-hidden="true">${option.icon}</span>${option.label}`;
      button.disabled = state.status !== 'playing' || !!ownChoice || !!state.waitingForNextRound;
      if (ownChoice === option.value) button.style.borderColor = 'var(--cyan)';
      button.addEventListener('click', () => socket.emit('rps-choose', { choice: option.value }));
      els.miniControls.appendChild(button);
    });
  }

  // Battleship setup, board rendering, and server-authoritative shots
  function makeLabels(cols, rows) {
    cols.innerHTML = ''; rows.innerHTML = '';
    for (let i = 0; i < SIZE; i++) {
      const c = document.createElement('span'); c.textContent = String.fromCharCode(65 + i); cols.appendChild(c);
      const r = document.createElement('span'); r.textContent = String(i + 1); rows.appendChild(r);
    }
  }
  function cellsFor(x, y, size, direction = orientation) {
    return Array.from({ length: size }, (_, i) => [x + (direction === 'horizontal' ? i : 0), y + (direction === 'vertical' ? i : 0)]);
  }
  function canPlace(cells) {
    return cells.every(([x, y]) => x >= 0 && x < SIZE && y >= 0 && y < SIZE &&
      !fleet.some(ship => ship.cells.some(([sx, sy]) => sx === x && sy === y)));
  }
  function placeShip(x, y) {
    if (readySent || battleState?.started) return;
    const spec = SHIPS.find(ship => ship.name === selectedShip);
    if (!spec || placed.has(spec.name)) return toast('That ship is already placed. Select another ship.');
    const cells = cellsFor(x, y, spec.size);
    if (!canPlace(cells)) return toast("That ship doesn't fit there. Try another square or rotate it.");
    fleet.push({ name: spec.name, size: spec.size, cells }); placed.add(spec.name);
    const next = SHIPS.find(ship => !placed.has(ship.name));
    if (next) { selectedShip = next.name; els.shipSelect.value = selectedShip; }
    renderBattle();
  }
  function randomiseFleet() {
    if (readySent || battleState?.started) return;
    fleet = []; placed.clear();
    for (const spec of SHIPS) {
      let done = false, tries = 0;
      while (!done && tries++ < 4000) {
        const direction = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        const x = Math.floor(Math.random() * SIZE), y = Math.floor(Math.random() * SIZE);
        const cells = cellsFor(x, y, spec.size, direction);
        if (canPlace(cells)) { fleet.push({ ...spec, cells }); placed.add(spec.name); done = true; }
      }
      if (!done) return toast('Could not place your fleet. Try again.');
    }
    selectedShip = SHIPS[0].name; els.shipSelect.value = selectedShip;
    renderBattle(); toast('Fleet randomised. Click “I’m ready” when you are happy with it.');
  }
  function updateRotateButton() { els.rotate.textContent = `Rotate: ${orientation}`; }
  function applyBattleState(state) {
    const previous = battleState;
    battleState = state;
    if (Array.isArray(state.myFleet) && state.myFleet.length) {
      fleet = state.myFleet.map(ship => ({ name: ship.name, size: ship.size, cells: ship.cells.map(cell => [...cell]) }));
      placed = new Set(fleet.map(ship => ship.name));
    }
    readySent = !!(state.ready && state.ready[playerIndex]);
    if (previous) {
      const oldMy = Array.isArray(previous.myShots) ? previous.myShots.length : 0;
      const newMy = Array.isArray(state.myShots) ? state.myShots.length : 0;
      if (newMy > oldMy) {
        const shot = state.myShots[newMy - 1];
        const coord = `${String.fromCharCode(65 + shot.x)}${shot.y + 1}`;
        appendLog(els.battleLog, shot.hit ? (shot.sunk ? `Hit at ${coord}. Enemy ${shot.shipName} sunk!` : `Direct hit at ${coord}.`) : `Splash at ${coord}. Miss.` , shot.hit ? 'good' : '');
      }
      const oldIncoming = Array.isArray(previous.incomingShots) ? previous.incomingShots.length : 0;
      const newIncoming = Array.isArray(state.incomingShots) ? state.incomingShots.length : 0;
      if (newIncoming > oldIncoming) {
        const shot = state.incomingShots[newIncoming - 1];
        const coord = `${String.fromCharCode(65 + shot.x)}${shot.y + 1}`;
        appendLog(els.battleLog, shot.hit ? (shot.sunk ? `Your ${shot.shipName} was sunk at ${coord}.` : `Enemy hit your fleet at ${coord}.`) : `Opponent missed at ${coord}.`, shot.hit ? 'bad' : '');
      }
    }
    previousMyShots = (state.myShots || []).length;
    previousIncomingShots = (state.incomingShots || []).length;
    if (state.started && previous && !previous.started) appendLog(els.battleLog, 'Both fleets are ready. Battle stations!');
    if (state.gameOver && (!previous || !previous.gameOver)) {
      appendLog(els.battleLog, state.winner === playerIndex ? 'Victory! You destroyed the entire enemy fleet.' : 'Defeat. Your entire fleet was destroyed.', state.winner === playerIndex ? 'good' : 'bad');
      toast(state.winner === playerIndex ? 'Victory! All enemy ships destroyed.' : 'Defeat — your fleet was sunk.');
    }
  }
  function renderBattle() {
    makeLabels(els.ownCols, els.ownRows); makeLabels(els.enemyCols, els.enemyRows);
    const state = battleState || { ready: [false, false], started: false, turn: 0, gameOver: false, winner: null, myShots: [], incomingShots: [], opponentReady: false };
    const ownGrid = new Map();
    fleet.forEach(ship => ship.cells.forEach(([x, y]) => ownGrid.set(`${x},${y}`, ship.name)));
    els.ownBoard.innerHTML = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell';
      const key = `${x},${y}`;
      if (ownGrid.has(key)) cell.classList.add('own-ship');
      const incoming = (state.incomingShots || []).find(shot => shot.x === x && shot.y === y);
      if (incoming) { cell.classList.add(incoming.hit ? 'hit' : 'miss'); if (incoming.sunk) cell.classList.add('sunk'); }
      cell.setAttribute('aria-label', `Your waters ${String.fromCharCode(65 + x)}${y + 1}`);
      cell.disabled = readySent || state.started;
      cell.addEventListener('click', () => placeShip(x, y));
      els.ownBoard.appendChild(cell);
    }
    els.ownBoard.classList.toggle('interactive', !readySent && !state.started);
    els.enemyBoard.innerHTML = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell';
      const shot = (state.myShots || []).find(item => item.x === x && item.y === y);
      if (shot) { cell.classList.add(shot.hit ? 'hit' : 'miss'); if (shot.sunk) cell.classList.add('sunk'); }
      const canFire = !!state.started && !state.gameOver && state.turn === playerIndex && !shot;
      cell.disabled = !canFire;
      cell.setAttribute('aria-label', `Fire at ${String.fromCharCode(65 + x)}${y + 1}`);
      cell.addEventListener('click', () => { if (canFire) socket.emit('battleship-shot', { x, y }); });
      els.enemyBoard.appendChild(cell);
    }
    els.enemyBoard.classList.toggle('interactive', !!state.started && !state.gameOver && state.turn === playerIndex);
    els.ownCount.textContent = `${fleet.length}/5 ships placed`;
    els.enemyCount.textContent = state.opponentReady ? 'Fleet ready' : (matchActive ? 'Preparing fleet' : 'Awaiting opponent');
    els.ready.disabled = fleet.length !== SHIPS.length || readySent || !!state.started;
    els.ready.textContent = readySent ? 'Fleet deployed' : "I'm ready";
    els.ownHelp.textContent = readySent ? 'Your fleet is locked. Waiting for both players to be ready.' : `${fleet.length}/5 ships placed. Select a ship and click a square, or randomise.`;
    if (state.gameOver) {
      els.turn.textContent = 'MATCH COMPLETE'; els.gameTitle.textContent = 'Battle concluded';
      els.enemyHelp.textContent = state.winner === playerIndex ? 'Victory! All enemy ships have been sunk.' : 'Your fleet was destroyed. Leave to start a new match.';
    } else if (!state.started) {
      els.turn.textContent = 'SETUP PHASE'; els.gameTitle.textContent = 'Prepare your fleet';
      els.enemyHelp.textContent = 'Fire here once both fleets are ready.';
    } else if (state.turn === playerIndex) {
      els.turn.textContent = 'YOUR TURN'; els.gameTitle.textContent = 'Engage the enemy';
      els.enemyHelp.textContent = 'Select a square on the opponent grid to fire.';
    } else {
      els.turn.textContent = "OPPONENT'S TURN"; els.gameTitle.textContent = 'Awaiting enemy fire';
      els.enemyHelp.textContent = 'Your opponent is choosing a target.';
    }
  }
  els.shipSelect.addEventListener('change', () => { selectedShip = els.shipSelect.value; });
  els.rotate.addEventListener('click', () => { orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal'; updateRotateButton(); });
  els.random.addEventListener('click', randomiseFleet);
  els.ready.addEventListener('click', () => {
    if (fleet.length !== SHIPS.length || readySent) return;
    socket.emit('battleship-ready', { fleet });
    readySent = true; renderBattle();
    appendLog(els.battleLog, 'Your fleet is deployed. Waiting for your opponent.');
  });

  makeLabels(els.ownCols, els.ownRows); makeLabels(els.enemyCols, els.enemyRows);
  updateRotateButton();
  window.addEventListener('beforeunload', () => { if (socket.connected && roomCode) socket.emit('leave-room'); });
})();
