document.addEventListener("DOMContentLoaded", () => {
  const socket = new WebSocket("wss://chess-relay-server.onrender.com"); 
  const chess = new Chess();
  let board = null;
  let currentRoom = null;
  let playerId = generatePlayerId();
  let playerColor = null; // 'white' or 'black'
  let isMyTurn = false;

  function generatePlayerId() {
    return Math.random().toString(36).substr(2, 16);
  }

  function updateTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (!indicator) return;
    
    if (playerColor) {
      const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
      const isCurrentPlayerTurn = currentTurn === playerColor;
      indicator.textContent = isCurrentPlayerTurn ? 
        `Your turn (${playerColor})` : 
        `Opponent's turn (${currentTurn})`;
      indicator.style.color = isCurrentPlayerTurn ? '#2ecc71' : '#e74c3c';
    } else {
      indicator.textContent = 'Waiting for game to start...';
      indicator.style.color = '#f39c12';
    }
  }

  function onDragStart(source, piece, position, orientation) {
    // don't pick up pieces if the game is over
    if (chess.game_over()) return false;

    // don't allow moves if it's not your turn
    const currentTurn = chess.turn() === 'w' ? 'white' : 'black';
    if (currentTurn !== playerColor) return false;

    // only pick up your own pieces
    const pieceColor = piece.search(/^w/) !== -1 ? 'white' : 'black';
    if (pieceColor !== playerColor) return false;
  }

  function onDrop(source, target) {
    const move = chess.move({
      from: source,
      to: target,
      promotion: 'q'
    });

    if (move === null) return 'snapback'; // illegal move

    board.position(chess.fen());
    updateTurnIndicator();

    // send move to opponent
    socket.send(JSON.stringify({
      type: 'move',
      roomId: currentRoom,
      playerId: playerId,
      move: move
    }));
  }

  function onSnapEnd() {
    board.position(chess.fen());
  }

  document.getElementById("joinBtn").onclick = () => {
    currentRoom = document.getElementById("roomId").value.trim();
    if (!currentRoom) return alert("Enter a room ID");
    
    // Reset game state when joining new room
    chess.reset();
    board.position('start');
    playerColor = null;
    
    socket.send(JSON.stringify({ 
      type: "join", 
      roomId: currentRoom,
      playerId: playerId 
    }));
    
    updateTurnIndicator();
  };

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === "move") {
      // Only apply moves from other players
      if (data.playerId !== playerId) {
        chess.move(data.move);
        board.position(chess.fen());
        updateTurnIndicator();
      }
    }
    
    if (data.type === "gameState") {
      // Set player color and update board
      playerColor = data.playerColor;
      chess.load(data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      board.position(chess.fen());
      
      // Set board orientation based on player color
      if (playerColor === 'black') {
        board.flip();
      }
      
      updateTurnIndicator();
      console.log(`Joined as ${playerColor} player`);
    }
    
    if (data.type === "status") {
      console.log(data.message);
    }
    
    if (data.type === "error") {
      alert(data.message);
    }
  });

  board = ChessBoard('board', {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
  });
});
