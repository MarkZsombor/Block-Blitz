const newId = require('uuid/v1');


exports = module.exports = function(io){
  //creating places to store the games
const gameCollection = [];
/*
 * Creates a new game
 *
 * @param socket - user's socket
 * @param {object} player - info for the creating user
 */
function buildGame(socket) {
  // Creates a new game object, adds it to gameCollection
  let gameObject = {};
  gameObject.id = newId();
  gameObject.pictureId= Math.ceil(Math.random() * 5);

  console.log('player info in the build game function', socket.user_name, socket.user_id);
  gameObject.playerOne = socket.user_name;
  gameObject.playerOneId = socket.user_id;
  gameObject.playerTwo = "";
  gameObject.playerTwoId = "";
  console.log('game created in the build game function', gameObject);
  gameCollection.push(gameObject);

  console.log("Game created by " + gameObject.playerOne + " w/ " + gameObject.id);
  // Emits to clients that the game has been made
  socket.emit('join-success', gameObject);
  // Joins room for the new game
  socket.join(gameObject.id);
  io.emit('all-games', availableGames(gameCollection));
}

/*
 * Searches for an available game,
 * If none found makes a new game
 *
 * @param socket - user's socket
 * @param {object} player - info for the searching user
 */
function gameSeeker(socket) {
  // If no games exist, create one
  if (gameCollection.length == 0) {
    buildGame(socket);
    return;
  }
  // Searches through the gameCollection for a game w/o a second player
  for(let game of gameCollection) {
    if(!game.playerTwo) {
      if(game.playerOneId === socket.user_id) {
        //Needs to return error that user is already in the queue
        return;
      }
      console.log('FOUND A GAME');
      // Updates the game info with user info
      game.playerTwo = socket.user_name;
      game.playerTwoId = socket.user_id;
      // Joins the room
      socket.join(game.id);
      flagUsersInGame(game.id);
      console.log("game.id:", game.id);
      console.log( socket.user_name + " has been added to: " + game.id);
      // Emits notification that the game is filled, starts the game
      io.sockets.in(game.id).emit('join-success', game);
      io.sockets.in(game.id).emit('start-game', game);
      io.emit('all-games', availableGames(gameCollection));
      io.emit('list-players', listOnlinePlayers(io.sockets));
      return;
    }
  }
  // If no games exist w/o a player 2, create a new game
  buildGame(socket);
}


function flagUsersInGame(roomId){
  let users_in_room = io.sockets.adapter.rooms[roomId].sockets;

  console.log(users_in_room, " this is USERS_IN_ROOM");
  for (let userId in users_in_room){
    io.sockets.sockets[userId].in_game = true;

  }

}
/*
 * Join a specific game
 *
 * @param socket - user's socket
 * @param {object} data - info for the user and game
 */
function joinGame(socket, data){
  for( let game of gameCollection){
    if (game.id === data.id && game.playerOneId !== data.user.id){
      // Updates game info
      game.playerTwo = data.user.name;
      game.playerTwoId = data.user.id;
      console.log(game , " this is game inside the function");
      // Joins Room
      socket.join(game.id);
      console.log( data.user.name + " has been added to: " + game.id);
      // Emits notification that game is filled, starts game
      io.sockets.in(game.id).emit('join-success', game);
      io.sockets.in(game.id).emit('start-game', game);
      flagUsersInGame(game.id);
      io.emit('all-games', availableGames(gameCollection));
      io.emit('list-players', listOnlinePlayers(io.sockets));
     return;
    }
  }
}

/*
 * When a user choses to leave the queue deletes their game
 *
 * @param socket - user's socket
 * @param {string} gameId - id of the game
 */
function leaveQueue(socket, gameId) {
  // Searches through the gameCollection for a specific game
  for (let i = 0; i < gameCollection.length; i++) {
    if (gameCollection[i].id === gameId) {
      console.log(gameCollection);
      console.log("gameCollection[i].id:", gameCollection[i].id);
      // Remove game object from gameCollection
      gameCollection.splice(i, 1);
      // Leave the Room
      socket.leave(gameId);
      // Emit notification that game is no longer available
      io.emit('all-games', availableGames(gameCollection));
    }
  }
}

/*
 * Will return an array of games that have 1 player.
 */
function availableGames(allGames) {
  let openGames = [];
  for(let i = 0; i < allGames.length; i++) {
    if (!allGames[i].playerTwo) {
      openGames.push(allGames[i]);
    }
  }
  return openGames;
}

// Creates an array of all online players
function listOnlinePlayers(allSockets) {
  playerList = [];
  for (let socket in allSockets.sockets) {
    console.log('list of sockets', allSockets.sockets[socket].user_name);
    if(allSockets.sockets[socket].user_name) {
      playerList.push({
        userName: allSockets.sockets[socket].user_name,
        userId: allSockets.sockets[socket].user_id,
        wins: allSockets.sockets[socket].user_wins,
        inGame: allSockets.sockets[socket].in_game
      });
    }
  }
  console.log('array of players', playerList);
  return playerList;
}

//on socket connection recieving info from the client side

io.on('connection', function(socket) {
  socket.emit('connection', 'socket connected');
  console.log('a socket has connected');

  socket.on('new-user', function(data) {
    console.log('server side new user data: ', data);
    socket.user_id = data.id;
    socket.user_name = data.name;
    socket.user_wins = data.wins;
    socket.in_game = false;

    //need to re-add to open games already created
    for (let i = 0; i < gameCollection.length; i++) {
      if((gameCollection[i].playerOneId == socket.user_id) && !gameCollection[i].playerTwoId) {
        socket.join(gameCollection[i].id);
        socket.emit('existing-game', gameCollection[i].id)
      }
    }

    let allOpenGames;
    allOpenGames = availableGames(gameCollection);
    console.log('available games object server side', allOpenGames);
    io.emit('list-players', listOnlinePlayers(io.sockets));
    io.emit('all-games', allOpenGames);
  });

  socket.on('join-queue', function(data) {
    console.log('server heard a game request');
    console.log('joined queue', data.player.name);
    let room = { id: newId() };
    gameSeeker(socket);
  });

  socket.on('join-game', function(data){
    joinGame(socket, data);
    console.log(data, " game request Id");
  });

  socket.on('make-game', function(data){
    console.log(data.player, "this is from the make game listener");
    buildGame(socket);
  });

  socket.on('game-over', function(data) {
    console.log('Game over, someone won');
    console.log('incoming gameover data', data);
    console.log('Ended game id', data.room.roomName);
    io.sockets.in(data.room.roomName).emit('game-ended', data);
  });

  socket.on('leave-queue', function(data){
    console.log("left queue");
    console.log("data: ", data)
    // console.log("gameCollection before", gameCollection);
    // leaveQueue(socket, data);
    // console.log("gameCollection after", gameCollection);
    for (let i = 0; i < gameCollection.length; i++) {
      console.log('individual game ', gameCollection[i]);
      if(gameCollection[i].playerOneId == socket.user_id) {
        gameCollection.splice(i, 1);
      } else if (gameCollection[i].playerTwoId && gameCollection[i].playerTwoId == socket.user_id) {
        gameCollection.splice(i, 1);
      }
      io.emit('all-games', availableGames(gameCollection));
    }
  });

  socket.on('leaving-page', function() {
    console.log(socket.user_name + ' disconnected');
    io.emit('user-gone-offline', socket.user_id);
    //remove all of the users open games in games collection
    for (let i = 0; i < gameCollection.length; i++) {
      console.log('individual game ', gameCollection[i]);
      if(gameCollection[i].playerOneId == socket.user_id) {
        console.log('found a game match');
        socket.leave(gameCollection[i].id);
        gameCollection.splice(i, 1);
      } else if (gameCollection[i].playerTwoId && gameCollection[i].playerTwoId == socket.user_id) {
        console.log('found a game match');
        socket.leave(gameCollection[i].id);
        gameCollection.splice(i, 1);
      }
      io.emit('all-games', availableGames(gameCollection));
    }
  });

});
}