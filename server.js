const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e6, pingInterval: 25000, pingTimeout: 20000 });
const PORT = process.env.PORT || 10000;
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();
const MAX_PLAYERS = 8;
const MAX_ROUNDS = 5;
const ALLOWED_MODES = new Set(['versus', 'coop']);
const ID_RE = /^[a-z0-9-]{2,70}$/;
app.disable('x-powered-by');
app.use(express.static(PUBLIC, { etag: true, maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'fleet-arcade', rooms: rooms.size, time: Date.now() }));
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
function cleanName(value) { const s = String(value || 'Player').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18); return s || 'Player'; }
function code() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)]; return out; }
function publicRoom(room) { return { code: room.code, gameId: room.gameId, mode: room.mode, hostId: room.hostId, players: [...room.players.values()].map(p => ({ id:p.id, name:p.name, isHost:p.id===room.hostId, score:room.scores.get(p.id)||0, submitted:!!room.submissions[p.id] })), started:room.started, round:room.round, hasResults:!!room.results, maxPlayers:MAX_PLAYERS }; }
function emitRoom(room) { io.to(room.code).emit('room:update', publicRoom(room)); }
function clearRoundTimer(room) { if(room.roundTimer)clearTimeout(room.roundTimer); room.roundTimer=null; }
function finalizeRound(room) {
  if(!room || room.results || !room.started)return;
  clearRoundTimer(room);
  const rows = [...room.players.values()].map(p => {
    const sub = room.submissions[p.id] || {points:0,elapsedMs:0,correct:false,answer:'',timedOut:true};
    const pts = Math.max(0, Math.min(1000, Math.round(Number(sub.points)||0)));
    room.scores.set(p.id, (room.scores.get(p.id)||0)+pts);
    return {id:p.id,name:p.name,points:pts,total:room.scores.get(p.id),elapsedMs:Math.max(0,Math.min(120000,Number(sub.elapsedMs)||0)),correct:!!sub.correct,timedOut:!!sub.timedOut};
  });
  room.results={round:room.round,players:rows,mode:room.mode,teamScore:rows.reduce((a,p)=>a+p.total,0),roundPoints:rows.reduce((a,p)=>a+p.points,0)};
  io.to(room.code).emit('round:results', room.results);
  emitRoom(room);
}
function startRoundTimer(room) { clearRoundTimer(room); room.roundTimer=setTimeout(()=>finalizeRound(room), 45000); }
function removeRoomIfEmpty(room) { if(room.players.size===0){clearRoundTimer(room);rooms.delete(room.code);} }
function sendRoomError(socket, message) { socket.emit('room:error', {message}); }
io.on('connection', socket => {
  socket.on('room:create', (payload={}) => {
    const gameId=String(payload.gameId||'');const mode=String(payload.mode||'versus');
    if(!ID_RE.test(gameId))return sendRoomError(socket,'Choose a valid game first.');
    if(!ALLOWED_MODES.has(mode))return sendRoomError(socket,'Choose Versus or Co-op for an online room.');
    // Leave an earlier room cleanly before creating another.
    if(socket.data.roomCode){const old=rooms.get(socket.data.roomCode);if(old){old.players.delete(socket.id);if(old.hostId===socket.id)old.hostId=old.players.keys().next().value||null;emitRoom(old);removeRoomIfEmpty(old);}socket.leave(socket.data.roomCode);}
    let roomCode;do{roomCode=code();}while(rooms.has(roomCode));
    const room={code:roomCode,gameId,mode,hostId:socket.id,players:new Map(),scores:new Map(),submissions:Object.create(null),seed:0,round:0,started:false,results:null,roundTimer:null,createdAt:Date.now()};
    room.players.set(socket.id,{id:socket.id,name:cleanName(payload.nickname)});room.scores.set(socket.id,0);rooms.set(roomCode,room);socket.join(roomCode);socket.data.roomCode=roomCode;
    socket.emit('room:created', publicRoom(room));emitRoom(room);
  });
  socket.on('room:join', (payload={}) => {
    const roomCode=String(payload.code||'').toUpperCase();const room=rooms.get(roomCode);
    if(!/^[A-Z2-9]{6}$/.test(roomCode)||!room)return sendRoomError(socket,'Room not found. Check the six-character code.');
    if(room.started)return sendRoomError(socket,'That match has already started. Ask for a new room code.');
    if(room.players.size>=MAX_PLAYERS)return sendRoomError(socket,'This room is full.');
    if(room.players.has(socket.id))return socket.emit('room:joined',publicRoom(room));
    if(socket.data.roomCode){const old=rooms.get(socket.data.roomCode);if(old){old.players.delete(socket.id);if(old.hostId===socket.id)old.hostId=old.players.keys().next().value||null;emitRoom(old);removeRoomIfEmpty(old);}socket.leave(socket.data.roomCode);}
    room.players.set(socket.id,{id:socket.id,name:cleanName(payload.nickname)});room.scores.set(socket.id,0);socket.join(roomCode);socket.data.roomCode=roomCode;
    socket.emit('room:joined',publicRoom(room));emitRoom(room);
  });
  socket.on('room:start', () => {
    const room=rooms.get(socket.data.roomCode);if(!room)return sendRoomError(socket,'You are not in a room.');
    if(socket.id!==room.hostId)return sendRoomError(socket,'Only the room host can start the match.');
    if(room.started)return sendRoomError(socket,'This match has already started.');
    if(room.players.size<2)return sendRoomError(socket,'At least two players are needed to start.');
    room.started=true;room.seed=(Math.random()*0x7fffffff)>>>0;room.round=1;room.submissions=Object.create(null);room.results=null;startRoundTimer(room);
    io.to(room.code).emit('game:started',{gameId:room.gameId,mode:room.mode,seed:room.seed,round:1,roomCode:room.code,players:publicRoom(room).players,room:publicRoom(room)});emitRoom(room);
  });
  socket.on('round:submit', (payload={}) => {
    const room=rooms.get(socket.data.roomCode);if(!room||!room.started||room.results)return;
    if(!room.players.has(socket.id)||room.submissions[socket.id])return;
    room.submissions[socket.id]={points:Math.max(0,Math.min(1000,Number(payload.points)||0)),elapsedMs:Math.max(0,Math.min(120000,Number(payload.elapsedMs)||0)),correct:!!payload.correct,answer:String(payload.answer||'').slice(0,100)};
    const count=Object.keys(room.submissions).length;io.to(room.code).emit('round:progress',{submittedCount:count,playerCount:room.players.size,submittedNames:[...room.players.values()].filter(p=>room.submissions[p.id]).map(p=>p.name)});
    if(count>=room.players.size)finalizeRound(room);
  });
  socket.on('round:next', () => {
    const room=rooms.get(socket.data.roomCode);if(!room||!room.started)return;
    if(socket.id!==room.hostId)return sendRoomError(socket,'Only the host can advance the round.');
    if(!room.results)return sendRoomError(socket,'Wait until everyone submits or the round times out.');
    if(room.round>=MAX_ROUNDS){io.to(room.code).emit('game:ended',{players:publicRoom(room).players,teamScore:[...room.scores.values()].reduce((a,b)=>a+b,0)});room.started=false;room.results=null;emitRoom(room);return;}
    room.round++;room.submissions=Object.create(null);room.results=null;startRoundTimer(room);
    io.to(room.code).emit('round:next',{round:room.round,seed:room.seed});emitRoom(room);
  });
  socket.on('room:leave', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});
function leaveRoom(socket){const codeNow=socket.data.roomCode;if(!codeNow)return;const room=rooms.get(codeNow);socket.data.roomCode=null;if(!room)return;room.players.delete(socket.id);room.scores.delete(socket.id);delete room.submissions[socket.id];if(room.hostId===socket.id)room.hostId=room.players.keys().next().value||null;io.to(room.code).emit('opponent:left',{name:'A player'});if(room.started&&!room.results&&Object.keys(room.submissions).length>=room.players.size&&room.players.size>0)finalizeRound(room);emitRoom(room);removeRoomIfEmpty(room);}
const cleanup=setInterval(()=>{const now=Date.now();for(const room of rooms.values()){if(!room.players.size||(!room.started&&now-room.createdAt>6*60*60*1000)){clearRoundTimer(room);rooms.delete(room.code);}}},10*60*1000);cleanup.unref?.();
server.listen(PORT,'0.0.0.0',()=>console.log(`Fleet Arcade listening on ${PORT}`));
