/*
Mobile-friendly Dice Wars web client (multiplayer-capable).
This client expects a Socket.IO server that supports the following events:
- 'createRoom' -> server emits 'roomCreated' with { roomId }
- 'joinRoom' with { roomId, name } -> server emits 'joined' with { playerId, roomId, players }
- 'gameState' with full game state like { players, grid, turnIndex, started }
- 'playerList' updates
You can point this client to any server by entering its URL in the Server URL input.
If blank, it connects to the same origin.
*/

const nameInput = document.getElementById('name');
const serverUrlInput = document.getElementById('serverUrl');
const roomInput = document.getElementById('roomInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomInfo = document.getElementById('roomInfo');
const playersDiv = document.getElementById('players');
const gameWrap = document.getElementById('gameWrap');
const lobby = document.getElementById('lobby');
const turnInfo = document.getElementById('turnInfo');
const endTurnBtn = document.getElementById('endTurnBtn');
const reinforceBtn = document.getElementById('reinforceBtn');
const board = document.getElementById('board');
const log = document.getElementById('log');
const copyBtn = document.getElementById('copyRoom');

let socket = null;
let myId = null;
let game = null;
let currentRoom = null;
let selected = null;

function logMsg(m){ const el = document.createElement('div'); el.textContent = m; log.prepend(el); }

function connectSocket(url){
  if(socket){ socket.close(); socket = null; }
  try {
    socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3 });
  } catch(e){ console.error(e); }
  socket.on('connect', ()=>{ myId = socket.id; roomInfo.textContent = 'Connected, socket id: ' + myId; });
  socket.on('disconnect', ()=>{ roomInfo.textContent = 'Disconnected'; });
  socket.on('roomCreated', (d)=>{ roomInput.value = d.roomId; roomInfo.textContent = 'Room created: ' + d.roomId; copyBtn.style.display='inline-block'; });
  socket.on('joined', (d)=>{ myId = d.playerId; currentRoom = d.roomId; roomInfo.textContent = 'Joined ' + d.roomId; copyBtn.style.display='inline-block'; renderPlayers(d.players); });
  socket.on('playerList', (players)=>{ renderPlayers(players); });
  socket.on('gameState', (g)=>{ game=g; renderBoard(); updateTurn(); });
  socket.on('error', (e)=>{ console.warn('socket error', e); });
}

function getServerUrl(){
  const v = serverUrlInput.value.trim();
  if(!v) return window.location.origin;
  return v.replace(/\/$/, '');
}

createBtn.addEventListener('click', ()=>{
  const url = getServerUrl();
  if(!socket || socket.io?.uri !== url) connectSocket(url);
  socket.emit('createRoom');
});

joinBtn.addEventListener('click', ()=>{
  const url = getServerUrl();
  if(!socket || socket.io?.uri !== url) connectSocket(url);
  const roomId = roomInput.value.trim();
  if(!roomId){ alert('Enter a room code or click Create'); return; }
  const name = nameInput.value.trim() || 'Player';
  socket.emit('joinRoom', { roomId, name });
  // wait for 'joined' / 'gameState' events from server
  lobby.style.display = 'none';
  gameWrap.style.display = 'block';
});

copyBtn.addEventListener('click', ()=>{
  if(!roomInput.value) return;
  navigator.clipboard?.writeText(roomInput.value).then(()=>{ copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy',1000); });
});

function renderPlayers(playersList){
  playersDiv.innerHTML = '';
  if(!playersList && game) playersList = game.players || [];
  if(!playersList || playersList.length===0){ playersDiv.textContent = 'No players yet'; return; }
  for(const p of playersList){
    const el = document.createElement('div'); el.className='player';
    el.textContent = (p.id===myId? p.name + ' (you)' : p.name);
    if(p.color) el.style.background = p.color;
    playersDiv.appendChild(el);
  }
}

endTurnBtn.addEventListener('click', ()=>{
  if(!socket || !currentRoom) return;
  socket.emit('endTurn', { roomId: currentRoom });
});

reinforceBtn.addEventListener('click', ()=>{
  if(!socket || !currentRoom) return;
  socket.emit('reinforce', { roomId: currentRoom });
});

/* Canvas rendering and touch-friendly interaction */
const ctx = board.getContext('2d');
function resizeCanvas(){
  // make the canvas pixel size match CSS size for crispness
  const rect = board.getBoundingClientRect();
  board.width = Math.floor(rect.width * devicePixelRatio);
  board.height = Math.floor(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  renderBoard();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

board.addEventListener('pointerdown', (ev)=>{
  ev.preventDefault();
  if(!game) return;
  const rect = board.getBoundingClientRect();
  const cols = game.grid[0].length, rows = game.grid.length;
  const x = Math.floor((ev.clientX - rect.left) / (rect.width / cols));
  const y = Math.floor((ev.clientY - rect.top) / (rect.height / rows));
  handleCellTap(x,y);
});

function handleCellTap(x,y){
  if(!game) return;
  const cell = game.grid[y][x];
  if(!selected){
    selected = {x,y};
    renderBoard();
    return;
  }
  // if tapped same cell, deselect
  if(selected.x===x && selected.y===y){ selected = null; renderBoard(); return; }
  // otherwise attempt attack
  socket.emit('attack', { roomId: currentRoom, from: selected, to: {x,y} });
  selected = null;
  renderBoard();
}

function updateTurn(){
  if(!game) return;
  const cur = game.players[game.turnIndex];
  turnInfo.textContent = cur ? (`Turn: ${cur.name}` + (cur.id===myId ? ' — your turn' : '')) : 'Waiting for players...';
}

function renderBoard(){
  if(!game) {
    // clear canvas
    ctx.clearRect(0,0,board.width,board.height);
    return;
  }
  const rows = game.grid.length, cols = game.grid[0].length;
  const rect = board.getBoundingClientRect();
  const cellW = rect.width / cols;
  const cellH = rect.height / rows;
  // clear
  ctx.clearRect(0,0,rect.width,rect.height);
  // draw cells
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const cell = game.grid[y][x];
      const px = x*cellW, py = y*cellH;
      // background
      if(cell.owner){
        const p = game.players.find(pp=>pp.id===cell.owner);
        ctx.fillStyle = (p && p.color) ? (p.color + '88') : 'rgba(200,200,200,0.12)';
        ctx.fillRect(px,py,cellW,cellH);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(px,py,cellW,cellH);
      }
      // border
      ctx.strokeStyle = '#bfbfbf22';
      ctx.strokeRect(px+0.5,py+0.5,cellW-1,cellH-1);

      // selected highlight
      if(selected && selected.x===x && selected.y===y){
        ctx.strokeStyle = '#ffb86b';
        ctx.lineWidth = 3;
        ctx.strokeRect(px+4,py+4,cellW-8,cellH-8);
        ctx.lineWidth = 1;
      }

      // dice text
      ctx.fillStyle = '#082022';
      ctx.font = `${Math.max(12, Math.min(cellH/3, 20))}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(cell.dice, px + 8, py + 8);
    }
  }
}

/* Handy: auto-connect to origin when the page loads (if server running here) */
window.addEventListener('DOMContentLoaded', ()=>{
  const url = getServerUrl();
  connectSocket(url);
  // try to rejoin if roomInput prefilled
  if(roomInput.value.trim()) {
    // don't auto-join — let user press Join
  }
});
