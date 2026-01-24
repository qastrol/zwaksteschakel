let ws = null;
let wsConnected = false;

let channel = null;

let gameState = {
  phase: 'waiting', 
  players: [],
  currentRound: 0,
  currentPlayer: null,
  currentQuestion: '',
  moneyChain: [],
  chainPosition: 0,
  bankTotal: 0,
  roundBanked: 0, 
  roundTime: 0,
  votingTime: 25,
  h2hScores: [0, 0],
  h2hAnswers: [[],[]], 
  finalists: [],
  h2hStrongest: null,
  h2hStarterIndex: null,
  maxTotal: 15.00
};

const scenes = {
  waiting: document.getElementById('scene-waiting'),
  lobby: document.getElementById('scene-lobby'),
  'round-ready': document.getElementById('scene-round-ready'),
  round: document.getElementById('scene-round'),
  voting: document.getElementById('scene-voting'),
  elimination: document.getElementById('scene-elimination'),
  'h2h-select': document.getElementById('scene-h2h-select'),
  'h2h-start': document.getElementById('scene-h2h-start'),
  headtohead: document.getElementById('scene-headtohead'),
  winner: document.getElementById('scene-winner')
};

function init() {
  console.log('Display geïnitialiseerd. Verbinden met server...');
  showScene('waiting');
  
  connectWebSocket();
  
  setTimeout(() => {
    if (!wsConnected) {
      console.log('WebSocket niet beschikbaar, gebruik BroadcastChannel');
      setupBroadcastChannel();
    }
  }, 2000);
}

function connectWebSocket() {
  try {
    ws = new WebSocket('ws://' + window.location.host);
    
    ws.onopen = () => {
      console.log('WebSocket verbonden met server');
      wsConnected = true;
      
      ws.send(JSON.stringify({
        type: 'register',
        role: 'display'
      }));
      
      updateStatus('Verbonden met server');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleHostMessage(data);
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket verbinding gesloten');
      wsConnected = false;
      updateStatus('Verbinding verbroken - probeer opnieuw...');
      
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      wsConnected = false;
    };
  } catch (e) {
    console.error('Kon geen WebSocket verbinding maken:', e);
    wsConnected = false;
  }
}

function setupBroadcastChannel() {
  try {
    channel = new BroadcastChannel('zwakste_schakel');
    
    channel.onmessage = (event) => {
      handleHostMessage(event.data);
    };
    
    channel.postMessage({ type: 'display_ready' });
    
    updateStatus('Lokale verbinding actief (BroadcastChannel)');
  } catch (e) {
    console.error('BroadcastChannel niet beschikbaar:', e);
  }
}

function updateStatus(message) {
  const statusEls = document.querySelectorAll('.hint-text, .status-text');
  statusEls.forEach(el => {
    if (el.textContent.includes('verbinding') || el.textContent.includes('Verbonden')) {
      el.textContent = message;
    }
  });
}

function handleHostMessage(data) {
  console.log('Ontvangen van host:', data);
  
  switch (data.type) {
    case 'game_created':
      gameState.players = data.players;
      gameState.moneyChain = data.moneyChain;
      gameState.maxTotal = data.maxTotal;
      showLobby();
      break;
      
    case 'round_ready':
      gameState.currentRound = data.round;
      showRoundReady();
      break;
      
    case 'round_started':
      gameState.currentRound = data.round;
      gameState.roundTime = data.time;
      gameState.chainPosition = 0;
      gameState.roundBanked = 0; 
      showRound();
      break;
      
    case 'question_changed':
      gameState.currentPlayer = data.player;
      gameState.currentQuestion = data.question;
      updateQuestion();
      break;
      
    case 'answer_correct':
      handleCorrectAnswer();
      break;
      
    case 'answer_wrong':
      handleWrongAnswer();
      break;
      
    case 'bank':
      handleBank(data.amount);
      updateTussenstand();
      break;

    case 'bank_max':
      showBankMaxMessage();
      break;
      
    case 'round_timer':
      gameState.roundTime = data.time;
      updateRoundTimer();
      break;
      
    case 'voting_started':
      gameState.votingTime = data.time;
      showVoting(data.stats);
      break;
      
    case 'voting_timer':
      gameState.votingTime = data.time;
      updateVotingTimer();
      break;
      
    case 'player_eliminated':
      showElimination(data.playerName);
      break;
      
    case 'headtohead_started':
      gameState.finalists = data.finalists || [];
      gameState.h2hStarterIndex = (typeof data.starter === 'number') ? data.starter : null;
      if (data.starter !== undefined) {
        showH2HStart(data.finalists, data.starter);
      } else {
        showHeadToHead(data.finalists);
      }
      break;

    case 'h2h_selection':
      gameState.finalists = data.finalists || [];
      gameState.h2hStrongest = data.strongestName || null;
      showH2HSelection(gameState.finalists, gameState.h2hStrongest);
      break;
      
    case 'h2h_question':
      updateH2HQuestion(data.question, data.activePlayer);
      break;
      
    case 'h2h_score':
      gameState.h2hScores = data.scores;
      updateH2HScores();
      break;
      
    case 'game_winner':
      showWinner(data.winner, data.prize);
      break;
      
    case 'game_reset':
      resetDisplay();
      break;
      
    case 'state_sync':
      Object.assign(gameState, data.state);
      syncToCurrentState();
      break;
  }
}

