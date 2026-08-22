const timersList = document.getElementById('timersList');
const addTimerBtn = document.getElementById('addTimerBtn');

let timers = [];
let nextId = 1;

function createTimerData() {
  return {
    id: nextId++,
    label: '',
    elapsedMs: 0,
    isRunning: false,
    startedAt: null
  };
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

function getCurrentElapsed(timer) {
  if (!timer.isRunning) return timer.elapsedMs;
  return timer.elapsedMs + (Date.now() - timer.startedAt);
}

function toggleTimer(timerId) {
  const timer = timers.find(t => t.id === timerId);
  if (!timer) return;

  if (timer.isRunning) {
    timer.elapsedMs = getCurrentElapsed(timer);
    timer.isRunning = false;
    timer.startedAt = null;
  } else {
    timer.isRunning = true;
    timer.startedAt = Date.now();
  }

  renderTimers();
}

function resetTimer(timerId) {
  const timer = timers.find(t => t.id === timerId);
  if (!timer) return;

  timer.elapsedMs = 0;
  timer.isRunning = false;
  timer.startedAt = null;
  renderTimers();
}

function removeTimer(timerId) {
  timers = timers.filter(t => t.id !== timerId);
  renderTimers();
}

function updateLabel(timerId, value) {
  const timer = timers.find(t => t.id === timerId);
  if (!timer) return;
  timer.label = value;
}

function createTicksHtml() {
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    ticks += `<div class="tick" style="transform: translateX(-50%) rotate(${i * 6}deg); height:${i % 5 === 0 ? 14 : 8}px;"></div>`;
  }
  return ticks;
}

function renderTimers() {
  timersList.innerHTML = '';

  timers.forEach(timer => {
    const elapsed = getCurrentElapsed(timer);
    const totalSeconds = Math.floor(elapsed / 1000);

    const secondDeg = (totalSeconds % 60) * 6;
    const minuteDeg = ((totalSeconds / 60) % 60) * 6;

    const card = document.createElement('div');
    card.className = 'timer-card';

    card.innerHTML = `
      <div class="timer-label-wrap">
        ${!timer.isRunning ? `
          <label class="timer-label">Activity label</label>
          <input
            class="timer-input"
            type="text"
            placeholder="Reading, Chess, Deep work..."
            value="${escapeHtml(timer.label)}"
            data-timer-id="${timer.id}"
          />
        ` : `
          <div class="timer-title">${timer.label ? escapeHtml(timer.label) : 'Untitled activity'}</div>
        `}
      </div>

      <div class="stopwatch ${timer.isRunning ? 'running' : ''}" data-click-id="${timer.id}">
        ${createTicksHtml()}
        <div class="hand minute-hand" style="transform: translateX(-50%) rotate(${minuteDeg}deg)"></div>
        <div class="hand second-hand" style="transform: translateX(-50%) rotate(${secondDeg}deg)"></div>
        <div class="center-dot"></div>
        <div class="time-text">${formatTime(elapsed)}</div>
      </div>

      <div class="timer-status">
        ${timer.isRunning ? 'Running — click clock to pause' : 'Paused — click clock to start'}
      </div>

      <div class="timer-actions">
        <button class="small-btn" data-reset-id="${timer.id}">Reset</button>
        <button class="small-btn danger" data-remove-id="${timer.id}">Delete</button>
      </div>
    `;

    timersList.appendChild(card);
  });

  bindTimerEvents();
}

function bindTimerEvents() {
  document.querySelectorAll('[data-click-id]').forEach(el => {
    el.addEventListener('click', () => {
      toggleTimer(Number(el.dataset.clickId));
    });
  });

  document.querySelectorAll('[data-reset-id]').forEach(el => {
    el.addEventListener('click', () => {
      resetTimer(Number(el.dataset.resetId));
    });
  });

  document.querySelectorAll('[data-remove-id]').forEach(el => {
    el.addEventListener('click', () => {
      removeTimer(Number(el.dataset.removeId));
    });
  });

  document.querySelectorAll('.timer-input').forEach(input => {
    input.addEventListener('input', e => {
      updateLabel(Number(input.dataset.timerId), e.target.value);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

addTimerBtn.addEventListener('click', () => {
  timers.push(createTimerData());
  renderTimers();
});

setInterval(() => {
  renderTimers();
}, 1000 / 6);

timers.push(createTimerData());
renderTimers();