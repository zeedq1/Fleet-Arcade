'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  serveClient: true,
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6
});
const PORT = Number(process.env.PORT) || 10000;
const STATIC_DIR = path.join(__dirname, 'public');
const GAME_IDS = [
  'battleship','tictactoe','connectfour','rps','highlow','mathsprint','memory','scramble',
  'hangman','coinflip','dice','nim','connectthree','reversi','wordle','typing','reaction',
  'trivia','penalty','blackjack','codebreaker','oddoneout','sequence','gridconquest','emojiriddle'
];
const VALID_GAMES = new Set(GAME_IDS);
const SHIPS = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 }
];
const rooms = new Map();
const socketRooms = new Map();

app.disable('x-powered-by');
app.use(express.static(STATIC_DIR, { extensions: ['html'] }));
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, rooms: rooms.size }));
app.get('*', (_req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function makeMathQuestion() {
  const op = ['+', '-', '×'][Math.floor(Math.random() * 3)];
  const a = Math.floor(Math.random() * 18) + 2, b = Math.floor(Math.random() * 12) + 2;
  const left = op === '-' ? Math.max(a, b) : a, right = op === '-' ? Math.min(a, b) : b;
  return { question: { a: left, b: right, op }, answer: op === '+' ? left + right : op === '-' ? left - right : left * right };
}
const WORDS = ['planet','orange','button','castle','silver','rocket','forest','puzzle','window','little','bridge','summer','dragon','guitar','pocket','stream','flower','magnet','school','shadow'];
const TRIVIA = [
  { q:'Which planet is known as the Red Planet?', options:['Venus','Mars','Jupiter','Mercury'], answer:1 },
  { q:'How many sides does a hexagon have?', options:['Five','Six','Seven','Eight'], answer:1 },
  { q:'Which ocean is the largest?', options:['Atlantic','Indian','Pacific','Arctic'], answer:2 },
  { q:'What is 9 × 7?', options:['56','63','72','79'], answer:1 },
  { q:'Which animal is a mammal?', options:['Shark','Frog','Dolphin','Trout'], answer:2 },
  { q:'What is the capital of Japan?', options:['Seoul','Tokyo','Beijing','Bangkok'], answer:1 },
  { q:'How many minutes are in two hours?', options:['100','110','120','140'], answer:2 },
  { q:'Which gas do plants take in?', options:['Oxygen','Carbon dioxide','Helium','Hydrogen'], answer:1 },
  { q:'What is the square root of 81?', options:['7','8','9','10'], answer:2 },
  { q:'Which is the closest star to Earth?', options:['Sirius','The Sun','Polaris','Vega'], answer:1 }
];
const RIDDLES = [
  { emojis:'🦁 👑', answer:'lion king' }, { emojis:'🕷️ 👨', answer:'spiderman' },
  { emojis:'🌧️ 🐱 🐶', answer:'raining cats and dogs' }, { emojis:'⭐ ⚔️', answer:'star wars' },
  { emojis:'🧊 👸', answer:'frozen' }, { emojis:'🦇 👨', answer:'batman' },
  { emojis:'🐠 🧡', answer:'finding nemo' }, { emojis:'🕷️ 🕸️', answer:'spider web' }
];
function createMiniState(game) {
  if (game === 'tictactoe') return { board: Array(9).fill(null), turn: 0, status: 'playing', winner: null };
  if (game === 'connectfour') return { board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, status: 'playing', winner: null };
  if (game === 'rps') return { round: 1, scores: [0, 0], choices: [null, null], lastResult: null, turn: null, status: 'playing', winner: null, waitingForNextRound: false };
  if (game === 'highlow') return { target: Math.floor(Math.random()*100)+1, turn: 0, guesses: [], status: 'playing', winner: null, maxGuesses: 14 };
  if (game === 'mathsprint') { const q=makeMathQuestion(); return { ...q, turn: 0, scores:[0,0], round:1, maxRounds:10, status:'playing', winner:null, lastAnswer:null }; }
  if (game === 'memory') { const faces=shuffled(['🐙','🚀','🍉','🦊','🎲','🌈','🦖','🍕','🐙','🚀','🍉','🦊','🎲','🌈','🦖','🍕']); return { cards:faces, matched:[], revealed:[], turn:0, scores:[0,0], status:'playing', winner:null, moves:[0,0] }; }
  if (game === 'scramble') { const answer=WORDS[Math.floor(Math.random()*WORDS.length)]; let scramble=shuffled([...answer]).join(''); while(scramble===answer) scramble=shuffled([...answer]).join(''); return { answer, scramble, turn:0, attempts:[0,0], guesses:[], status:'playing', winner:null, maxAttempts:12 }; }
  if (game === 'hangman') return { word:WORDS[Math.floor(Math.random()*WORDS.length)].toUpperCase(), guessed:[], turn:0, wrong:0, maxWrong:7, status:'playing', winner:null, history:[] };
  if (game === 'coinflip') return { round:1,maxRounds:5,choices:[null,null],scores:[0,0],lastResult:null,waiting:false,status:'playing',winner:null };
  if (game === 'dice') return { turn:0,scores:[0,0],target:30,lastRolls:[null,null],history:[],status:'playing',winner:null };
  if (game === 'nim') return { turn:0,pile:21,history:[],status:'playing',winner:null };
  if (game === 'connectthree') return { board:Array(16).fill(null),turn:0,status:'playing',winner:null };
  if (game === 'reversi') { const board=Array(36).fill(null); board[14]='O';board[21]='O';board[15]='X';board[20]='X'; return {board,turn:0,status:'playing',winner:null,scores:[2,2],passes:0}; }
  if (game === 'wordle') return { target:WORDS[Math.floor(Math.random()*WORDS.length)].toUpperCase(), guesses:[[],[]], status:'playing',winner:null,maxAttempts:6 };
  if (game === 'typing') { const phrase=['SPEED AND ACCURACY WIN THE RACE','QUICK THINKING BEATS FAST CLICKING','THE BLUE SHIP CROSSED THE OCEAN','PRACTICE MAKES PERFECT EVERY TIME'][Math.floor(Math.random()*4)]; return {phrase,progress:[0,0],finished:[false,false],status:'playing',winner:null}; }
  if (game === 'reaction') return {phase:'waiting',startedAt:null,penalty:[false,false],times:[null,null],status:'playing',winner:null};
  if (game === 'trivia') { const q=TRIVIA[Math.floor(Math.random()*TRIVIA.length)]; return {round:1,maxRounds:5,question:q.q,options:q.options,answer:q.answer,answers:[null,null],scores:[0,0],lastResult:null,status:'playing',winner:null,waiting:false,used:[]}; }
  if (game === 'penalty') return {round:1,maxRounds:5,choices:[null,null],scores:[0,0],lastResult:null,waiting:false,status:'playing',winner:null};
  if (game === 'blackjack') return {turn:0,hands:[[randCard(),randCard()],[randCard(),randCard()]],standing:[false,false],busted:[false,false],status:'playing',winner:null};
  if (game === 'codebreaker') { const code=shuffled('0123456789'.split('')).slice(0,4).join(''); return {code,turn:0,attempts:[0,0],history:[],maxAttempts:8,status:'playing',winner:null }; }
  if (game === 'oddoneout') { const puzzle=makeOddOneOut(); return { options:puzzle.options,oddIndex:puzzle.oddIndex,choices:[null,null],scores:[0,0],round:1,maxRounds:5,lastResult:null,waiting:false,status:'playing',winner:null }; }
  if (game === 'sequence') return { sequence:Array.from({length:5},()=>Math.floor(Math.random()*10)).join(''),phase:'memorize',status:'playing',winner:null,attempts:[0,0] };
  if (game === 'gridconquest') return { board:Array(25).fill(null),turn:0,moves:0,scores:[0,0],status:'playing',winner:null };
  if (game === 'emojiriddle') { const r=RIDDLES[Math.floor(Math.random()*RIDDLES.length)]; return { emojis:r.emojis,answer:r.answer,turn:0,attempts:[0,0],history:[],status:'playing',winner:null,maxAttempts:10 }; }
  return null;
}
function randCard() { return [2,3,4,5,6,7,8,9,10,10,10,11][Math.floor(Math.random()*12)]; }
function makeOddOneOut() {
  const sets=[
    {items:['🐶','🐱','🐰','🐹','🚗'],odd:'🚗'},
    {items:['🍎','🍌','🍇','🥕','🍓'],odd:'🥕'},
    {items:['⚽','🏀','🎾','🏈','🍕'],odd:'🍕'},
    {items:['🟦','🟦','🟦','🟥','🟦'],odd:'🟥'},
    {items:['🌞','⭐','🌙','🪐','🍔'],odd:'🍔'}
  ];
  const picked=sets[Math.floor(Math.random()*sets.length)];
  const tokens=picked.items.map((value)=>({value,odd:value===picked.odd}));
  const order=shuffled(tokens); return {options:order.map(t=>t.value),oddIndex:order.findIndex(t=>t.odd)};
}
function publicMiniState(room, index) {
  const state = JSON.parse(JSON.stringify(room.state));
  const other = 1-index;
  if (!state) return state;
  if (room.game === 'highlow' && state.status !== 'finished') delete state.target;
  if (room.game === 'mathsprint') delete state.answer;
  if (room.game === 'memory') state.cards = state.cards.map((v,i) => state.matched.includes(i) || state.revealed.includes(i) ? v : null);
  if (room.game === 'scramble' && state.status !== 'finished') delete state.answer;
  if (room.game === 'hangman') { state.display = [...state.word].map(ch => state.status==='finished' || state.guessed.includes(ch) ? ch : '_').join(' '); if(state.status!=='finished') delete state.word; }
  if (room.game === 'coinflip' && !state.choices.every(Boolean)) state.choices[other] = null;
  if (room.game === 'wordle') { state.ownGuesses = state.guesses[index]; state.opponentGuessCount = state.guesses[other].length; delete state.guesses; if (state.status !== 'finished') delete state.target; }
  if (room.game === 'reaction') delete state.startedAt;
  if (room.game === 'trivia' && !state.answers.every(v=>v!==null)) { delete state.answer; state.answers[other]=null; }
  if (room.game === 'penalty' && !state.choices.every(Boolean)) state.choices[other] = null;
  if (room.game === 'blackjack') { state.myHand=state.hands[index]; state.opponentHandCount=state.hands[other].length; state.opponentStanding=state.standing[other]; state.opponentBusted=state.busted[other]; if(state.status==='finished') state.opponentHand=state.hands[other]; state.hands=undefined; }
  if (room.game === 'codebreaker' && state.status !== 'finished') delete state.code;
  if (room.game === 'oddoneout' && !state.choices.every(v=>v!==null)) { delete state.oddIndex; state.choices[other]=null; }
  if (room.game === 'sequence' && state.phase !== 'memorize' && state.status !== 'finished') delete state.sequence;
  if (room.game === 'emojiriddle' && state.status !== 'finished') delete state.answer;
  return state;
}

function cleanPlayerName(name, fallback) { const value=String(name||'').replace(/[<>\r\n]/g,'').trim().slice(0,18); return value || fallback; }
function createRoom(code, hostId, game, hostName) {
  return {
    code, game, players: [hostId, null], playerNames: [cleanPlayerName(hostName, 'Player 1'), null], createdAt: Date.now(), started: false,
    state: createMiniState(game), ready: [false, false], fleets: [null, null], shots: [[], []],
    turn: 0, gameOver: false, winner: null, rpsTimer: null
  };
}
function playerIndex(room, socket) { return room.players.indexOf(socket.id); }
function sendError(socket, message) { socket.emit('arcade-error', { message }); }
function roomForSocket(socket) {
  const code = socketRooms.get(socket.id);
  return code ? rooms.get(code) : null;
}
function emitRoom(socket) {
  const room = roomForSocket(socket);
  if (!room) return;
  if (room.game === 'battleship') emitBattleshipState(room);
  else emitMiniState(room);
}
function emitMiniState(room) {
  room.players.forEach((id, index) => {
    if (id) io.to(id).emit('game-state', {
      game: room.game,
      code: room.code,
      player: index,
      opponentConnected: room.players.every(Boolean),
      playerNames: [...room.playerNames],
      playerName: room.playerNames[index] || `Player ${index+1}`,
      opponentName: room.playerNames[1-index] || 'Opponent',
      state: publicMiniState(room, index)
    });
  });
}
function emitBattleshipState(room) {
  room.players.forEach((id, index) => {
    if (!id) return;
    io.to(id).emit('game-state', {
      game: room.game,
      code: room.code,
      player: index,
      opponentConnected: room.players.every(Boolean),
      playerNames: [...room.playerNames],
      playerName: room.playerNames[index] || `Player ${index+1}`,
      opponentName: room.playerNames[1-index] || 'Opponent',
      state: {
        ready: [...room.ready],
        started: room.started,
        turn: room.turn,
        gameOver: room.gameOver,
        winner: room.winner,
        myFleet: room.fleets[index] || null,
        myShots: room.shots[index],
        incomingShots: room.shots[1 - index],
        opponentReady: room.ready[1 - index]
      }
    });
  });
}
function startBattleIfReady(room) {
  if (room.ready.every(Boolean) && !room.started) {
    room.started = true;
    room.turn = Math.random() < 0.5 ? 0 : 1;
    io.to(room.code).emit('battle-started');
  }
  emitBattleshipState(room);
}
function validFleet(rawFleet) {
  if (!Array.isArray(rawFleet) || rawFleet.length !== SHIPS.length) return null;
  const allCells = new Set();
  const clean = [];
  for (const spec of SHIPS) {
    const source = rawFleet.find(s => s && s.name === spec.name);
    if (!source || !Array.isArray(source.cells) || source.cells.length !== spec.size) return null;
    const cells = [];
    for (const pair of source.cells) {
      if (!Array.isArray(pair) || pair.length !== 2) return null;
      const [x, y] = pair;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 9 || y < 0 || y > 9) return null;
      const key = `${x},${y}`;
      if (allCells.has(key)) return null;
      allCells.add(key); cells.push([x, y]);
    }
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const sameX = xs.every(x => x === xs[0]);
    const sameY = ys.every(y => y === ys[0]);
    if (!sameX && !sameY) return null;
    if (sameX) {
      const sorted = ys.slice().sort((a, b) => a - b);
      if (!sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)) return null;
    } else {
      const sorted = xs.slice().sort((a, b) => a - b);
      if (!sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)) return null;
    }
    clean.push({ name: spec.name, size: spec.size, cells });
  }
  return clean;
}
function sendBattleError(socket, message) { socket.emit('battle-error', { message }); }
function hasHitAllCells(room, player) {
  const enemyFleet = room.fleets[1 - player];
  const enemyCellSet = new Set(enemyFleet.flatMap(ship => ship.cells.map(([x, y]) => `${x},${y}`)));
  const hits = new Set(room.shots[player].filter(s => s.hit).map(s => `${s.x},${s.y}`));
  for (const key of enemyCellSet) if (!hits.has(key)) return false;
  return true;
}
function fourInLine(board, row, col, player) {
  const directions = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dy, dx] of directions) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let y = row + dy * sign, x = col + dx * sign;
      while (y >= 0 && y < 6 && x >= 0 && x < 7 && board[y][x] === player) {
        count++; y += dy * sign; x += dx * sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}
