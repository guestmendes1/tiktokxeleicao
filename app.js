// WebSocket & Game State
let socket;
let audioCtx = null;
let soundEnabled = true;

const state = {
  scoreLeft: 0,
  scoreRight: 0,
  targetScore: 1200,
  totalGiftsLeft: 0,
  totalGiftsRight: 0,
  timerSeconds: 9 * 60 + 26,
  isLiveConnected: false,
  tiktokUsername: ''
};

// Element References
const clockDisplay = document.getElementById('clockDisplay');
const statTotal = document.getElementById('statTotal');
const statDiff = document.getElementById('statDiff');
const leaderBadge = document.getElementById('leaderBadge');
const leaderText = document.getElementById('leaderText');
const targetDisplay = document.getElementById('targetDisplay');
const goalPercent = document.getElementById('goalPercent');
const goalBarFill = document.getElementById('goalBarFill');

const scoreLeftEl = document.getElementById('scoreLeft');
const scoreRightEl = document.getElementById('scoreRight');
const percentLeftEl = document.getElementById('percentLeft');
const percentRightEl = document.getElementById('percentRight');
const progressLeftEl = document.getElementById('progressLeft');
const progressRightEl = document.getElementById('progressRight');
const giftsLeftEl = document.getElementById('giftsLeft');
const giftsRightEl = document.getElementById('giftsRight');
const frontBadgeLeft = document.getElementById('frontBadgeLeft');
const frontBadgeRight = document.getElementById('frontBadgeRight');
const tickerTextLeft = document.getElementById('tickerTextLeft');
const tickerTextRight = document.getElementById('tickerTextRight');

const handLeft = document.getElementById('handLeft');
const handRight = document.getElementById('handRight');
const btnConfirmaLeft = document.getElementById('btnConfirmaLeft');
const btnConfirmaRight = document.getElementById('btnConfirmaRight');
const urnaDigitL1 = document.getElementById('urnaDigitL1');
const urnaDigitL2 = document.getElementById('urnaDigitL2');
const urnaDigitR1 = document.getElementById('urnaDigitR1');
const urnaDigitR2 = document.getElementById('urnaDigitR2');

const victoryModal = document.getElementById('victoryModal');
const victoryTitle = document.getElementById('victoryTitle');
const resetCountdownEl = document.getElementById('resetCountdown');
const confettiCanvas = document.getElementById('confettiCanvas');

// Streamer Dock Elements
const dockToggle = document.getElementById('dockToggle');
const streamerDock = document.getElementById('streamerDock');
const closeDock = document.getElementById('closeDock');
const dockTiktokUser = document.getElementById('dockTiktokUser');
const btnDockConnect = document.getElementById('btnDockConnect');
const dockStatus = document.getElementById('dockStatus');
const soundToggle = document.getElementById('soundToggle');

// Inicializa Áudio do Navegador
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Som Autêntico da Urna Eletrônica (CONFIRMA - Pi-li-lim)
function playUrnaConfirmaSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Frequências clássicas do apito da Urna Eletrônica
    osc.frequency.setValueAtTime(587.33, now); // D5
    gain.gain.setValueAtTime(0.25, now);

    osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
    osc.frequency.setValueAtTime(1174.66, now + 0.2); // D6
    gain.gain.setValueAtTime(0.3, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.start(now);
    osc.stop(now + 0.55);
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

// Som de Vitória / Fanfarra
function playVictorySound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const startTime = audioCtx.currentTime + idx * 0.12;
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  } catch (e) {}
}

