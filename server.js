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
const VALID_GAMES = new Set(['battleship', 'tictactoe', 'connectfour', 'rps']);
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
function createMiniState(game) {
  if (game === 'tictactoe') return { board: Array(9).fill(null), turn: 0, status: 'playing', winner: null };
  if (game === 'connectfour') return { board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, status: 'playing', winner: null };
  if (game === 'rps') return { round: 1, scores: [0, 0], choices: [null, null], lastResult: null, turn: null, status: 'playing', winner: null, waitingForNextRound: false };
  return null;
}
function createRoom(code, hostId, game) {
  return {
    code, game, players: [hostId, null], createdAt: Date.now(), started: false,
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
      state: room.state
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
    const room = createRoom(code, socket.id, game);
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
    if (room.game !== 'battleship') room.started = true;
    socketRooms.set(socket.id, code); socket.join(code);
    io.to(code).emit('match-start', { game: room.game, code });
    if (room.game === 'battleship') emitBattleshipState(room); else emitMiniState(room);
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