function showScene(sceneName) {
  Object.values(scenes).forEach(scene => {
    if (scene) scene.classList.remove('active');
  });
  
  if (scenes[sceneName]) {
    scenes[sceneName].classList.add('active');
    gameState.phase = sceneName;
  }
}

function showLobby() {
  const container = document.getElementById('lobbyPlayers');
  container.innerHTML = '';
  
  const activePlayers = gameState.players.filter(p => !p.elim);
  
  activePlayers.forEach((player, index) => {
    const playerEl = document.createElement('div');
    playerEl.className = 'lobby-player';
    const avatarSrc = player.avatar || './assets/avatar.png';
    playerEl.innerHTML = `
      <img src="${avatarSrc}" alt="${player.name}" class="lobby-player-avatar">
      <div class="lobby-player-name">${player.name}</div>
      <div class="lobby-player-number">Kandidaat ${index + 1}</div>
    `;
    container.appendChild(playerEl);
  });
  
  document.getElementById('lobbyMaxTotal').textContent = `€${gameState.maxTotal.toFixed(2)}`;
  document.getElementById('lobbyPlayerCount').textContent = activePlayers.length;
  
  showScene('lobby');
}

function showRoundReady() {
  const roundNum = gameState.currentRound + 1;
  document.getElementById('roundReadyTitle').textContent = `Ronde ${roundNum}`;
  document.getElementById('tussenstandReadyTotal').textContent = `€${gameState.bankTotal.toFixed(2).replace('.', ',')}`;
  
  const stepsCol = document.getElementById('moneyChainStepsReady');
  const stackCol = document.getElementById('moneyChainStackReady');
  if (stepsCol && stackCol) {
    stepsCol.innerHTML = '';
    stackCol.innerHTML = '';
    
    const chain = gameState.moneyChain.slice();
    const chainLen = chain.length;
    
    chain.forEach((amount, idx) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'chain-step';
      stepEl.textContent = `€${amount.toFixed(2).replace('.', ',')}`;
      stepsCol.appendChild(stepEl);
    });
  }
  
  const potEl = document.getElementById('potStepReady');
  if (potEl) potEl.textContent = `€0,00`;
  
  const container = document.getElementById('activePlayers3');
  if (container) {
    container.innerHTML = '';
    const activePlayers = gameState.players.filter(p => !p.elim);
    activePlayers.forEach(player => {
      const avatarSrc = player.avatar || './assets/avatar.png';
      const playerEl = document.createElement('div');
      playerEl.className = 'player-card-row';
      playerEl.innerHTML = `
        <img src="${avatarSrc}" alt="${player.name}" class="player-avatar-row">
        <div class="player-name-row">${player.name}</div>
      `;
      container.appendChild(playerEl);
    });
  }
  
  showScene('round-ready');
}

function showH2HSelection(finalists = [], strongestName = '') {
  if (!finalists.length) return;

  const avatar1 = finalists[0].avatar || './assets/avatar.png';
  const avatar2 = finalists[1].avatar || './assets/avatar.png';

  document.getElementById('h2hSelectAvatar1').src = avatar1;
  document.getElementById('h2hSelectAvatar2').src = avatar2;
  document.getElementById('h2hSelectName1').textContent = finalists[0].name;
  document.getElementById('h2hSelectName2').textContent = finalists[1].name;

  const strongestEl = document.getElementById('h2hStrongestName');
  if (strongestEl) {
    strongestEl.textContent = strongestName || 'Sterkste schakel';
  }

  showScene('h2h-select');
}

