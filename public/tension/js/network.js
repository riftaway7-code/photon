import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

export class Network {
  constructor() {
    this.socket = io({ transports: ['polling', 'websocket'] });
    this.handlers = {};
    this.socket.onAny((event, data) => {
      if (this.handlers[event]) this.handlers[event](data);
    });
  }

  on(event, fn) { this.handlers[event] = fn; }

  join(roomCode, username, color, hat) {
    this.socket.emit('join_room', { roomCode, username, color, hat });
  }

  sendPosition(data) {
    this.socket.emit('player_update', data);
  }

  sendCheckpoint(id) {
    this.socket.emit('checkpoint', id);
  }

  sendQuestionZone(questionId) {
    this.socket.emit('question_zone', questionId);
  }

  sendAnswer(questionId, answer) {
    this.socket.emit('answer', { questionId, answer });
  }

  sendFinish() {
    this.socket.emit('finish');
  }

  sendChat(msg) {
    this.socket.emit('chat', msg);
  }

  sendRebirth() {
    this.socket.emit('rebirth');
  }

  sendFlashlight(on) {
    this.socket.emit('flashlight', { on });
  }
}