// Conectar ao WebSocket do Servidor
function connectWebSocket() {
  const urlParams = new URLSearchParams(window.location.search);
  const customServer = urlParams.get('server') || localStorage.getItem('game_server_url');

  let wsUrl;
  if (customServer) {
    wsUrl = customServer.startsWith('ws') ? customServer : `wss://${customServer.replace(/^https?:\/\//, '')}`;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}`;
  }

  console.log('Conectando ao servidor:', wsUrl);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('Conectado ao servidor de controle do TikTok!');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };

  socket.onclose = () => {
    console.log('Reconectando WebSocket em 2s...');
    setTimeout(connectWebSocket, 2000);
  };
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'INIT_STATE':
      Object.assign(state, data.state);
      updateUI();
      break;

    case 'POINTS_ADDED':
      Object.assign(state, data.state);
      triggerPointAnimation(data.side, data.points, data.user, data.reason);
      updateUI();
      break;

    case 'TIMER_UPDATE':
      state.timerSeconds = data.timerSeconds;
      formatTimer();
      break;

    case 'TIKTOK_STATUS':
      state.isLiveConnected = data.connected;
      if (data.username) state.tiktokUsername = data.username;
      updateConnectionStatus(data.connected, data.error);
      break;

    case 'WINNER':
      showVictory(data.winner);
      break;

    case 'GAME_RESET':
      Object.assign(state, data.state);
      hideVictory();
      updateUI();
      break;

    case 'TARGET_UPDATED':
      state.targetScore = data.target;
      targetDisplay.textContent = state.targetScore;
      updateUI();
      break;
  }
}

// Formatar Tempo MM:SS
function formatTimer() {
  const mins = Math.floor(state.timerSeconds / 60);
  const secs = state.timerSeconds % 60;
  clockDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Atualizar Placar e UI
function updateUI() {
  scoreLeftEl.textContent = state.scoreLeft;
  scoreRightEl.textContent = state.scoreRight;
  targetDisplay.textContent = state.targetScore;
  giftsLeftEl.textContent = `🎁 ${state.totalGiftsLeft} presentes`;
  giftsRightEl.textContent = `🎁 ${state.totalGiftsRight} presentes`;

  const total = state.scoreLeft + state.scoreRight;
  statTotal.textContent = total;

  const diff = Math.abs(state.scoreLeft - state.scoreRight);
  statDiff.textContent = diff;

  // Porcentagens
  let pLeft = 50;
  let pRight = 50;
  if (total > 0) {
    pLeft = ((state.scoreLeft / total) * 100);
    pRight = ((state.scoreRight / total) * 100);
  }
  percentLeftEl.textContent = `${pLeft.toFixed(1)}%`;
  percentRightEl.textContent = `${pRight.toFixed(1)}%`;
  progressLeftEl.style.width = `${pLeft}%`;
  progressRightEl.style.width = `${pRight}%`;

  // Barra de Meta até 1200
  const maxScore = Math.max(state.scoreLeft, state.scoreRight);
  const goalPerc = Math.min(100, (maxScore / state.targetScore) * 100);
  goalBarFill.style.width = `${goalPerc}%`;
  goalPercent.textContent = `${Math.floor(goalPerc)}%`;

  // Indicador de Liderança
  if (state.scoreLeft > state.scoreRight) {
    leaderBadge.className = 'leader-badge lead-red';
    leaderText.textContent = '13 NA FRENTE';
    frontBadgeLeft.classList.remove('hidden');
    frontBadgeRight.classList.add('hidden');
  } else if (state.scoreRight > state.scoreLeft) {
    leaderBadge.className = 'leader-badge lead-blue';
    leaderText.textContent = '22 NA FRENTE';
    frontBadgeLeft.classList.add('hidden');
    frontBadgeRight.classList.remove('hidden');
  } else {
    leaderBadge.className = 'leader-badge';
    leaderText.textContent = 'EMPATE';
    frontBadgeLeft.classList.add('hidden');
    frontBadgeRight.classList.add('hidden');
  }
}

// Animação de Pontos, Mão Votando e Urna
function triggerPointAnimation(side, points, user, reason) {
  const isLeft = side === 'left';
  const scoreEl = isLeft ? scoreLeftEl : scoreRightEl;
  const floatContainer = document.getElementById(isLeft ? 'floatContainerLeft' : 'floatContainerRight');
  const hand = isLeft ? handLeft : handRight;
  const btnConfirma = isLeft ? btnConfirmaLeft : btnConfirmaRight;
  const tickerText = isLeft ? tickerTextLeft : tickerTextRight;
  const digit1 = isLeft ? urnaDigitL1 : urnaDigitR1;
  const digit2 = isLeft ? urnaDigitL2 : urnaDigitR2;

  // 1. Som de Urna
  playUrnaConfirmaSound();

  // 2. Animação da Mão Votando
  hand.classList.add('vote-action');
  btnConfirma.classList.add('pressed');
  digit1.classList.add('flash');
  digit2.classList.add('flash');

  setTimeout(() => {
    hand.classList.remove('vote-action');
    btnConfirma.classList.remove('pressed');
    digit1.classList.remove('flash');
    digit2.classList.remove('flash');
  }, 350);

  // 3. Efeito Pop no Placar
  scoreEl.classList.add('pop');
  setTimeout(() => scoreEl.classList.remove('pop'), 200);

  // 4. Texto Flutuante (+1, +5)
  const floatEl = document.createElement('div');
  floatEl.className = 'floating-point';
  floatEl.textContent = `+${points}`;
  floatContainer.appendChild(floatEl);
  setTimeout(() => floatEl.remove(), 1200);

  // 5. Ticker de quem votou
  tickerText.textContent = `${user} • ${reason} • +${points} pts`;
}

// Tela de Vitória e Confetes
let confettiAnimationId = null;
function showVictory(winner) {
  playVictorySound();
  victoryTitle.textContent = `${winner} VENCEU!`;
  victoryModal.classList.remove('hidden');

  let countdown = 5;
  resetCountdownEl.textContent = countdown;
  const timer = setInterval(() => {
    countdown--;
    if (countdown >= 0) resetCountdownEl.textContent = countdown;
    if (countdown <= 0) clearInterval(timer);
  }, 1000);

  startConfetti();
}

function hideVictory() {
  victoryModal.classList.add('hidden');
  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
}

// Efeito Confete sem biblioteca externa
function startConfetti() {
  const ctx = confettiCanvas.getContext('2d');
  confettiCanvas.width = victoryModal.clientWidth;
  confettiCanvas.height = victoryModal.clientHeight;

  const particles = [];
  const colors = ['#ff0055', '#0099ff', '#ffeb3b', '#00ff66', '#ffffff', '#ff9900'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * confettiCanvas.height - confettiCanvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 4 + 3,
      speedX: (Math.random() - 0.5) * 3,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  }

  function render() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotSpeed;

      if (p.y > confettiCanvas.height) {
        p.y = -10;
        p.x = Math.random() * confettiCanvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    confettiAnimationId = requestAnimationFrame(render);
  }
  render();
}

// Controles do Streamer Dock
dockToggle.addEventListener('click', () => streamerDock.classList.remove('hidden'));
closeDock.addEventListener('click', () => streamerDock.classList.add('hidden'));

soundToggle.addEventListener('change', (e) => {
  soundEnabled = e.target.checked;
});

btnDockConnect.addEventListener('click', () => {
  initAudio();
  const user = dockTiktokUser.value.trim();
  if (!user) return alert('Digite seu nome de usuário do TikTok!');
  dockStatus.textContent = 'Conectando à live...';
  socket.send(JSON.stringify({ action: 'CONNECT_TIKTOK', username: user }));
});

function updateConnectionStatus(connected, error) {
  if (connected) {
    dockStatus.textContent = `🟢 Conectado ao vivo em @${state.tiktokUsername}!`;
    dockStatus.style.color = '#38ef7d';
    document.getElementById('liveStatusText').textContent = 'AO VIVO';
  } else {
    dockStatus.textContent = error ? `🔴 Erro: ${error}` : '⚪ Desconectado';
    dockStatus.style.color = error ? '#ef4444' : '#f59e0b';
    document.getElementById('liveStatusText').textContent = 'OFFLINE';
  }
}

// Botões de Teste
function sendTest(action, payload = {}) {
  initAudio();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action, ...payload }));
  }
}

document.getElementById('testChat13').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'left', points: 1, user: '@viewer_teste', reason: 'Comentou 13' });
});

document.getElementById('testRosa13').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'left', points: 5, user: '@apoiador_lula', reason: 'Rosa x1', count: 1 });
});

document.getElementById('testChat22').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'right', points: 1, user: '@viewer_teste', reason: 'Comentou 22' });
});

document.getElementById('testRosa22').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'right', points: 5, user: '@apoiador_bolso', reason: 'Rosa Branca x1', count: 1 });
});

document.getElementById('testAdd100L').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'left', points: 100, user: '@super_combo', reason: 'Combo x20' });
});

document.getElementById('testAdd100R').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'right', points: 100, user: '@super_combo', reason: 'Combo x20' });
});

document.getElementById('testWin').addEventListener('click', () => {
  sendTest('ADD_POINTS', { side: 'left', points: 1200, user: '@finalizador', reason: 'Mega Presente' });
});

document.getElementById('testReset').addEventListener('click', () => {
  sendTest('RESET_GAME');
});

// Desbloquear áudio no primeiro clique na página
window.addEventListener('click', () => initAudio(), { once: true });

// Inicia
connectWebSocket();
updateUI();
formatTimer();
