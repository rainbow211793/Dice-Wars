const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => { res.sendFile(path.join(clientDist, 'index.html')); });
const rooms = {};
function makeGrid(cols=8,rows=6){ const grid=[]; let id=0; for(let y=0;y<rows;y++){ const row=[]; for(let x=0;x<cols;x++){ row.push({id:id++, owner:null, dice:1}); } grid.push(row);} return grid;}
function createRoom(roomId){ rooms[roomId]={players:[], grid:makeGrid(8,6), turnIndex:0, started:false}; return rooms[roomId]; }
function randomCode(len=5){ return Math.random().toString(36).substring(2,2+len).toUpperCase(); }
io.on('connection', socket=>{
  console.log('socket connected', socket.id);
  socket.on('createRoom', ()=>{ let code=randomCode(5); while(rooms[code]) code=randomCode(5); createRoom(code); socket.emit('roomCreated',{roomId:code}); });
  socket.on('joinRoom', ({roomId,name})=>{ if(!rooms[roomId]){ socket.emit('errorMsg','Room not found'); return;} const room=rooms[roomId]; const player={id:socket.id,name:name||'Player',color:['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4'][room.players.length%6]}; room.players.push(player); socket.join(roomId); io.to(roomId).emit('joined',{playerId:socket.id, roomId, players:room.players}); io.to(roomId).emit('playerList', room.players); io.to(roomId).emit('gameState',{players:room.players, grid:room.grid, turnIndex:room.turnIndex, started:room.started}); });
  socket.on('startGame', ({roomId})=>{ const room=rooms[roomId]; if(!room) return; room.started=true; for(let y=0;y<room.grid.length;y++) for(let x=0;x<room.grid[0].length;x++){ const c=room.grid[y][x]; c.owner=room.players[Math.floor(Math.random()*room.players.length)].id; c.dice=1+Math.floor(Math.random()*3); } room.turnIndex=0; io.to(roomId).emit('gameState',{players:room.players, grid:room.grid, turnIndex:room.turnIndex, started:room.started}); });
  socket.on('attack', ({roomId, from, to})=>{ const room=rooms[roomId]; if(!room || !room.started) return; if(room.players[room.turnIndex].id !== socket.id) return; const f=room.grid[from.y][from.x]; const t=room.grid[to.y][to.x]; if(!f||!t) return; if(f.owner !== socket.id) return; if(f.dice<2) return; const deltas=[[1,0],[-1,0],[0,1],[0,-1]]; const isNeighbor = deltas.some(d=>d[0]+from.x===to.x && d[1]+from.y===to.y); if(!isNeighbor) return; const attackRoll = Array.from({length:f.dice-1},()=>Math.ceil(Math.random()*6)).reduce((a,b)=>a+b,0); const defendRoll = Array.from({length:t.dice},()=>Math.ceil(Math.random()*6)).reduce((a,b)=>a+b,0); if(attackRoll>defendRoll){ t.owner=f.owner; t.dice=f.dice-1; f.dice=1; } else { f.dice=Math.max(1,f.dice-1); } room.turnIndex=(room.turnIndex+1)%room.players.length; io.to(roomId).emit('gameState',{players:room.players, grid:room.grid, turnIndex:room.turnIndex, started:room.started}); });
  socket.on('endTurn', ({roomId})=>{ const room=rooms[roomId]; if(!room) return; if(room.players[room.turnIndex].id !== socket.id) return; for(let y=0;y<room.grid.length;y++) for(let x=0;x<room.grid[0].length;x++){ const cell=room.grid[y][x]; if(cell.owner===socket.id) cell.dice=Math.min(8,cell.dice+1); } room.turnIndex=(room.turnIndex+1)%room.players.length; io.to(roomId).emit('gameState',{players:room.players, grid:room.grid, turnIndex:room.turnIndex, started:room.started}); });
  socket.on('disconnecting', ()=>{ for(const code of Object.keys(rooms)){ const room=rooms[code]; room.players = room.players.filter(p=>p.id!==socket.id); if(room.players.length===0) delete rooms[code]; else io.to(code).emit('playerList', room.players); } });
});
server.listen(PORT, ()=>console.log('Server listening on', PORT));
