'use strict';
(() => {
  const SIZE = 10;
  const SHIPS = [
    { name: 'Carrier', size: 5 }, { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 }, { name: 'Submarine', size: 3 }, { name: 'Destroyer', size: 2 }
  ];
  const GAME_NAMES = {
    battleship:'Battleship',tictactoe:'Tic-Tac-Toe',connectfour:'Connect Four',rps:'Rock Paper Scissors',
    highlow:'Higher or Lower',mathsprint:'Math Sprint',memory:'Memory Match',scramble:'Word Scramble',hangman:'Hangman Duel',
    coinflip:'Coin Flip',dice:'Dice Duel',nim:'Nim Pile',connectthree:'Connect Three',reversi:'Reversi',wordle:'Wordle Race',
    typing:'Typing Race',reaction:'Reaction Test',trivia:'Trivia Duel',penalty:'Penalty Shootout',blackjack:'Blackjack Duel',
    codebreaker:'Code Breaker',oddoneout:'Odd One Out',sequence:'Sequence Recall',gridconquest:'Grid Conquest',emojiriddle:'Emoji Riddle'
  };
  const GAME_HINTS = {
    battleship:"Deploy your fleet and sink your opponent's ships.",tictactoe:'Get three marks in a row before your opponent.',
    connectfour:'Drop tokens and connect four in a row.',rps:'Choose rock, paper, or scissors in a best-of-three match.',
    highlow:'Take turns guessing a secret number between 1 and 100.',mathsprint:'Solve ten maths questions correctly to outscore your friend.',
    memory:'Flip cards and find matching pairs. The highest pair count wins.',scramble:'Unscramble a word before your opponent guesses it.',
    hangman:'Take turns guessing letters to solve the hidden word.',coinflip:'Pick heads or tails in five rounds.',dice:'Roll dice and race to 30 points.',
    nim:'Take 1–3 stones per turn. Take the last stone to win.',connectthree:'Place X or O and connect three on a 4×4 board.',
    reversi:'Capture lines of discs and finish with the most of your colour.',wordle:'Race to solve the same six-letter word in six guesses.',
    typing:'Type the exact phrase before your opponent.',reaction:'Wait for the green signal, then click as fast as you can.',
    trivia:'Answer five general-knowledge questions and beat your opponent.',penalty:'Pick your shot and your goalkeeper dive over five rounds.',
    blackjack:'Hit or stand and get closer to 21 than your opponent without busting.',codebreaker:'Crack a secret four-digit code using exact and misplaced clues.',
    oddoneout:'Spot the item that does not belong. Best score after five rounds wins.',sequence:'Memorise a number sequence, then type it back correctly.',
    gridconquest:'Claim open squares and control the most territory on a 5×5 grid.',emojiriddle:'Decode the emoji clue before your opponent.'
  };
  const GAME_META = [
    ['battleship','⚓','strategy','Classic naval strategy'],['tictactoe','✕','strategy','Quick tactical duel'],['connectfour','🔴','strategy','Connect four in a row'],['rps','✊','party','Best-of-three showdown'],
    ['highlow','🔢','puzzle','Number guessing duel'],['mathsprint','➗','puzzle','Solve the equations'],['memory','🧠','puzzle','Match hidden pairs'],['scramble','🔤','words','Unscramble the word'],['hangman','🪢','words','Guess letters to solve it'],
    ['coinflip','🪙','party','Five rounds of luck'],['dice','🎲','party','Roll your way to 30'],['nim','🪨','strategy','Take the final stone'],['connectthree','⭕','strategy','Three-in-a-row grid'],['reversi','⚫','strategy','Flip and control discs'],['wordle','🟩','words','Guess the six-letter word'],
    ['typing','⌨️','speed','First to type it perfectly'],['reaction','⚡','speed','Test your reaction time'],['trivia','❓','puzzle','Five-question quiz'],['penalty','🥅','party','Shoot and save penalties'],['blackjack','🃏','party','Get closer to 21'],
    ['codebreaker','🔐','puzzle','Crack the four-digit code'],['oddoneout','👀','puzzle','Find the odd item'],['sequence','🔢','puzzle','Memorise the number sequence'],['gridconquest','🟦','strategy','Claim grid territory'],['emojiriddle','🤔','words','Decode the emoji clue']
  ].map(([id,icon,category,tagline])=>({id,icon,category,tagline,name:GAME_NAMES[id]}));
  const $ = id => document.getElementById(id);
  const els = {
    lobby: $('lobby'), waiting: $('waitingPanel'), mini: $('miniGamePanel'), battle: $('gamePanel'),
    status: $('connectionStatus'), dot: $('statusDot'), lobbyNotice: $('lobbyNotice'),
    gameSelect: $('gameModeSelect'), gameHint: $('gameModeHint'), gameSearch: $('gameSearch'), categoryFilter: $('categoryFilter'), gameCatalog: $('gameCatalog'), randomGame: $('randomGameBtn'), favoritesOnly: $('favoritesOnlyBtn'), playerName: $('playerNameInput'), soundToggle: $('soundToggle'), copyInvite: $('copyInviteBtn'), create: $('createRoomBtn'),
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
  let playerNames = ['Player 1','Player 2'];
  let localPlayerName = '';
  let soundEnabled = true;
  let autoJoinAttempted = false;
  try { localPlayerName = localStorage.getItem('fleetArcadeName') || ''; } catch (_) {}
  try { soundEnabled = localStorage.getItem('fleetArcadeSound') !== 'off'; } catch (_) {}
  let showFavoritesOnly = false;
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem('fleetArcadeFavorites') || '[]')); } catch (_) { favorites = new Set(); }

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
  function playerName(index) { return playerNames[index] || (index === playerIndex ? (localPlayerName || 'You') : `Player ${index + 1}`); }
  function getDisplayName() { return (els.playerName.value || localPlayerName || '').trim().slice(0,18); }
  function playSound(kind='tap') {
    if (!soundEnabled) return;
    try { const AudioCtx=window.AudioContext||window.webkitAudioContext; if(!AudioCtx)return; const ctx=new AudioCtx(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); const frequencies={tap:440,win:740,loss:180,move:520}; osc.frequency.value=frequencies[kind]||440; osc.type='sine'; gain.gain.setValueAtTime(0.035,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12); osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.13);osc.onended=()=>ctx.close(); } catch (_) {}
  }
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
  socket.on('server-ready', () => {
    setLobbyMessage('Server connected. Create a room or join a friend with a room code.');
    const inviteCode = new URLSearchParams(window.location.search).get('room');
    if (inviteCode && !autoJoinAttempted) { autoJoinAttempted=true; els.roomInput.value=inviteCode.toUpperCase().slice(0,6); socket.emit('join-room',{code:els.roomInput.value,name:getDisplayName()}); }
  });
  socket.on('arcade-error', data => {
    const message = data && data.message ? data.message : 'Something went wrong.';
    setLobbyMessage(message); toast(message);
    els.create.disabled = false;
    if (matchActive && currentGame && currentGame !== 'battleship' && miniState && miniState.status === 'playing') renderMini();
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
    toast(`${GAME_NAMES[currentGame]} room connected!`); playSound('move');
  });
  socket.on('game-state', data => {
    if (!data) return;
    if (data.player === 0 || data.player === 1) playerIndex = data.player;
    if (Array.isArray(data.playerNames)) playerNames = data.playerNames;
    if (data.code) roomCode = data.code;
    if (data.game && !currentGame) currentGame = data.game;
    if (data.game === 'battleship') {
      const wasOver = !!(battleState && battleState.gameOver);
      applyBattleState(data.state || {});
      renderBattle();
      if (!wasOver && battleState && battleState.gameOver) playSound(battleState.winner === playerIndex ? 'win' : 'loss');
    } else {
      const wasFinished = !!(miniState && miniState.status === 'finished');
      miniState = data.state || null;
      if (els.mini.classList.contains('hidden') && matchActive && currentGame !== 'battleship') showOnly(els.mini);
      renderMini();
      if (!wasFinished && miniState && miniState.status === 'finished') playSound(miniState.winner === null ? 'tap' : miniState.winner === playerIndex ? 'win' : 'loss');
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
  function renderGameCatalog() {
    if (!els.gameCatalog) return;
    const query = (els.gameSearch.value || '').trim().toLowerCase();
    const category = els.categoryFilter.value;
    const filtered = GAME_META.filter(g => (!query || `${g.name} ${g.tagline} ${g.category}`.toLowerCase().includes(query)) &&
      (category === 'all' || g.category === category) && (!showFavoritesOnly || favorites.has(g.id)));
    els.gameCatalog.innerHTML = '';
    if (!filtered.length) { const empty = document.createElement('p'); empty.className='catalog-empty'; empty.textContent = showFavoritesOnly ? 'No favourites yet. Tap the ☆ on a game card to save it.' : 'No games match that search.'; els.gameCatalog.appendChild(empty); return; }
    filtered.forEach(game => {
      const card = document.createElement('article'); card.className = 'game-card' + (els.gameSelect.value===game.id?' selected':'');
      const pick = document.createElement('button'); pick.type='button'; pick.className='game-card-pick'; pick.setAttribute('aria-label',`Select ${game.name}`);
      const icon = document.createElement('span'); icon.className='game-card-icon'; icon.textContent=game.icon;
      const name = document.createElement('strong'); name.textContent=game.name;
      const tag = document.createElement('span'); tag.className='game-card-tagline'; tag.textContent=game.tagline;
      const foot=document.createElement('span');foot.className='game-card-foot';foot.innerHTML=`<span>${game.category.toUpperCase()}</span><span>2 PLAYERS</span>`;
      pick.append(icon,name,tag,foot); pick.addEventListener('click',()=>{els.gameSelect.value=game.id;els.gameHint.textContent=GAME_HINTS[game.id];renderGameCatalog();});
      const fav=document.createElement('button');fav.type='button';fav.className='favorite-toggle';fav.textContent=favorites.has(game.id)?'★':'☆';fav.title=favorites.has(game.id)?'Remove from favourites':'Add to favourites';fav.setAttribute('aria-label',fav.title);fav.setAttribute('aria-pressed',String(favorites.has(game.id)));
      fav.addEventListener('click',e=>{e.stopPropagation();if(favorites.has(game.id))favorites.delete(game.id);else favorites.add(game.id);try{localStorage.setItem('fleetArcadeFavorites',JSON.stringify([...favorites]));}catch(_){}renderGameCatalog();});
      card.append(pick,fav);els.gameCatalog.appendChild(card);
    });
  }
  els.gameSearch.addEventListener('input', renderGameCatalog);
  els.categoryFilter.addEventListener('change', renderGameCatalog);
  els.favoritesOnly.addEventListener('click',()=>{showFavoritesOnly=!showFavoritesOnly;els.favoritesOnly.setAttribute('aria-pressed',String(showFavoritesOnly));els.favoritesOnly.textContent=showFavoritesOnly?'★ Favorites':'☆ Favorites';renderGameCatalog();});
  els.randomGame.addEventListener('click',()=>{const choice=GAME_META[Math.floor(Math.random()*GAME_META.length)];els.gameSelect.value=choice.id;els.gameHint.textContent=GAME_HINTS[choice.id];renderGameCatalog();toast(`Random pick: ${choice.name}`);});
  els.gameSelect.addEventListener('change',renderGameCatalog);
  if (els.playerName) { els.playerName.value=localPlayerName; els.playerName.addEventListener('input',()=>{localPlayerName=els.playerName.value.slice(0,18);try{localStorage.setItem('fleetArcadeName',localPlayerName);}catch(_){} }); }
  function updateSoundButton(){ if(els.soundToggle){els.soundToggle.textContent=soundEnabled?'🔊 Sound on':'🔇 Sound off';els.soundToggle.setAttribute('aria-pressed',String(soundEnabled));} }
  updateSoundButton();
  els.soundToggle.addEventListener('click',()=>{soundEnabled=!soundEnabled;try{localStorage.setItem('fleetArcadeSound',soundEnabled?'on':'off');}catch(_){}updateSoundButton();if(soundEnabled)playSound('tap');});
  els.copyInvite.addEventListener('click',async()=>{const url=new URL(window.location.href);url.searchParams.set('room',roomCode);try{await navigator.clipboard.writeText(url.toString());toast('Invite link copied — send it to your friend.');}catch(_){toast(`Share this invite link: ${url.toString()}`);}});
  renderGameCatalog();

  els.create.addEventListener('click', () => {
    if (!socket.connected) return toast('Still connecting to the game server. Try again in a moment.');
    els.create.disabled = true;
    socket.emit('create-room', { game: els.gameSelect.value, name: getDisplayName() });
  });
  els.joinForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!socket.connected) return toast('Still connecting to the game server. Try again in a moment.');
    const code = els.roomInput.value.trim().toUpperCase();
    if (code.length !== 6) return toast('Enter the six-character room code.');
    socket.emit('join-room', { code, name: getDisplayName() });
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
    els.miniPlayer.textContent = `You are ${playerNames[playerIndex] || `Player ${playerIndex + 1}`}${currentGame === 'tictactoe' ? ` (${playerIndex === 0 ? 'X' : 'O'})` : ''}`;
    els.miniBoard.innerHTML = ''; els.miniControls.innerHTML = '';
    if (currentGame === 'tictactoe') renderTicTacToe(state);
    else if (currentGame === 'connectfour') renderConnectFour(state);
    else if (currentGame === 'rps') renderRPS(state);
    else renderAdvancedGame(state);
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

  // Twenty-one extra games share a server-validated action protocol.
  function action(type, data={}) { socket.emit('arcade-action', { action:type, ...data }); }
  function addActionButton(label, onClick, disabled=false, extra='') {
    const b=document.createElement('button');b.type='button';b.className=`button secondary ${extra}`.trim();b.textContent=label;b.disabled=disabled;b.addEventListener('click',onClick);els.miniControls.appendChild(b);return b;
  }
  function addField(placeholder, type='text', maxLength=40) {
    const wrap=document.createElement('form');wrap.className='arcade-input-row';const field=document.createElement('input');field.type=type;field.placeholder=placeholder;field.maxLength=maxLength;field.autocomplete='off';field.required=true;
    if(type==='number') field.step='1';
    const submit=document.createElement('button');submit.type='submit';submit.className='button primary';submit.textContent='Submit';wrap.append(field,submit);
    wrap.addEventListener('submit',e=>{e.preventDefault();const value=field.value.trim();if(value){wrap.querySelector('button').disabled=true;wrap.querySelector('input').disabled=true;wrap.dataset.submitted='true';wrap.dispatchEvent(new CustomEvent('arcade-submit',{bubbles:true,detail:{value}}));}});
    wrap.addEventListener('arcade-submit',e=>{});
    els.miniControls.appendChild(wrap);return wrap;
  }
  function addInputAction(placeholder, inputType, maxLength, handler) {
    const wrap=addField(placeholder,inputType,maxLength);wrap.addEventListener('arcade-submit',e=>handler(e.detail.value));return wrap;
  }
  function statusFor(state) {
    if(state.status==='finished') return resultText(state);
    if(state.turn===undefined||state.turn===null) return 'Play your move when ready.';
    return state.turn===playerIndex?'Your turn.':'Opponent’s turn.';
  }
  function renderAdvancedGame(state) {
    els.miniBoard.className='mini-board advanced-board';
    const heading=document.createElement('div');heading.className='advanced-heading';
    const prompt=document.createElement('div');prompt.className='advanced-prompt';
    const detail=document.createElement('div');detail.className='advanced-detail';
    els.miniBoard.append(heading,prompt,detail);
    const ownTurn=state.turn===playerIndex;
    const finished=state.status==='finished';
    function setPrompt(text, sub='') { if (finished && prompt.textContent) return; prompt.textContent=text;detail.textContent=sub; }
    function grid(values,cols,draw,disabledFn) {
      const board=document.createElement('div');board.className='advanced-grid';board.style.gridTemplateColumns=`repeat(${cols}, minmax(0,1fr))`;
      values.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.className='advanced-cell';b.textContent=draw(v,i);b.disabled=finished||disabledFn(v,i);b.addEventListener('click',()=>action(gameActionForGrid(),{index:i}));board.appendChild(b);});els.miniBoard.appendChild(board);return board;
    }
    function gameActionForGrid(){return ({memory:'flip',connectthree:'place',reversi:'place',gridconquest:'claim',oddoneout:'pick'})[currentGame]||'place';}
    function addList(lines) { const box=document.createElement('div');box.className='advanced-history';lines.forEach(t=>{const row=document.createElement('p');row.textContent=t;box.appendChild(row)});els.miniBoard.appendChild(box); }
    function addParagraph(text,cls='') {const p=document.createElement('p');p.className=`advanced-copy ${cls}`.trim();p.textContent=text;els.miniBoard.appendChild(p);}
    heading.textContent=GAME_NAMES[currentGame].toUpperCase();
    if(finished){setPrompt(resultText(state), state.winner===null?'The match ended in a draw.':'Match complete — start another room to play again.');}
    else if(['highlow','mathsprint','scramble','hangman','dice','nim','connectthree','reversi','emojiriddle'].includes(currentGame)) setPrompt(ownTurn?'YOUR TURN':'OPPONENT’S TURN', statusFor(state));
    else setPrompt('LIVE MATCH', statusFor(state));

    switch(currentGame){
      case 'highlow':
        setPrompt('Guess the secret number','Choose from 1–100. Each turn gives a higher or lower clue.');
        addParagraph(`Guesses used: ${state.guesses.length} / ${state.maxGuesses}`);
        if(ownTurn&&!finished){const f=addInputAction('Enter a number','number',3,v=>action('guess',{value:v}));f.querySelector('input').min='1';f.querySelector('input').max='100';}
        addList((state.guesses||[]).slice(-7).reverse().map(g=>`${playerName(g.player)} guessed ${g.guess} — ${g.clue}`));if(finished&&state.target)addParagraph(`Secret number: ${state.target}`);break;
      case 'mathsprint':
        setPrompt(`${state.question.a} ${state.question.op} ${state.question.b} = ?`, `Question ${state.round} of ${state.maxRounds} · Score ${state.scores[0]} — ${state.scores[1]}`);
        if(ownTurn&&!finished)addInputAction('Your answer','number',5,v=>action('answer',{value:v}));
        if(state.lastAnswer)addParagraph(`${playerName(state.lastAnswer.player)} answered ${state.lastAnswer.value}: ${state.lastAnswer.correct?'correct':'not quite'}.`);break;
      case 'memory':
        setPrompt('Find matching pairs',`Pairs: ${state.scores[0]} — ${state.scores[1]} · Moves: ${(state.moves||[]).join(' — ')}`);
        grid(state.cards,4,(v,i)=>v||'?',(v,i)=>!ownTurn||state.matched.includes(i)||(state.revealed||[]).includes(i)||state.revealed.length>=2);
        els.miniBoard.querySelectorAll('.advanced-cell').forEach((b,i)=>{if(state.matched.includes(i))b.classList.add('matched');if(state.revealed.includes(i))b.classList.add('revealed');});break;
      case 'scramble':
        setPrompt(state.scramble.toUpperCase(),`Unscramble the ${state.scramble.length}-letter word · Attempts ${(state.attempts||[]).reduce((a,b)=>a+b,0)}/${state.maxAttempts}`);
        if(ownTurn&&!finished)addInputAction('Type the word','text',20,v=>action('guess',{value:v.toLowerCase()}));
        addList((state.guesses||[]).slice(-8).reverse().map(g=>`${playerName(g.player)}: ${g.guess} ${g.correct?'✓':'✕'}`));if(finished&&state.answer)addParagraph(`Answer: ${state.answer.toUpperCase()}`);break;
      case 'hangman': {
        setPrompt(state.display||'',`Wrong guesses: ${state.wrong}/${state.maxWrong} · Guessed: ${(state.guessed||[]).join(' ')||'none'}`);
        const keys=document.createElement('div');keys.className='letter-keyboard';'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter=>{const b=document.createElement('button');b.type='button';b.className='button secondary';b.textContent=letter;b.disabled=finished||!ownTurn||state.guessed.includes(letter);b.addEventListener('click',()=>action('letter',{value:letter}));keys.appendChild(b)});els.miniControls.appendChild(keys);if(finished&&state.word)addParagraph(`Word: ${state.word}`);break; }
      case 'coinflip':
        setPrompt(`Round ${state.round} / ${state.maxRounds}`,`Score: ${state.scores[0]} — ${state.scores[1]}`);
        if(!finished&&!state.waiting&&!state.choices[playerIndex]){addActionButton('🪙 Heads',()=>action('choose',{value:'heads'}));addActionButton('🪙 Tails',()=>action('choose',{value:'tails'}));}
        if(state.waiting&&state.lastResult)addParagraph(`Coin: ${state.lastResult.coin.toUpperCase()} · Picks ${state.lastResult.choices.join(' / ')}`);else addParagraph(state.choices[playerIndex]?'Choice locked in — waiting for your opponent.':'Pick heads or tails.');break;
      case 'dice':
        setPrompt(`Race to ${state.target} points`,`Totals: ${state.scores[0]} — ${state.scores[1]}`);
        if(ownTurn&&!finished)addActionButton('🎲 Roll the dice',()=>action('roll'));
        addList((state.history||[]).slice(-7).reverse().map(h=>`${playerName(h.player)} rolled ${h.roll} (total ${h.total})`));break;
      case 'nim':
        setPrompt(`${state.pile} stones remaining`,'Take 1, 2, or 3 stones. Whoever takes the last stone wins.');
        if(ownTurn&&!finished)[1,2,3].filter(n=>n<=state.pile).forEach(n=>addActionButton(`Take ${n}`,()=>action('take',{value:n})));
        addList((state.history||[]).slice(-7).reverse().map(h=>`${playerName(h.player)} took ${h.take}; ${h.remaining} remain`));break;
      case 'connectthree':
        setPrompt('Connect three',`You are ${playerIndex===0?'X':'O'} · X goes first`);
        grid(state.board,4,v=>v||'·',v=>!!v||!ownTurn);break;
      case 'reversi':
        setPrompt('Reversi',`You are ${playerIndex===0?'X':'O'} · Score ${state.scores[0]} — ${state.scores[1]}`);
        grid(state.board,6,v=>v==='X'?'●':v==='O'?'○':'·',(v,i)=>!!v||!ownTurn);
        els.miniBoard.querySelectorAll('.advanced-cell').forEach((b,i)=>{if(state.board[i]==='X')b.classList.add('disc-x');if(state.board[i]==='O')b.classList.add('disc-o');});break;
      case 'wordle':
        setPrompt('Find the six-letter word',`Six guesses · Your guesses: ${(state.ownGuesses||[]).length}/6 · Opponent guesses: ${state.opponentGuessCount||0}`);
        addParagraph('🟩 correct letter and place · 🟨 letter exists · ⬛ not in the word','wordle-guide');
        if(!finished&&(state.ownGuesses||[]).length<6)addInputAction('Enter a six-letter word','text',6,v=>action('guess',{value:v}));
        (state.ownGuesses||[]).forEach(item=>{const row=document.createElement('div');row.className='wordle-row';[...item.guess].forEach((ch,i)=>{const tile=document.createElement('span');tile.className=`wordle-tile ${item.feedback[i]}`;tile.textContent=ch;row.appendChild(tile)});els.miniBoard.appendChild(row)});
        if(finished&&state.target)addParagraph(`Word: ${state.target}`);break;
      case 'typing':
        setPrompt('Type this phrase exactly',state.phrase);
        if(!finished&&!state.finished[playerIndex]){const wrap=addInputAction('Type the full phrase','text',140,v=>action('finish',{value:v}));const input=wrap.querySelector('input');input.value='';input.focus();}
        addParagraph(`Status: You ${state.finished[playerIndex]?'finished':'are racing'} · Opponent ${state.finished[1-playerIndex]?'finished':'is racing'}`);break;
      case 'reaction':
        if(state.phase==='waiting')setPrompt('Wait for green…','Do not click early. The signal appears at a random time.');
        else setPrompt('TAP NOW!',`Click as fast as you can${state.penalty[playerIndex]?' · Early click recorded':''}`);
        if(!finished&&state.times[playerIndex]===null)addActionButton(state.phase==='go'?'⚡ TAP NOW':'Wait for signal',()=>action('tap'),state.phase!=='go','reaction-button');
        addParagraph(`Your time: ${state.times[playerIndex]===null?'—':state.times[playerIndex]+' ms'} · Opponent: ${state.times[1-playerIndex]===null?'—':state.times[1-playerIndex]+' ms'}`);break;
      case 'trivia':
        setPrompt(`Question ${state.round}/${state.maxRounds}`,state.question);
        addParagraph(`Score: ${state.scores[0]} — ${state.scores[1]}`);
        if(!finished&&!state.waiting&&state.answers[playerIndex]===null)state.options.forEach((option,i)=>addActionButton(`${String.fromCharCode(65+i)}. ${option}`,()=>action('answer',{value:i})));
        if(state.waiting&&state.lastResult)addParagraph(`Correct answer: ${state.options[state.lastResult.correct]}`);else if(state.answers[playerIndex]!==null)addParagraph('Answer submitted — waiting for your opponent.');break;
      case 'penalty': {
        setPrompt(`Penalty shootout · Round ${state.round}/${state.maxRounds}`,`Goals: ${state.scores[0]} — ${state.scores[1]}`);
        if(!finished&&!state.waiting&&!state.choices[playerIndex]){
          const shot=document.createElement('select');shot.className='choice-select';shot.innerHTML='<option value="">Choose shot direction</option><option value="left">Shoot left</option><option value="centre">Shoot centre</option><option value="right">Shoot right</option>';
          const dive=document.createElement('select');dive.className='choice-select';dive.innerHTML='<option value="">Choose goalkeeper dive</option><option value="left">Dive left</option><option value="centre">Stay centre</option><option value="right">Dive right</option>';
          const submit=document.createElement('button');submit.type='button';submit.className='button primary';submit.textContent='Take penalty';submit.disabled=true;const enable=()=>submit.disabled=!(shot.value&&dive.value);shot.addEventListener('change',enable);dive.addEventListener('change',enable);submit.addEventListener('click',()=>action('kick',{shot:shot.value,dive:dive.value}));els.miniControls.append(shot,dive,submit);
        } else if(!finished)addParagraph('Your choices are locked. Waiting for your opponent.');
        if(state.waiting&&state.lastResult)addParagraph(`Round result: ${state.lastResult.goals[0]} — ${state.lastResult.goals[1]}`);break; }
      case 'blackjack': {
        const myTotal=(state.myHand||[]).reduce((a,b)=>a+b,0);
        setPrompt('Blackjack Duel',`Your hand: ${(state.myHand||[]).join(' + ')} = ${myTotal} · Opponent cards: ${state.status==='finished'?(state.opponentHand||[]).join(' + '):state.opponentHandCount}`);
        addParagraph(state.busted[playerIndex]?'You busted.':state.standing[playerIndex]?'You stand.':state.turn===playerIndex?'Hit or stand?':'Opponent is playing.');
        if(!finished&&state.turn===playerIndex&&!state.standing[playerIndex]&&!state.busted[playerIndex]){addActionButton('Hit',()=>action('hit'));addActionButton('Stand',()=>action('stand'));}
        if(finished)addParagraph(`Result: ${state.winner===null?'Draw':state.winner===playerIndex?'You win':'You lose'}`);break; }
      case 'codebreaker':
        setPrompt('Crack the four-digit code',`Turn ${playerIndex===state.turn?'yours':'opponent’s'} · Attempts ${state.attempts[0]} — ${state.attempts[1]}`);
        addParagraph('Exact = right digit and place. Misplaced = right digit, wrong place. All digits are unique.');
        if(ownTurn&&!finished)addInputAction('Four unique digits','text',4,v=>action('guess',{value:v}));
        addList((state.history||[]).slice(-8).reverse().map(h=>`${playerName(h.player)}: ${h.guess} — ${h.exact} exact, ${h.misplaced} misplaced`));if(finished&&state.code)addParagraph(`Code: ${state.code}`);break;
      case 'oddoneout':
        setPrompt(`Odd One Out · Round ${state.round}/${state.maxRounds}`,`Score: ${state.scores[0]} — ${state.scores[1]}`);
        if(!finished&&!state.waiting&&state.choices[playerIndex]===null)grid(state.options,5,v=>v,()=>false);
        if(state.waiting&&state.lastResult)addParagraph(`Odd item: ${state.options[state.lastResult.oddIndex]}`);break;
      case 'sequence':
        if(state.phase==='memorize')setPrompt('Memorise this sequence',state.sequence);
        else setPrompt('Repeat the sequence',`Attempts used: ${state.attempts[playerIndex]}/3`);
        if(!finished&&state.phase==='recall'&&state.attempts[playerIndex]<3)addInputAction('Type the digits in order','text',12,v=>action('recall',{value:v}));
        if(finished&&state.sequence)addParagraph(`Sequence: ${state.sequence}`);break;
      case 'gridconquest':
        setPrompt('Claim the grid',`You are Player ${playerIndex+1} · Score ${state.scores[0]} — ${state.scores[1]}`);
        grid(state.board,5,v=>v===0?'●':v===1?'○':'·',v=>v!==null||!ownTurn);
        els.miniBoard.querySelectorAll('.advanced-cell').forEach((b,i)=>{if(state.board[i]===0)b.classList.add('territory-x');if(state.board[i]===1)b.classList.add('territory-o');});break;
      case 'emojiriddle':
        setPrompt(state.emojis,'What word, character, film, or phrase do these emojis suggest?');
        if(ownTurn&&!finished)addInputAction('Your answer','text',60,v=>action('guess',{value:v}));
        addList((state.history||[]).slice(-7).reverse().map(h=>`${playerName(h.player)} guessed “${h.guess}” ${h.correct?'✓':'✕'}`));if(finished&&state.answer)addParagraph(`Answer: ${state.answer}`);break;
    }
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
