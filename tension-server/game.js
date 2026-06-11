const TICK_RATE = 20;
const { generateForDifficulty, DIFFICULTY_NAMES } = require('./levels/difficulties');

class GameRoom {
  constructor(code, io, level) {
    this.code = code;
    this.io = io;
    this.level = level;
    this.players = {};
    this.started = false;
    this.tickInterval = null;
    this.finished = [];
    this.rebirthLevels = { 0: level };
  }

  getRebirthLevel(rebirth) {
    if (!this.rebirthLevels[rebirth]) {
      this.rebirthLevels[rebirth] = generateForDifficulty(rebirth);
    }
    return this.rebirthLevels[rebirth];
  }

  addPlayer(socket, username, color = 0xe94560, hat = 'none') {
    this.players[socket.id] = {
      id: socket.id,
      username,
      color,
      hat,
      position: { ...this.level.start, y: this.level.start.y + 0.5 },
      rotation: { y: 0 },
      checkpoint: null,
      checkpointPos: { ...this.level.start },
      answeredQuestions: new Set(),
      pendingQuestion: null,
      finished: false,
      finishRank: null,
      rebirth: 0,
      level: this.level,
    };

    socket.emit('init', {
      id: socket.id,
      players: this._serializePlayers(),
      level: this.level,
      finished: this.finished,
    });

    socket.to(this.code).emit('player_joined', this._serializePlayer(socket.id));

    if (!this.started) this.start();
  }

  removePlayer(id) {
    delete this.players[id];
    this.io.to(this.code).emit('player_left', id);
    if (this.isEmpty()) { this.stop(); return; }
    // If everyone remaining has finished, trigger rebirth now
    const allPlayers = Object.values(this.players);
    if (allPlayers.length && allPlayers.every(p => p.finished)) {
      this._doGroupRebirth();
    }
  }

  updatePlayer(id, data) {
    const p = this.players[id];
    if (!p) return;
    p.position = data.position;
    p.rotation = data.rotation;
    this.io.to(this.code).except(id).emit('player_moved', { id, position: data.position, rotation: data.rotation });
  }

  handleCheckpoint(id, checkpointId) {
    const p = this.players[id];
    if (!p || p.checkpoint === checkpointId) return;

    const block = p.level.blocks.find(b => b.type === 'checkpoint' && b.id === checkpointId);
    if (!block) return;

    p.checkpoint = checkpointId;
    p.checkpointPos = { x: block.x, y: block.y + 1.5, z: block.z };
    this.io.to(this.code).emit('checkpoint_reached', { id, checkpointId });
  }

  handleQuestion(id, questionId) {
    const p = this.players[id];
    if (!p || p.answeredQuestions.has(questionId)) return;
    p.pendingQuestion = questionId;

    const question = p.level.questions.find(q => q.id === questionId);
    if (question) {
      this.io.to(id).emit('question', question);
    }
  }

  handleAnswer(id, questionId, answer) {
    const p = this.players[id];
    if (!p || p.pendingQuestion !== questionId) return;

    const question = p.level.questions.find(q => q.id === questionId);
    if (!question) return;

    p.pendingQuestion = null;

    const correct = Array.isArray(question.answers) ? question.answers.includes(answer) : answer === question.answer;
    if (correct) {
      p.answeredQuestions.add(questionId);
      this.io.to(id).emit('answer_result', { correct: true, questionId });
    } else {
      // Wrong — respawn at last checkpoint
      const respawn = { ...p.checkpointPos };
      p.position = { ...respawn };
      this.io.to(id).emit('answer_result', { correct: false, questionId, respawn });
    }
  }

  handleFinish(id) {
    const p = this.players[id];
    if (!p || p.finished) return;
    p.finished = true;
    p.finishRank = this.finished.length + 1;
    this.finished.push({ id, username: p.username, rank: p.finishRank });
    this.io.to(this.code).emit('player_finished', { id, username: p.username, rank: p.finishRank });

    const allPlayers = Object.values(this.players);
    const allFinished = allPlayers.every(pl => pl.finished);

    if (allFinished) {
      this._doGroupRebirth();
    } else {
      // Show waiting screen to this player
      const waitingFor = allPlayers.filter(pl => !pl.finished).map(pl => pl.username);
      this.io.to(id).emit('waiting_for_players', { waitingFor });
    }
  }

  _doGroupRebirth() {
    const allPlayers = Object.values(this.players);
    const maxRebirth = Math.max(...allPlayers.map(p => p.rebirth));

    if (maxRebirth >= 5) {
      allPlayers.forEach(p => {
        this.io.to(p.id).emit('rebirth_maxed', { username: p.username });
      });
      return;
    }

    const nextRebirth = maxRebirth + 1;
    const newLevel = this.getRebirthLevel(nextRebirth);

    allPlayers.forEach(p => {
      p.rebirth = nextRebirth;
      p.finished = false;
      p.finishRank = null;
      p.checkpoint = null;
      p.answeredQuestions = new Set();
      p.pendingQuestion = null;
      p.level = newLevel;
      p.checkpointPos = { ...newLevel.start };
      p.position = { ...newLevel.start, y: newLevel.start.y + 0.5 };

      this.io.to(p.id).emit('rebirth', {
        rebirth: nextRebirth,
        level: newLevel,
      });
    });

    this.finished = [];
  }

  handleRebirth(id) {
    // No-op — rebirth is now triggered automatically when all players finish
  }

  start() {
    this.started = true;
    this.tickInterval = setInterval(() => {
      this.io.to(this.code).emit('state', {
        players: this._serializePlayers(),
      });
    }, 1000 / TICK_RATE);
  }

  stop() {
    clearInterval(this.tickInterval);
    this.started = false;
  }

  isEmpty() {
    return Object.keys(this.players).length === 0;
  }

  _serializePlayer(id) {
    const p = this.players[id];
    return {
      id: p.id,
      username: p.username,
      color: p.color,
      hat: p.hat,
      position: p.position,
      rotation: p.rotation,
      checkpoint: p.checkpoint,
      finished: p.finished,
      finishRank: p.finishRank,
    };
  }

  _serializePlayers() {
    return Object.keys(this.players).map(id => this._serializePlayer(id));
  }
}

module.exports = GameRoom;
