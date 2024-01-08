const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*", // Change this to your client's URL if necessary
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const games = new Map();

io.on('connection', (socket) => {
  console.log('A user connected with id', socket.id);

  function checkWin(board, player) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const condition of winConditions) {
        if (condition.every((index) => board[index] === player)) {
        return true;
        }
    }
    return false;
  }

  socket.on('joinGame', (gameId) => {
    console.log(games.get(gameId));
    if (!games.has(gameId)) {
      console.log('Player created game', gameId, 'with id', socket.id);
      games.set(gameId, {
        board: Array(9).fill(null),
        players: [socket.id],
        currentPlayer: 0
      });
      socket.join(gameId);
    } else {
      const game = games.get(gameId);
      if (game.players.length < 2 && !game.players.includes(socket.id)) {
        console.log('Player joined game', gameId, 'with id', socket.id);
        game.players.push(socket.id);
        socket.join(gameId);

        if (game.players.length === 2) {
          console.log('Game started');
          io.to(gameId).emit('gameStart', { gameId, players: game.players });
        }
      }else if(!game.players.includes(socket.id)) {
        console.log('Game is full');
        io.to(socket.id).emit('gameFull');
      }
    }

    socket.on("leaveGame", (gameId) => {
        console.log("Player left game", gameId, "with id", socket.id);
        const game = games.get(gameId);
        game.players = game.players.filter((player) => player !== socket.id);
        if (game.players.length === 0) {
            games.delete(gameId);
        }
        io.to(gameId).emit("playerLeft", { gameId, players: game.players });
    });

    socket.on("restartRequest", (gameId) => {
        console.log("Player requested restart for game", gameId, "with id", socket.id);
        const game = games.get(gameId);
        io.to(gameId).emit("restartRequested", { gameId, players: game.players });
    });

    socket.on("restartGame", (gameId) => {
        console.log("Game restarted for" + gameId + "with id" + socket.id);
        const game = games.get(gameId);
        console.log(game);
        game.board = Array(9).fill(null);
        game.currentPlayer = 0;
        io.to(gameId).emit('gameRestarted', { board: game.board });
    });

    socket.on('makeMove', (data) => {
      const { gameId, index } = data;
      const game = games.get(gameId);
      const currentPlayer = game.currentPlayer;

      if (socket.id === game.players[currentPlayer] && !game.board[index]) {
        game.board[index] = currentPlayer;
        const isWinner = checkWin(game.board, currentPlayer);

        io.to(gameId).emit('moveMade', { board: game.board, index, player: currentPlayer });

        if (isWinner) {
          io.to(gameId).emit('gameOver', { winner: currentPlayer });
        } else if (!game.board.includes(null)) {
          io.to(gameId).emit('gameOver', { draw: true });
        } else {
          game.currentPlayer = (currentPlayer + 1) % game.players.length;
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected');
      if (games.has(gameId)) {
        const game = games.get(gameId);
        game.players = game.players.filter((player) => player !== socket.id);
        if (game.players.length === 0) {
          games.delete(gameId);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