function showRound() {
  const roundTitle = document.getElementById('roundTitle');
  const alive = gameState.players.filter(p => !p.elim).length;
  
  if (alive > 2) {
    roundTitle.textContent = `Ronde ${gameState.currentRound + 1}`;
  } else if (alive === 2) {
    roundTitle.textContent = `Finale Ronde`;
  }
  
  renderActivePlayers2();
  
  renderMoneyChain();
  
  showScene('round');
}

function renderActivePlayers2() {
  const container = document.getElementById('activePlayers2');
  if (!container) return;
  
  container.innerHTML = '';
  
  const activePlayers = gameState.players.filter(p => !p.elim);
  
  activePlayers.forEach(player => {
    const isActive = gameState.currentPlayer && gameState.currentPlayer.id === player.id;
    const avatarSrc = player.avatar || './assets/avatar.png';
    
    const playerEl = document.createElement('div');
    playerEl.className = `player-card-row ${player.elim ? 'eliminated' : ''} ${isActive ? 'active-player' : ''}`;
    playerEl.innerHTML = `
      <img src="${avatarSrc}" alt="${player.name}" class="player-avatar-row">
      <div class="player-name-row">${player.name}</div>
    `;
    container.appendChild(playerEl);
  });
}

function renderMoneyChain() {
  const stepsCol = document.getElementById('moneyChainSteps');
  const stackCol = document.getElementById('moneyChainStack');
  if (!stepsCol || !stackCol) return;
  stepsCol.innerHTML = '';
  stackCol.innerHTML = '';

  const chain = gameState.moneyChain.slice();
  const chainLen = chain.length;
  const lastIndex = chainLen - 1;
  const topReady = chainLen > 0 && gameState.chainPosition >= chainLen;

  const futureStart = topReady ? chainLen : gameState.chainPosition;
  const futureSteps = chain.slice(futureStart, chainLen);

  futureSteps.forEach((amount, idx) => {
    const originalIndex = futureStart + idx;
    const stepEl = document.createElement('div');
    stepEl.className = 'chain-step';

    if (originalIndex === lastIndex) {
      stepEl.classList.add('top-step');
    }

    if (!topReady && originalIndex === gameState.chainPosition) {
      stepEl.classList.add('active');
    }

    stepEl.textContent = `€${amount.toFixed(2).replace('.', ',')}`;
    stepsCol.appendChild(stepEl);
  });

  const achievedSteps = topReady ? chain : chain.slice(0, gameState.chainPosition);
  achievedSteps.forEach((amount, idx) => {
    const absoluteIndex = idx;
    const stepEl = document.createElement('div');
    stepEl.className = 'chain-step stacked achieved';

    if (absoluteIndex === lastIndex) {
      stepEl.classList.add('top-step');
    }

    stepEl.textContent = `€${amount.toFixed(2).replace('.', ',')}`;
    stackCol.appendChild(stepEl);
  });

  const potTotal = (gameState.roundBanked || 0);
  const potEl = document.getElementById('potStep');
  if (potEl) potEl.textContent = `€${potTotal.toFixed(2).replace('.', ',')}`;
}

function updateQuestion() {
  if (gameState.currentPlayer) {
    document.getElementById('currentPlayerName').textContent = gameState.currentPlayer.name;
    
    const avatarImg = document.getElementById('questionPlayerAvatar');
    const nameDisplay = document.getElementById('questionPlayerNameDisplay');
    const wrapper = document.querySelector('.player-slide-wrapper');
    
    if (avatarImg && nameDisplay && wrapper) {
      wrapper.classList.remove('slide-from-left', 'slide-from-right');
      
      const slideDirection = Math.random() > 0.5 ? 'slide-from-left' : 'slide-from-right';
      
      wrapper.style.animation = 'none';
      setTimeout(() => {
        avatarImg.src = gameState.currentPlayer.photo || './assets/avatar.png';
        nameDisplay.textContent = gameState.currentPlayer.name;
        wrapper.classList.add(slideDirection);
        wrapper.style.animation = '';
      }, 10);
    }
  }
  document.getElementById('questionText').textContent = gameState.currentQuestion || 'Wachten op vraag...';
  
  renderActivePlayers2();
}

