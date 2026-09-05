// Pool de Emojis
const EMOJI_POOL = ['🚀', '👾', '⚡', '🎮', '🤖', '🔮', '⭐', '🔥', '💎', '🧠', '👑', '🌈', '🎯', '🎨', '🍕', '🐱', '🦄', '0️⃣'];

// Estado Global
let currentScreen = 'menu'; 
let level = 1;
let moves = 0;
let pairsFound = 0;
let totalPairs = 3;
let cards = [];
let flippedCards = [];
let lockBoard = false;

// Estado de Salud / Vida
let health = 100;
const MAX_HEALTH = 100;
let healthTimer = null;

// Variables Dwell (Permanencia)
let hoveredCard = null;
let hoverTimer = null;
const HOVER_DURATION = 1200;
const circleRadius = 20;
const circumference = 2 * Math.PI * circleRadius;

// Variables para Posicionamiento de Cursor
let cursorTargetX = 0;
let cursorTargetY = 0;
let cursorCurrentX = 0;
let cursorCurrentY = 0;
let isHandPresent = false;

function updateCursorTarget(landmark) {
  const x = Number(landmark.x);
  const y = Number(landmark.y);
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

  if (!Number.isFinite(x) || !Number.isFinite(y) || viewportWidth <= 0 || viewportHeight <= 0) {
    return false;
  }

  cursorTargetX = (1 - Math.max(0, Math.min(1, x))) * viewportWidth;
  cursorTargetY = Math.max(0, Math.min(1, y)) * viewportHeight;
  return true;
}

// Elementos DOM
const menuScreen = document.getElementById('menu-screen');
const calibrationScreen = document.getElementById('calibration-screen');
const gameScreen = document.getElementById('game-screen');
const scoresModal = document.getElementById('scores-modal');
const gameoverModal = document.getElementById('gameover-modal');

const btnPlay = document.getElementById('btn-play');
const btnScores = document.getElementById('btn-scores');
const btnCloseScores = document.getElementById('btn-close-scores');
const btnStartGame = document.getElementById('btn-start-game');
const btnRestart = document.getElementById('btn-restart');

const calibStatus = document.getElementById('calib-status');
const bestLevelDisplay = document.getElementById('best-level');
const goLevelDisplay = document.getElementById('go-level');

const gridContainer = document.getElementById('grid-container');
const levelDisplay = document.getElementById('level-display');
const movesDisplay = document.getElementById('moves-display');
const pairsDisplay = document.getElementById('pairs-display');
const musicTrackDisplay = document.getElementById('music-track-display');
const eventBanner = document.getElementById('event-banner');

const healthBarFill = document.getElementById('health-bar-fill');
const healthText = document.getElementById('health-text');

const cursor = document.getElementById('hand-cursor');
const progressCircle = document.querySelector('.progress-ring-circle');

// Mover el cursor a la raíz del body para evitar bloqueos por contenedores padres
document.body.appendChild(cursor);

// Canvas y Video
const videoElement = document.getElementById('webcam');
const calibCanvas = document.getElementById('calib-canvas');
const calibCtx = calibCanvas.getContext('2d');

const gameCanvas = document.getElementById('webcam-canvas');
const gameCtx = gameCanvas.getContext('2d');

progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// ==========================================
// SINTETIZADOR DE MÚSICA DE FONDO (Web Audio)
// ==========================================
let audioCtx = null;
let musicInterval = null;
let currentTrackIndex = 1;

const MUSIC_SCALES = {
  1: [261.63, 293.66, 329.63, 392.00, 440.00], 
  2: [220.00, 246.94, 261.63, 293.66, 329.63], 
  3: [174.61, 196.00, 220.00, 261.63, 293.66]  
};

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function startMusic() {
  initAudio();
  stopMusic();

  currentTrackIndex = Math.floor((level - 1) / 10) + 1;
  const scaleKey = ((currentTrackIndex - 1) % 3) + 1;
  const currentScale = MUSIC_SCALES[scaleKey];
  const speed = Math.max(180, 320 - (currentTrackIndex * 20));

  musicTrackDisplay.textContent = `Track ${currentTrackIndex}`;

  let noteIdx = 0;
  musicInterval = setInterval(() => {
    if (audioCtx && audioCtx.state === 'running') {
      const freq = currentScale[noteIdx % currentScale.length];
      playSynthNote(freq, 0.15, 'sine');
      
      if (noteIdx % 2 === 0) {
        playSynthNote(freq / 2, 0.25, 'triangle');
      }
      noteIdx++;
    }
  }, speed);
}

function stopMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

