// Emojis para el juego
const EMOJI_POOL = ['🚀', '👾', '⚡', '🎮', '🤖', '🔮', '⭐', '🔥', '💎', '🧠', '👑', '🌈'];

// Estado del juego
let level = 1;
let moves = 0;
let pairsFound = 0;
let totalPairs = 3;
let cards = [];
let flippedCards = [];
let lockBoard = false;

// Variables Dwell (Permanencia)
let hoveredCard = null;
let hoverTimer = null;
const HOVER_DURATION = 1200;
const circleRadius = 20;
const circumference = 2 * Math.PI * circleRadius;

// Elementos DOM
const gridContainer = document.getElementById('grid-container');
const levelDisplay = document.getElementById('level-display');
const movesDisplay = document.getElementById('moves-display');
const pairsDisplay = document.getElementById('pairs-display');
const eventBanner = document.getElementById('event-banner');
const cursor = document.getElementById('hand-cursor');
const progressCircle = document.querySelector('.progress-ring-circle');
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('webcam-canvas');
const canvasCtx = canvasElement.getContext('2d');

progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// 1. Lógica del Juego
function initGame() {
  totalPairs = 3 + Math.floor((level - 1) / 10);
  pairsFound = 0;
  moves = 0;
  flippedCards = [];
  lockBoard = false;

  updateHUD();
  applyLevelEvents();
  generateBoard();
}

function generateBoard() {
  gridContainer.innerHTML = '';
  const selectedEmojis = EMOJI_POOL.slice(0, totalPairs);
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
  if (lockBoard || card.classList.contains('flipped') || card.classList.contains('matched')) {
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
    updateHUD();
    flippedCards = [];
    lockBoard = false;

    if (pairsFound === totalPairs) {
      setTimeout(() => {
        alert(`¡Nivel ${level} Completado! 🎉`);
        level++;
        initGame();
      }, 500);
    }
  } else {
    // Mostrar X Neón al equivocarse
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

// 2. Visión por Computadora y Renderizado en Canvas
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

function onHandResults(results) {
  // Ajustar dimensiones del canvas
  canvasElement.width = videoElement.videoWidth || 320;
  canvasElement.height = videoElement.videoHeight || 240;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    cursor.classList.remove('hidden');
    const landmarks = results.multiHandLandmarks[0];

    // Dibujar conexiones y puntos de la mano en la ventana de la cámara
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00f2fe', lineWidth: 2 });
    drawLandmarks(canvasCtx, landmarks, { color: '#ff007f', lineWidth: 1, radius: 3 });

    // Coordenadas de la punta del dedo índice (Landmark 8)
    const indexTip = landmarks[8];

    // Calculo invertido para efecto espejo exacto
    const x = (1 - indexTip.x) * window.innerWidth;
    const y = indexTip.y * window.innerHeight;

    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;

    processHoverInteraction(x, y);
  } else {
    cursor.classList.add('hidden');
    clearDwellTimer();
  }
  canvasCtx.restore();
}

// Inicializador con MediaPipe Camera Utility
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});

camera.start();

// 3. Sistema Dwell Timer
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

// Iniciar Juego
initGame();