function hasLine(board, width, height, x, y, mark, needed) {
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for(const [dx,dy] of dirs){let n=1;for(const sign of [-1,1]){let xx=x+dx*sign,yy=y+dy*sign;while(xx>=0&&xx<width&&yy>=0&&yy<height&&board[yy*width+xx]===mark){n++;xx+=dx*sign;yy+=dy*sign;}}if(n>=needed)return true;} return false;
}
function reversiFlips(board, index, mark) {
  const size=6, x=index%size, y=Math.floor(index/size), other=mark==='X'?'O':'X', dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]], flips=[];
  if(board[index]) return [];
  for(const [dx,dy] of dirs){let xx=x+dx,yy=y+dy,line=[];while(xx>=0&&xx<size&&yy>=0&&yy<size&&board[yy*size+xx]===other){line.push(yy*size+xx);xx+=dx;yy+=dy;}if(line.length&&xx>=0&&xx<size&&yy>=0&&yy<size&&board[yy*size+xx]===mark)flips.push(...line);}
  return [...new Set(flips)];
}
function finishGrid(room) {
  const s=room.state; s.scores=[s.board.filter(v=>v===0).length,s.board.filter(v=>v===1).length];
  s.status='finished'; s.winner=s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1);
}
function startTimedGame(room) {
  if(room.game==='reaction'){
    clearTimeout(room.rpsTimer);
    room.rpsTimer=setTimeout(()=>{if(!rooms.has(room.code)||room.state.status!=='playing')return;room.state.phase='go';room.state.startedAt=Date.now();emitMiniState(room);},1800+Math.random()*2800);
  } else if(room.game==='sequence') {
    clearTimeout(room.rpsTimer);
    room.rpsTimer=setTimeout(()=>{if(!rooms.has(room.code)||room.state.status!=='playing')return;room.state.phase='recall';emitMiniState(room);},2600);
  }
}
function scheduleNextConcurrentRound(room) {
  clearTimeout(room.rpsTimer);
  room.rpsTimer=setTimeout(()=>{
    if(!rooms.has(room.code)||room.state.status!=='playing')return;
    const s=room.state;
    if(room.game==='coinflip'){
      if(s.round>=s.maxRounds){s.status='finished';s.winner=s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1);}
      else {s.round++;s.choices=[null,null];s.waiting=false;s.lastResult=null;}
    } else if(room.game==='trivia'){
      if(s.round>=s.maxRounds){s.status='finished';s.winner=s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1);}
      else {let idx;do{idx=Math.floor(Math.random()*TRIVIA.length)}while(s.used.includes(idx)&&s.used.length<TRIVIA.length);s.used.push(idx);const q=TRIVIA[idx];s.round++;s.question=q.q;s.options=q.options;s.answer=q.answer;s.answers=[null,null];s.waiting=false;s.lastResult=null;}
    } else if(room.game==='penalty'){
      if(s.round>=s.maxRounds){s.status='finished';s.winner=s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1);}
      else {s.round++;s.choices=[null,null];s.waiting=false;s.lastResult=null;}
    } else if(room.game==='oddoneout'){
      if(s.round>=s.maxRounds){s.status='finished';s.winner=s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1);}
      else {const p=makeOddOneOut();s.round++;s.options=p.options;s.oddIndex=p.oddIndex;s.choices=[null,null];s.waiting=false;s.lastResult=null;}
    }
    emitMiniState(room);
  },1900);
}
function finishMiniIfDraw(room) {
  if (room.game === 'tictactoe') {
    if (room.state.board.every(Boolean) && room.state.status === 'playing') {
      room.state.status = 'finished'; room.state.winner = null;
    }
  } else if (room.game === 'connectfour') {
    if (room.state.board.every(row => row.every(Boolean)) && room.state.status === 'playing') {
      room.state.status = 'finished'; room.state.winner = null;
    }
  }
}