function playSynthNote(freq, duration, type = 'sine') {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// 1. Manejo de Menú y Pantallas
btnPlay.addEventListener('click', () => {
  switchScreen('calibration');
  initCamera();
});

btnScores.addEventListener('click', () => {
  const maxLevel = localStorage.getItem('vision_game_max_level') || 1;
  bestLevelDisplay.textContent = maxLevel;
  scoresModal.classList.remove('hidden');
});

btnCloseScores.addEventListener('click', () => {
  scoresModal.classList.add('hidden');
});

btnStartGame.addEventListener('click', () => {
  switchScreen('game');
  health = MAX_HEALTH;
  level = 1;
  initGame();
});

btnRestart.addEventListener('click', () => {
  gameoverModal.classList.add('hidden');
  switchScreen('game');
  health = MAX_HEALTH;
  level = 1;
  initGame();
});

function switchScreen(screenName) {
  currentScreen = screenName;
  menuScreen.classList.add('hidden');
  calibrationScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');

  if (screenName === 'menu') {
    menuScreen.classList.remove('hidden');
    cursor.style.display = 'none';
    stopMusic();
  }
  if (screenName === 'calibration') {
    calibrationScreen.classList.remove('hidden');
    cursor.style.display = 'none';
  }
  if (screenName === 'game') {
    gameScreen.classList.remove('hidden');
  }
}

// 2. Visión por Computadora (MediaPipe)
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onHandResults);

let camera = null;

function initCamera() {
  if (!camera) {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });
    camera.start();
    requestAnimationFrame(updateCursorLoop);
  }
}

function onHandResults(results) {
  const isCalib = currentScreen === 'calibration';
  const isGame = currentScreen === 'game';

  if (!isCalib && !isGame) return;

  const targetCanvas = isCalib ? calibCanvas : gameCanvas;
  const targetCtx = isCalib ? calibCtx : gameCtx;

  const videoW = videoElement.videoWidth || 640;
  const videoH = videoElement.videoHeight || 480;

  targetCanvas.width = videoW;
  targetCanvas.height = videoH;

  targetCtx.save();
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  
  if (results.image) {
    targetCtx.drawImage(results.image, 0, 0, targetCanvas.width, targetCanvas.height);
  }

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    const connections = window.HAND_CONNECTIONS || (typeof HAND_CONNECTIONS !== 'undefined' ? HAND_CONNECTIONS : []);
    if (connections.length > 0) {
      drawConnectors(targetCtx, landmarks, connections, { color: '#00f2fe', lineWidth: 2 });
    }
    drawLandmarks(targetCtx, landmarks, { color: '#ff007f', lineWidth: 1, radius: 3 });

    if (isCalib) {
      btnStartGame.disabled = false;
      calibStatus.textContent = "¡Mano Detectada! Listo para continuar";
      calibStatus.className = "status-badge ready";
    } else if (isGame) {
      const indexTip = landmarks[8];
      if (!indexTip || !updateCursorTarget(indexTip)) {
        isHandPresent = false;
        cursor.style.display = 'none';
      } else {
        if (!isHandPresent) {
          cursorCurrentX = cursorTargetX;
          cursorCurrentY = cursorTargetY;
        }

        isHandPresent = true;
        cursor.style.display = 'block';
      }
    }
  } else {
    if (isCalib) {
      btnStartGame.disabled = true;
      calibStatus.textContent = "Buscando mano...";
      calibStatus.className = "status-badge waiting";
    } else if (isGame) {
      isHandPresent = false;
      cursor.style.display = 'none';
      clearDwellTimer();
    }
  }
  targetCtx.restore();
}

// Bucle de renderizado del cursor (Interpolación Suave + Colisión)
function updateCursorLoop() {
  if (currentScreen === 'game' && isHandPresent) {
    cursorCurrentX += (cursorTargetX - cursorCurrentX) * 0.35;
    cursorCurrentY += (cursorTargetY - cursorCurrentY) * 0.35;

    cursor.style.left = `${cursorCurrentX}px`;
    cursor.style.top = `${cursorCurrentY}px`;
    cursor.style.display = 'block';

    processHoverInteraction(cursorCurrentX, cursorCurrentY);
  } else if (!isHandPresent || currentScreen !== 'game') {
    cursor.style.display = 'none';
  }
  requestAnimationFrame(updateCursorLoop);
}

// 3. Sistema de Vida y Temporizadores
function startHealthTimer() {
  stopHealthTimer();
  healthTimer = setInterval(() => {
    modifyHealth(-1);
  }, 5000);
}

function stopHealthTimer() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

function modifyHealth(amount) {
  health += amount;

  if (health > MAX_HEALTH) {
    health = MAX_HEALTH;
  }

  if (health <= 0) {
    health = 0;
    updateHealthUI();
    triggerGameOver();
    return;
  }

  if (amount !== 0) {
    showFloatingDamage(amount);
  }

  updateHealthUI();
}

function showFloatingDamage(amount) {
  const damageText = document.createElement('div');
  damageText.classList.add('floating-damage');
  if (amount > 0) {
    damageText.classList.add('positive');
  }
  damageText.textContent = `${amount > 0 ? '+' : ''}${amount} pts`;

  const padding = 100;
  const randomX = Math.random() * (window.innerWidth - padding * 2) + padding;
  const randomY = Math.random() * (window.innerHeight - padding * 2) + padding;

  damageText.style.left = `${randomX}px`;
  damageText.style.top = `${randomY}px`;

  document.body.appendChild(damageText);

  setTimeout(() => {
    damageText.remove();
  }, 1000);
}

