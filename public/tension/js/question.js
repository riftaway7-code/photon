export class QuestionUI {
  constructor(onAnswer) {
    this.onAnswer = onAnswer;
    this.overlay  = document.getElementById('question-overlay');
    this.text     = document.getElementById('question-text');
    this.options  = document.getElementById('options-container');
    this.feedback = document.getElementById('answer-feedback');
    this.current  = null;
    this.answered = false;
  }

  show(question) {
    this.current  = question;
    this.answered = false;
    this.feedback.textContent = '';

    // Release pointer lock so the player can click answers
    if (document.pointerLockElement) document.exitPointerLock();

    this.text.textContent = question.text;
    this.options.innerHTML = '';

    question.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => this._pick(opt, btn));
      this.options.appendChild(btn);
    });

    this.overlay.style.display = 'flex';
  }

  _pick(opt, btn) {
    if (this.answered) return;
    this.answered = true;
    btn.classList.add('selected');
    this.options.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    this.onAnswer(this.current.id, opt);
  }

  showResult(correct) {
    this.feedback.textContent = correct ? 'Correct! Keep going!' : 'Wrong! Respawning...';
    this.feedback.style.color = correct ? '#2ecc71' : '#e74c3c';

    this.options.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.textContent === this.current.answer) btn.classList.add('correct');
      else if (btn.classList.contains('selected')) btn.classList.add('wrong');
    });

    setTimeout(() => this.hide(), correct ? 1500 : 2500);
  }

  hide() {
    this.overlay.style.display = 'none';
  }

  isOpen() {
    return this.overlay.style.display === 'flex';
  }
}
