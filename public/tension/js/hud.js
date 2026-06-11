export class HUD {
  constructor() {
    this.checkpointEl = document.getElementById('checkpoint-val');
    this.scoreList    = document.getElementById('score-list');
    this.notification = document.getElementById('notification');
    this.timerEl      = document.getElementById('timer-val');
    this._notifTimer  = null;
  }

  updateTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    if (this.timerEl) this.timerEl.textContent = `${m}:${s}`;
  }

  updateCheckpoint(id, total) {
    if (this.checkpointEl) this.checkpointEl.textContent = `${id ?? 0} / ${total}`;
  }

  updateScoreboard(players) {
    const sorted = [...players].sort((a, b) => {
      if (a.finished && b.finished) return a.finishRank - b.finishRank;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return (b.checkpoint || 0) - (a.checkpoint || 0);
    });

    this.scoreList.innerHTML = sorted.map((p, i) => {
      const icon = p.finished ? '🏁' : `#${i + 1}`;
      const name = p.username.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<div class="score-entry"><span>${icon} ${name}</span><span>CP ${p.checkpoint ?? 0}</span></div>`;
    }).join('');
  }

  notify(msg, color = '#2ecc71') {
    this.notification.textContent = msg;
    this.notification.style.color = color;
    this.notification.style.opacity = '1';
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => { this.notification.style.opacity = '0'; }, 3000);
  }
}