io.on('connection', socket => {
  socket.emit('server-ready', { ok: true });

  socket.on('create-room', (payload = {}) => {
    if (socketRooms.has(socket.id)) return sendError(socket, 'Leave your current room before creating another.');
    const game = String(payload.game || 'battleship');
    if (!VALID_GAMES.has(game)) return sendError(socket, 'That game mode is not available.');
    let code;
    do { code = makeCode(); } while (rooms.has(code));
    const room = createRoom(code, socket.id, game, payload.name);
    rooms.set(code, room); socketRooms.set(socket.id, code); socket.join(code);
    socket.emit('room-created', { code, game });
  });

  socket.on('join-room', (payload = {}) => {
    if (socketRooms.has(socket.id)) return sendError(socket, 'Leave your current room before joining another.');
    const code = String(payload.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room) return sendError(socket, 'Room not found. Check the six-character code and try again.');
    if (room.players[1] || room.players[0] === socket.id) return sendError(socket, 'That room is already full. Ask your friend to create a new room.');
    room.players[1] = socket.id;
    room.playerNames[1] = cleanPlayerName(payload.name, 'Player 2');
    if (room.game !== 'battleship') room.started = true;
    socketRooms.set(socket.id, code); socket.join(code);
    io.to(code).emit('match-start', { game: room.game, code });
    if (room.game === 'battleship') emitBattleshipState(room); else { if (room.game === 'reaction' || room.game === 'sequence') startTimedGame(room); emitMiniState(room); }
  });

  socket.on('mini-move', (payload = {}) => {
    const room = roomForSocket(socket); if (!room || !room.started || room.gameOver) return;
    const player = playerIndex(room, socket); if (player < 0) return;
    const state = room.state;
    if (!state || state.status !== 'playing' || state.turn !== player) return;
    if (room.game === 'tictactoe' && payload.action === 'tictactoe') {
      const index = Number(payload.index);
      if (!Number.isInteger(index) || index < 0 || index > 8 || state.board[index]) return;
      state.board[index] = player === 0 ? 'X' : 'O';
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const mark = state.board[index];
      const won = wins.some(line => line.every(i => state.board[i] === mark));
      if (won) { state.status = 'finished'; state.winner = player; }
      else { state.turn = 1 - player; finishMiniIfDraw(room); }
      emitMiniState(room);
    } else if (room.game === 'connectfour' && payload.action === 'connectfour') {
      const col = Number(payload.column);
      if (!Number.isInteger(col) || col < 0 || col > 6) return;
      let row = -1;
      for (let y = 5; y >= 0; y--) if (!state.board[y][col]) { row = y; break; }
      if (row < 0) return;
      state.board[row][col] = player === 0 ? 'X' : 'O';
      if (fourInLine(state.board, row, col, player === 0 ? 'X' : 'O')) { state.status = 'finished'; state.winner = player; }
      else { state.turn = 1 - player; finishMiniIfDraw(room); }
      emitMiniState(room);
    }
  });

  socket.on('rps-choose', (payload = {}) => {
    const room = roomForSocket(socket); if (!room || room.game !== 'rps' || !room.started) return;
    const player = playerIndex(room, socket); const state = room.state;
    const choice = String(payload.choice || '').toLowerCase();
    if (player < 0 || state.status !== 'playing' || state.waitingForNextRound || !['rock','paper','scissors'].includes(choice) || state.choices[player]) return;
    state.choices[player] = choice;
    // Keep the opponent's selection private until both have picked.
    room.players.forEach((id, index) => {
      if (id) io.to(id).emit('game-state', {
        game: room.game, code: room.code, player: index, opponentConnected: true,
        state: { ...state, choices: state.choices.map((v, i) => i === index ? v : (state.choices.every(Boolean) ? v : null)) }
      });
    });
    if (state.choices.every(Boolean)) {
      const [a, b] = state.choices;
      const winner = a === b ? null : ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper') ? 0 : 1);
      state.lastResult = { choices: [...state.choices], winner, round: state.round };
      if (winner !== null) state.scores[winner]++;
      state.waitingForNextRound = true;
      emitMiniState(room);
      clearTimeout(room.rpsTimer);
      room.rpsTimer = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        if (state.scores.some(score => score >= 2) || state.round >= 3) {
          state.status = 'finished';
          state.winner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
        } else {
          state.round++;
          state.choices = [null, null];
          state.waitingForNextRound = false;
        }
        emitMiniState(room);
      }, 1700);
    }
  });

  socket.on('arcade-action', (payload = {}) => {
    const room=roomForSocket(socket); if(!room||!room.started||room.gameOver) return;
    const player=playerIndex(room,socket), s=room.state, g=room.game;
    if(player<0||!s||s.status!=='playing') return;
    const action=String(payload.action||'');
    const finish=(winner)=>{s.status='finished';s.winner=winner;room.gameOver=true;emitMiniState(room);};
    const nextTurn=()=>{s.turn=1-player;emitMiniState(room);};
    const text=String(payload.value??'').trim();
    if(g==='highlow'&&action==='guess'&&s.turn===player){
      const n=Number(text);if(!Number.isInteger(n)||n<1||n>100)return sendError(socket,'Enter a whole number from 1 to 100.');
      s.guesses.push({player,guess:n,clue:n===s.target?'Correct!':n<s.target?'Higher':'Lower'});
      if(n===s.target){finish(player);return;} if(s.guesses.length>=s.maxGuesses){finish(null);return;} nextTurn();
    } else if(g==='mathsprint'&&action==='answer'&&s.turn===player){
      const n=Number(text);if(!Number.isFinite(n)||text==='')return sendError(socket,'Enter a number.');const correct=n===s.answer;
      s.lastAnswer={player,value:n,correct};if(correct)s.scores[player]++;if(s.round>=s.maxRounds){finish(s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1));return;}
      const q=makeMathQuestion();s.question=q.question;s.answer=q.answer;s.round++;nextTurn();
    } else if(g==='memory'&&action==='flip'){
      const i=Number(payload.index);if(!Number.isInteger(i)||i<0||i>=16||s.matched.includes(i)||s.revealed.includes(i)||s.turn!==player||s.revealed.length>=2)return;
      s.revealed.push(i);s.moves[player]++;
      if(s.revealed.length===2){const [a,b]=s.revealed;if(s.cards[a]===s.cards[b]){s.matched.push(a,b);s.scores[player]++;s.revealed=[];if(s.matched.length===16){finish(s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1));return;} }else{emitMiniState(room);room.rpsTimer=setTimeout(()=>{if(!rooms.has(room.code))return;s.state.revealed=[];s.state.turn=1-player;emitMiniState(room);},900);return;}}
      emitMiniState(room);
    } else if(g==='scramble'&&action==='guess'&&s.turn===player){
      s.attempts[player]++;s.guesses.push({player,guess:text.toLowerCase(),correct:text.toLowerCase()===s.answer});if(text.toLowerCase()===s.answer){finish(player);return;}if(s.attempts[0]+s.attempts[1]>=s.maxAttempts){finish(null);return;}nextTurn();
    } else if(g==='hangman'&&action==='letter'&&s.turn===player){
      const letter=String(payload.value||'').toUpperCase();if(!/^[A-Z]$/.test(letter)||s.guessed.includes(letter))return;
      s.guessed.push(letter);const hit=s.word.includes(letter);if(!hit)s.wrong++;s.history.push({player,letter,hit});
      if([...s.word].every(ch=>s.guessed.includes(ch))){finish(player);return;}if(s.wrong>=s.maxWrong){finish(null);return;}nextTurn();
    } else if(g==='coinflip'&&action==='choose'){
      const choice=String(payload.value||'');if(!['heads','tails'].includes(choice)||s.choices[player]||s.waiting)return;s.choices[player]=choice;
      if(s.choices.every(Boolean)){const coin=Math.random()<.5?'heads':'tails';const winners=[];s.choices.forEach((c,i)=>{if(c===coin)winners.push(i)});winners.forEach(i=>s.scores[i]++);s.lastResult={coin,choices:[...s.choices],winners};s.waiting=true;if(s.round>=s.maxRounds){scheduleNextConcurrentRound(room);}else scheduleNextConcurrentRound(room);}
      emitMiniState(room);
    } else if(g==='dice'&&action==='roll'&&s.turn===player){const roll=Math.floor(Math.random()*6)+1;s.lastRolls[player]=roll;s.scores[player]+=roll;s.history.push({player,roll,total:s.scores[player]});if(s.scores[player]>=s.target){finish(player);return;}nextTurn();
    } else if(g==='nim'&&action==='take'&&s.turn===player){const n=Number(payload.value);if(!Number.isInteger(n)||n<1||n>3||n>s.pile)return sendError(socket,'Take 1, 2, or 3 stones, up to the amount remaining.');s.pile-=n;s.history.push({player,take:n,remaining:s.pile});if(s.pile===0){finish(player);return;}nextTurn();
    } else if(g==='connectthree'&&action==='place'&&s.turn===player){const i=Number(payload.index);if(!Number.isInteger(i)||i<0||i>=16||s.board[i])return;s.board[i]=player===0?'X':'O';if(hasLine(s.board,4,4,i%4,Math.floor(i/4),s.board[i],3)){finish(player);return;}if(s.board.every(Boolean)){finish(null);return;}nextTurn();
    } else if(g==='reversi'&&action==='place'&&s.turn===player){const i=Number(payload.index),mark=player===0?'X':'O';if(!Number.isInteger(i)||i<0||i>=36)return;const flips=reversiFlips(s.board,i,mark);if(!flips.length)return sendError(socket,'That square is not a legal Reversi move.');s.board[i]=mark;flips.forEach(k=>s.board[k]=mark);s.scores=[s.board.filter(v=>v==='X').length,s.board.filter(v=>v==='O').length];s.passes=0;const next=1-player, nextMark=next===0?'X':'O';const hasNext=s.board.some((v,k)=>!v&&reversiFlips(s.board,k,nextMark).length);if(!hasNext){const hasCurrent=s.board.some((v,k)=>!v&&reversiFlips(s.board,k,mark).length);if(!hasCurrent||s.board.every(Boolean)){finish(s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1));return;}s.turn=player;}else{s.turn=next;}emitMiniState(room);
    } else if(g==='wordle'&&action==='guess'){
      const guess=text.toUpperCase();if(!/^[A-Z]{6}$/.test(guess)||s.guesses[player].length>=s.maxAttempts)return sendError(socket,'Enter a six-letter word.');const target=s.target;const feedback=[...guess].map((ch,i)=>ch===target[i]?'correct':target.includes(ch)?'present':'absent');s.guesses[player].push({guess,feedback});if(guess===target){finish(player);return;}if(s.guesses.every(list=>list.length>=s.maxAttempts)){finish(null);return;}emitMiniState(room);
    } else if(g==='typing'&&action==='finish'){const typed=text.toUpperCase().replace(/\s+/g,' ').trim();const phrase=s.phrase;if(typed!==phrase)return sendError(socket,'Keep typing until the phrase matches exactly.');if(s.finished[player])return;s.finished[player]=true;s.progress[player]=100;finish(player);
    } else if(g==='reaction'&&action==='tap'){
      if(s.phase!=='go'){s.penalty[player]=true;emitMiniState(room);return sendError(socket,'Too early! Wait until the green signal.');}if(s.times[player]!==null)return;const elapsed=Date.now()-s.startedAt;s.times[player]=elapsed;if(s.times.every(v=>v!==null)){finish(s.times[0]===s.times[1]?null:(s.times[0]<s.times[1]?0:1));return;}emitMiniState(room);
    } else if(g==='trivia'&&action==='answer'){
      const n=Number(payload.value);if(!Number.isInteger(n)||n<0||n>=s.options.length||s.answers[player]!==null||s.waiting)return;s.answers[player]=n;
      if(s.answers.every(v=>v!==null)){s.answers.forEach((v,i)=>{if(v===s.answer)s.scores[i]++});s.lastResult={answers:[...s.answers],correct:s.answer};s.waiting=true;scheduleNextConcurrentRound(room);}emitMiniState(room);
    } else if(g==='penalty'&&action==='kick'){
      const shot=String(payload.shot||''),dive=String(payload.dive||'');const dirs=['left','centre','right'];if(!dirs.includes(shot)||!dirs.includes(dive)||s.choices[player]||s.waiting)return;s.choices[player]={shot,dive};if(s.choices.every(Boolean)){const goals=[0,0];for(let i=0;i<2;i++)if(s.choices[i].shot!==s.choices[1-i].dive)goals[i]++;s.scores[0]+=goals[0];s.scores[1]+=goals[1];s.lastResult={choices:s.choices.map(v=>({...v})),goals};s.waiting=true;scheduleNextConcurrentRound(room);}emitMiniState(room);
    } else if(g==='blackjack'&&(action==='hit'||action==='stand')&&s.turn===player){if(s.standing[player]||s.busted[player])return;if(action==='hit'){s.hands[player].push(randCard());if(s.hands[player].reduce((a,b)=>a+b,0)>21)s.busted[player]=true;}else s.standing[player]=true;
      if(s.standing[player]||s.busted[player]){const other=1-player;if(!(s.standing[other]||s.busted[other]))s.turn=other;else{const totals=s.hands.map((h,i)=>s.busted[i]?0:h.reduce((a,b)=>a+b,0));finish(totals[0]===totals[1]?null:(totals[0]>totals[1]?0:1));return;}}emitMiniState(room);
    } else if(g==='codebreaker'&&action==='guess'&&s.turn===player){const guess=text;if(!/^\d{4}$/.test(guess)||new Set(guess).size!==4)return sendError(socket,'Enter four different digits, like 3816.');let exact=0,misplaced=0;for(let i=0;i<4;i++){if(guess[i]===s.code[i])exact++;else if(s.code.includes(guess[i]))misplaced++;}s.attempts[player]++;s.history.push({player,guess,exact,misplaced});if(exact===4){finish(player);return;}if(s.attempts[0]+s.attempts[1]>=s.maxAttempts){finish(null);return;}nextTurn();
    } else if(g==='oddoneout'&&action==='pick'){const i=Number(payload.index);if(!Number.isInteger(i)||i<0||i>=s.options.length||s.choices[player]!==null||s.waiting)return;s.choices[player]=i;if(s.choices.every(v=>v!==null)){s.choices.forEach((v,idx)=>{if(v===s.oddIndex)s.scores[idx]++});s.lastResult={oddIndex:s.oddIndex,choices:[...s.choices]};s.waiting=true;scheduleNextConcurrentRound(room);}emitMiniState(room);
    } else if(g==='sequence'&&action==='recall'){if(s.phase!=='recall'||s.attempts[player]>=3)return;const n=text.replace(/\s/g,'');s.attempts[player]++;if(n===s.sequence){finish(player);return;}if(s.attempts.every(v=>v>=3)){finish(null);return;}emitMiniState(room);sendError(socket,'Not quite — try to remember the sequence.');
    } else if(g==='gridconquest'&&action==='claim'&&s.turn===player){const i=Number(payload.index);if(!Number.isInteger(i)||i<0||i>=25||s.board[i]!==null)return;s.board[i]=player;s.moves++;s.scores[player]++;if(s.moves>=25){finish(s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1));return;}nextTurn();
    } else if(g==='emojiriddle'&&action==='guess'&&s.turn===player){const guess=text.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();s.attempts[player]++;const answer=s.answer.toLowerCase();s.history.push({player,guess,correct:guess===answer});if(guess===answer){finish(player);return;}if(s.attempts[0]+s.attempts[1]>=s.maxAttempts){finish(null);return;}nextTurn();
    }
  });

  socket.on('battleship-ready', (payload = {}) => {
    const room = roomForSocket(socket); if (!room || room.game !== 'battleship' || !room.players.every(Boolean)) return;
    const player = playerIndex(room, socket);
    if (player < 0 || room.ready[player] || room.started) return;
    const fleet = validFleet(payload.fleet);
    if (!fleet) return sendBattleError(socket, 'Fleet placement is invalid. Check all five ships and try again.');
    room.fleets[player] = fleet; room.ready[player] = true;
    startBattleIfReady(room);
  });

  socket.on('battleship-shot', (payload = {}) => {
    const room = roomForSocket(socket); if (!room || room.game !== 'battleship' || !room.started || room.gameOver) return;
    const player = playerIndex(room, socket), x = Number(payload.x), y = Number(payload.y);
    if (player < 0 || player !== room.turn || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 9 || y < 0 || y > 9) return;
    if (room.shots[player].some(s => s.x === x && s.y === y)) return;
    const targetFleet = room.fleets[1 - player];
    const hitShip = targetFleet.find(ship => ship.cells.some(([sx, sy]) => sx === x && sy === y));
    const shot = { x, y, hit: !!hitShip, sunk: false, shipName: hitShip ? hitShip.name : '' };
    room.shots[player].push(shot);
    if (hitShip) {
      shot.sunk = hitShip.cells.every(([sx, sy]) => room.shots[player].some(s => s.x === sx && s.y === sy && s.hit));
    }
    if (hasHitAllCells(room, player)) { room.gameOver = true; room.winner = player; }
    else room.turn = 1 - player;
    emitBattleshipState(room);
  });

  socket.on('leave-room', () => leaveSocketRoom(socket, true));
  socket.on('disconnect', () => leaveSocketRoom(socket, false));
});

function leaveSocketRoom(socket, informOpponent) {
  const code = socketRooms.get(socket.id);
  if (!code) return;
  const room = rooms.get(code);
  socketRooms.delete(socket.id);
  if (room) {
    clearTimeout(room.rpsTimer);
    if (informOpponent) socket.to(code).emit('opponent-left');
    else socket.to(code).emit('opponent-left');
    room.players.forEach((id) => { if (id) socketRooms.delete(id); });
    rooms.delete(code);
  }
  socket.leave(code);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Fleet Arcade listening on port ${PORT}`);
});