function updateHealthUI() {
  healthText.textContent = `${health} / ${MAX_HEALTH}`;
  healthBarFill.style.width = `${health}%`;

  healthBarFill.className = 'health-bar-fill';
  if (health <= 25) {
    healthBarFill.classList.add('danger');
  } else if (health <= 50) {
    healthBarFill.classList.add('warning');
  }
}

function triggerGameOver() {
  stopHealthTimer();
  stopMusic();
  playSynthNote(100, 0.8, 'sawtooth');

  goLevelDisplay.textContent = level;
  gameoverModal.classList.remove('hidden');
}

// 4. Lógica del Juego
function initGame() {
  totalPairs = Math.min(3 + Math.floor((level - 1) / 2), EMOJI_POOL.length);
  pairsFound = 0;
  moves = 0;
  flippedCards = [];
  lockBoard = false;

  const savedMax = localStorage.getItem('vision_game_max_level') || 1;
  if (level > savedMax) {
    localStorage.setItem('vision_game_max_level', level);
  }

  updateHUD();
  updateHealthUI();
  applyLevelEvents();
  generateBoard();
  startHealthTimer();
  startMusic();
}

function generateBoard() {
  gridContainer.innerHTML = '';
  
  const shuffledPool = [...EMOJI_POOL].sort(() => Math.random() - 0.5);
  const selectedEmojis = shuffledPool.slice(0, totalPairs);
  const deck = [...selectedEmojis, ...selectedEmojis].sort(() => Math.random() - 0.5);

  deck.forEach((symbol, index) => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.symbol = symbol;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="card-face card-front"></div>
      <div class="card-face card-back">${symbol}</div>
    `;

    card.addEventListener('click', () => handleCardSelect(card));
    gridContainer.appendChild(card);
  });

  cards = Array.from(document.querySelectorAll('.card'));
}

function handleCardSelect(card) {
  if (lockBoard || card.classList.contains('flipped') || card.classList.contains('matched') || health <= 0) {
    return;
  }

  card.classList.add('flipped');
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    updateHUD();
    checkMatch();
  }
}

function checkMatch() {
  lockBoard = true;
  const [card1, card2] = flippedCards;
  const isMatch = card1.dataset.symbol === card2.dataset.symbol;

  if (isMatch) {
    card1.classList.add('matched');
    card2.classList.add('matched');
    pairsFound++;
    modifyHealth(5);
    updateHUD();
    flippedCards = [];
    lockBoard = false;

    playSynthNote(523.25, 0.2, 'sine');

    if (pairsFound === totalPairs) {
      stopHealthTimer();

      setTimeout(() => {
        alert(`¡Nivel ${level} Completado!`);
        level++;
        initGame();
      }, 400);
    }
  } else {
    modifyHealth(-5);

    setTimeout(() => {
      card1.classList.add('wrong');
      card2.classList.add('wrong');
    }, 200);

    setTimeout(() => {
      card1.classList.remove('wrong', 'flipped');
      card2.classList.remove('wrong', 'flipped');
      flippedCards = [];
      lockBoard = false;
    }, 1200);
  }
}

function updateHUD() {
  levelDisplay.textContent = level;
  movesDisplay.textContent = moves;
  pairsDisplay.textContent = `${pairsFound} / ${totalPairs}`;
}

function applyLevelEvents() {
  document.body.className = '';
  eventBanner.classList.add('hidden');

  if (level % 5 === 0) {
    const events = ['event-inverted', 'event-dark'];
    const selectedEvent = events[(level / 5) % events.length];
    document.body.classList.add(selectedEvent);
    eventBanner.classList.remove('hidden');
  }
}

// 5. Dwell Timer
function processHoverInteraction(x, y) {
  const elementUnderCursor = document.elementFromPoint(x, y);
  const card = elementUnderCursor ? elementUnderCursor.closest('.card') : null;

  if (card && !card.classList.contains('flipped') && !lockBoard) {
    if (hoveredCard !== card) {
      clearDwellTimer();
      hoveredCard = card;
      card.classList.add('hovered');
      startDwellTimer(card);
    }
  } else {
    if (hoveredCard) {
      hoveredCard.classList.remove('hovered');
      hoveredCard = null;
    }
    clearDwellTimer();
  }
}

function startDwellTimer(card) {
  let startTime = Date.now();

  hoverTimer = setInterval(() => {
    let elapsedTime = Date.now() - startTime;
    let progress = Math.min(elapsedTime / HOVER_DURATION, 1);

    const offset = circumference - (progress * circumference);
    progressCircle.style.strokeDashoffset = offset;

    if (progress >= 1) {
      clearDwellTimer();
      handleCardSelect(card);
    }
  }, 30);
}

function clearDwellTimer() {
  if (hoverTimer) {
    clearInterval(hoverTimer);
    hoverTimer = null;
  }
  progressCircle.style.strokeDashoffset = circumference;
}