function handleCorrectAnswer() {
  const chainLen = gameState.moneyChain.length;
  if (chainLen > 0 && gameState.chainPosition < chainLen) {
    gameState.chainPosition++;
    renderMoneyChain();
  }
  
  flashEffect('#22c55e');
}

function handleWrongAnswer() {
  gameState.chainPosition = 0;
  renderMoneyChain();
  
  flashEffect('#dc2626');
}

function handleBank(amount) {
  gameState.bankTotal += amount;
  gameState.roundBanked += amount;
  
  gameState.chainPosition = 0;
  renderMoneyChain();
  
  flashEffect('#ffd60a');
}

function showBankMaxMessage() {
  const messageEl = document.getElementById('bankMaxMessage');
  if (messageEl) {
    messageEl.style.display = 'block';
    
    setTimeout(() => {
      messageEl.style.transition = 'opacity 0.5s ease-out';
      messageEl.style.opacity = '0';
      setTimeout(() => {
        messageEl.style.display = 'none';
        messageEl.style.opacity = '1';
        messageEl.style.transition = '';
      }, 500);
    }, 4000);
  }
}

function updateRoundTimer() {
  const minutes = Math.floor(gameState.roundTime / 60);
  const seconds = gameState.roundTime % 60;
  document.getElementById('roundTimer').textContent = 
    `⏱ ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTussenstand() {
  const el = document.getElementById('tussenstandTotal');
  if (el) {
    el.textContent = `€${gameState.bankTotal.toFixed(2).replace('.', ',')}`;
  }
}

function showVoting(statsData) {
  const container = document.getElementById('votingStats');
  container.innerHTML = '';
  
  const alivePlayers = gameState.players.filter(p => !p.elim);
  
  alivePlayers.forEach(player => {
    const playerEl = document.createElement('div');
    playerEl.className = 'voting-player';
    const avatarSrc = player.avatar || './assets/avatar.png';
    playerEl.innerHTML = `
      <img src="${avatarSrc}" alt="${player.name}" class="voting-player-avatar">
      <div class="voting-player-name">${player.name}</div>
    `;
    container.appendChild(playerEl);
  });
  
  const swContainer = document.getElementById('strongestWeakestDisplay');
  swContainer.innerHTML = '';
  
  showScene('voting');
}

function updateVotingTimer() {
  const minutes = Math.floor(gameState.votingTime / 60);
  const seconds = gameState.votingTime % 60;
  document.getElementById('votingTimerDisplay').textContent = 
    `⏱ ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showElimination(playerName) {
  const eliminatedPlayer = gameState.players.find(p => p.name === playerName);
  document.getElementById('eliminatedPlayerName').textContent = playerName;
  
  const avatarEl = document.getElementById('eliminatedPlayerAvatar');
  if (eliminatedPlayer && avatarEl) {
    avatarEl.src = eliminatedPlayer.avatar || './assets/avatar.png';
  }
  
  showScene('elimination');
  
  setTimeout(() => {
    const alive = gameState.players.filter(p => !p.elim).length;
    if (alive === 2) {
    } else if (alive > 2) {
    }
  }, 5000);
}

function showH2HStart(finalists, starterIndex) {
  const avatar1 = finalists[0].avatar || './assets/avatar.png';
  const avatar2 = finalists[1].avatar || './assets/avatar.png';
  
  document.getElementById('h2hStartAvatar1').src = avatar1;
  document.getElementById('h2hStartAvatar2').src = avatar2;
  document.getElementById('h2hStartName1').textContent = finalists[0].name;
  document.getElementById('h2hStartName2').textContent = finalists[1].name;
  
  const starter = finalists[starterIndex];
  document.getElementById('h2hStarterName').textContent = starter.name;
  
  showScene('h2h-start');
  
  setTimeout(() => {
    showHeadToHead(finalists);
  }, 4000);
}

function showHeadToHead(finalists) {
  const player1 = document.getElementById('h2hPlayer1');
  const player2 = document.getElementById('h2hPlayer2');
  
  const avatar1 = finalists[0].avatar || './assets/avatar.png';
  const avatar2 = finalists[1].avatar || './assets/avatar.png';
  
  player1.querySelector('.h2h-player-name').textContent = finalists[0].name;
  player2.querySelector('.h2h-player-name').textContent = finalists[1].name;
  
  let img1 = player1.querySelector('.h2h-player-avatar');
  let img2 = player2.querySelector('.h2h-player-avatar');
  if (img1) img1.src = avatar1;
  if (img2) img2.src = avatar2;
  
  initializeScoreBalls();
  
  showScene('headtohead');
}

function initializeScoreBalls() {
  const ballsContainer1 = document.getElementById('h2hScoreBalls1');
  const ballsContainer2 = document.getElementById('h2hScoreBalls2');
  
  ballsContainer1.innerHTML = '';
  ballsContainer2.innerHTML = '';
  
  gameState.h2hAnswers = [[], []]; 
  
  for (let i = 0; i < 5; i++) {
    const ball1 = document.createElement('div');
    ball1.className = 'h2h-score-ball';
    ball1.id = `h2h-ball-1-${i}`;
    ballsContainer1.appendChild(ball1);
    
    const ball2 = document.createElement('div');
    ball2.className = 'h2h-score-ball';
    ball2.id = `h2h-ball-2-${i}`;
    ballsContainer2.appendChild(ball2);
  }
  
  updateH2HScores();
}

function updateH2HQuestion(question, activePlayerIndex) {
  document.getElementById('h2hQuestion').textContent = question;
  
  const players = document.querySelectorAll('.h2h-player');
  players.forEach((p, i) => {
    if (i === activePlayerIndex) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

function updateH2HScores() {
  const scores = gameState.h2hScores;
  
  for (let i = 0; i < 5; i++) {
    const ball = document.getElementById(`h2h-ball-1-${i}`);
    if (ball) {
      ball.classList.remove('correct', 'wrong');
      if (i < scores[0]) {
        ball.classList.add('correct');
      }
    }
  }
  
  for (let i = 0; i < 5; i++) {
    const ball = document.getElementById(`h2h-ball-2-${i}`);
    if (ball) {
      ball.classList.remove('correct', 'wrong');
      if (i < scores[1]) {
        ball.classList.add('correct');
      }
    }
  }
  
  document.getElementById('h2hScoreText1').textContent = `${scores[0]}/5`;
  document.getElementById('h2hScoreText2').textContent = `${scores[1]}/5`;
}

function showWinner(winner, prize) {
    const avatarImg = document.getElementById('winnerAvatar');
    if (avatarImg) {
      avatarImg.src = winner.photo || winner.avatar || './assets/avatar.png';
    }
  document.getElementById('winnerName').textContent = winner.name;
  document.getElementById('winnerPrize').textContent = `€${prize.toFixed(2)}`;
  showScene('winner');
}

function resetDisplay() {
  gameState = {
    phase: 'waiting',
    players: [],
    currentRound: 0,
    currentPlayer: null,
    currentQuestion: '',
    moneyChain: [],
    chainPosition: 0,
    bankTotal: 0,
    roundBanked: 0,
    roundTime: 0,
    votingTime: 25,
    h2hScores: [0, 0],
    h2hAnswers: [[], []],
    finalists: [],
    h2hStrongest: null,
    h2hStarterIndex: null,
    maxTotal: 15.00
  };
  
  showScene('waiting');
}

function syncToCurrentState() {
  switch (gameState.phase) {
    case 'lobby':
      showLobby();
      break;
    case 'round-ready':
      showRoundReady();
      break;
    case 'round':
      showRound();
      break;
    case 'voting':
      showVoting(gameState.votingStats || []);
      break;
    case 'h2h-select':
      showH2HSelection(gameState.finalists || [], gameState.h2hStrongest);
      break;
    case 'h2h-start':
      if (gameState.finalists && gameState.finalists.length) {
        const starter = typeof gameState.h2hStarterIndex === 'number' ? gameState.h2hStarterIndex : 0;
        showH2HStart(gameState.finalists, starter);
      }
      break;
    case 'headtohead':
      showHeadToHead(gameState.finalists || []);
      break;
    default:
      showScene(gameState.phase);
  }
}

function flashEffect(color) {
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.top = '0';
  flash.style.left = '0';
  flash.style.width = '100%';
  flash.style.height = '100%';
  flash.style.backgroundColor = color;
  flash.style.opacity = '0.3';
  flash.style.pointerEvents = 'none';
  flash.style.zIndex = '9999';
  flash.style.transition = 'opacity 0.5s ease';
  
  document.body.appendChild(flash);
  
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 500);
  }, 100);
}

window.addEventListener('DOMContentLoaded', init);
