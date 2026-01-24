const bedjeFiles = [
  '0：45.mp3','1：00.mp3','1：10.mp3','1：15.mp3','1：20.mp3','1：30.mp3','1：40.mp3','1：45.mp3','1：50.mp3','2：00.mp3','2：10.mp3','2：15.mp3','2：20.mp3','2：30.mp3','2：40.mp3','2：45.mp3','2：50.mp3','3：00.mp3'
];
function parseLabelToSeconds(label){
  const base = label.replace('.mp3','').replace('：',':');
  const parts = base.split(':');
  const m = parseInt(parts[0],10);
  const s = parseInt(parts[1]||0,10);
  return m*60 + s;
}
const bedjeTimes = bedjeFiles.map(f=>({file:f,secs:parseLabelToSeconds(f)})).sort((a,b)=>a.secs-b.secs);

const numInput = document.getElementById('num');
const playersInputs = document.getElementById('playersInputs');
const applyBtn = document.getElementById('applyBtn');
const resetBtn = document.getElementById('resetBtn');
const roundsList = document.getElementById('roundsList');
const moneyChainDiv = document.getElementById('moneyChain');
const playerCountSpan = document.getElementById('playerCount');
const currentRoundLabel = document.getElementById('currentRound');
const bankTotalEl = document.getElementById('bankTotal');
const chainValueEl = document.getElementById('chainValue');
const startRoundBtn = document.getElementById('startRound');
const nextRoundBtn = document.getElementById('nextRound');
const bankBtn = document.getElementById('bankBtn');
const wrongBtn = document.getElementById('wrongBtn');
const rightBtn = document.getElementById('rightBtn');
const voteArea = document.getElementById('voteArea');
const eliminateBtn = document.getElementById('eliminateBtn');
let bedjeAudio; 
bedjeAudio = new Audio();
let inSuddenDeath = false;
let sdCurrentPlayer = 0; // 0 of 1
let sdScores = [0,0];
let sdQuestions = [0,0];
let effectAudio = new Audio();
let currentQuestionIndex = 0;
let currentPlayerForQuestion = null;
let inHeadToHead = false;
let globalAudio = new Audio();
let chainDistributionMode = 'classic';
let players = [];
let rounds = []; 
let moneyChain = []; 
let currentRound = 0; 
let chainAccum = 0.0;
let bankTotal = 0.0;
let eliminated = [];
let roundTimerInterval = null;
let roundTimeLeft = 0; 
let usedQuestions = [];
let maxTotalAmount = 15.00; 
let chainIndex = 0;
let currentRoundQuestions = []; 
let playerAvatars = {}; 
let bankTotalAtRoundStart = 0; 
let roundBanked = 0; 
let gamePhase = 'setup'; 
let twoPlayerMode = 'play'; 
let autoBankOnMax = false; 
let candidateVotes = {}; 
let firstRoundStartMode = 'alphabetical';
let ws = null;
let wsConnected = false;

function connectWebSocket() {
  try {
    ws = new WebSocket('ws://' + window.location.host);
    
    ws.onopen = () => {
      console.log('WebSocket verbonden met server');
      wsConnected = true;
      
      ws.send(JSON.stringify({
        type: 'register',
        role: 'host'
      }));
      
      flashMessage('✓ Verbonden met server');
    };
    
    ws.onclose = () => {
      console.log('WebSocket verbinding gesloten');
      wsConnected = false;
      flashMessage('⚠ Verbinding met server verbroken');
      
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      wsConnected = false;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Ontvangen van server:', data.type);
        
        if (data.type === 'state_sync') {
          console.log('State sync ontvangen van server');
        } else if (data.type === 'candidate_vote') {
          handleCandidateVote(data.voterId, data.votedForId);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };
  } catch (e) {
    console.error('Kon geen WebSocket verbinding maken:', e);
    wsConnected = false;
  }
}

function broadcastToDisplay(data) {
  if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
      return;
    } catch (e) {
      console.warn('WebSocket verzenden mislukt:', e);
      wsConnected = false;
    }
  }
  
  try {
    if (!window.localChannel) {
      window.localChannel = new BroadcastChannel('zwakste_schakel');
    }
    window.localChannel.postMessage(data);
  } catch (e) {
    console.warn('BroadcastChannel ook mislukt:', e);
  }
}

function handleCandidateVote(voterId, votedForId) {
    if (gamePhase !== 'voting') {
        console.warn('Candidate vote received outside voting phase');
        return;
    }

    const voter = players.find(p => p.id == voterId);
    const votedFor = players.find(p => p.id == votedForId);

    if (!voter || !votedFor || voter.elim || votedFor.elim) {
        console.warn('Invalid candidate vote:', voterId, votedForId);
        return;
    }

    if (voterId == votedForId) {
        console.warn('Player cannot vote for themselves');
        return;
    }

    candidateVotes[voterId] = votedForId;
    console.log(`Candidate vote recorded: ${voter.name} voted for ${votedFor.name}`);

    const radioBtn = document.querySelector(`input[name="vote"][value="${votedForId}"]`);
    if (radioBtn) {
        radioBtn.checked = true;
        flashMessage(`Stem ontvangen van ${voter.name} voor ${votedFor.name}`);
    }

    const alivePlayers = players.filter(p => !p.elim);
    const votesReceived = Object.keys(candidateVotes).length;
    if (votesReceived === alivePlayers.length) {
        flashMessage('Alle kandidaten hebben gestemd!');
    }
}

if (typeof WebSocket !== 'undefined') {
  connectWebSocket();
}


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

document.getElementById('setMaxTotalBtn').addEventListener('click', () => {
  const input = document.getElementById('maxTotalInput');
  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) {
    flashMessage('Voer een geldig positief bedrag in (bijv. 20.00)');
    return;
  }
  maxTotalAmount = Math.round(val * 100) / 100;

  document.getElementById('maxTotalDisplay').textContent = 
    `Huidig maximum: €${maxTotalAmount.toFixed(2)}`;

  flashMessage(`Maximaal totaalbedrag ingesteld op €${maxTotalAmount.toFixed(2)}.`);
});


function renderPlayerInputs(){
  playersInputs.innerHTML = '';
  const n = Math.max(2,Math.min(10,parseInt(numInput.value)||2));
  for(let i=0;i<n;i++){
    const inp = document.createElement('input');
    inp.type='text'; inp.placeholder = `Kandidaat ${i+1}`; inp.id = `p${i}`;
    playersInputs.appendChild(inp);
  }
  
  renderPhotoUpload(n);
}

function renderPhotoUpload(playerCount){
  const photosContainer = document.getElementById('playerPhotos');
  const photosGrid = document.getElementById('photosGrid');
  
  photosContainer.style.display = 'block';
  photosGrid.innerHTML = '';
  
  for(let i=0; i<playerCount; i++){
    const playerNameInput = document.getElementById(`p${i}`);
    const playerName = (playerNameInput && playerNameInput.value.trim()) || `Kandidaat ${i+1}`;
    const photoCard = document.createElement('div');
    photoCard.className = 'photo-card';
    
    const avatarSrc = playerAvatars[i] || './assets/avatar.png';
    const hasCustomAvatar = !!playerAvatars[i];
    
    photoCard.innerHTML = `
      <div class="photo-card-content">
        <img src="${avatarSrc}" id="avatar-${i}" alt="Avatar voor ${playerName}" class="photo-preview" style="cursor: pointer;">
        <input type="file" id="photo-input-${i}" accept="image/*" data-player-index="${i}" style="display:none;">
        <div class="photo-label">${playerName}</div>
        <div class="photo-actions">
          <button class="photo-btn upload-btn" id="upload-btn-${i}" type="button">Upload</button>
          ${hasCustomAvatar ? `<button class="photo-btn remove-btn" id="remove-btn-${i}" type="button">Verwijder</button>` : ''}
        </div>
      </div>
    `;
    
    photosGrid.appendChild(photoCard);
    
    const uploadBtn = photoCard.querySelector(`#upload-btn-${i}`);
    uploadBtn.addEventListener('click', () => {
      document.getElementById(`photo-input-${i}`).click();
    });
    
    const avatarImg = photoCard.querySelector(`#avatar-${i}`);
    avatarImg.addEventListener('click', () => {
      document.getElementById(`photo-input-${i}`).click();
    });
    
    const input = photoCard.querySelector(`#photo-input-${i}`);
    input.addEventListener('change', (e) => handlePhotoUpload(e, i));
    
    if (hasCustomAvatar) {
      const removeBtn = photoCard.querySelector(`#remove-btn-${i}`);
      removeBtn.addEventListener('click', () => removePhotoUpload(i));
    }
  }
}

function handlePhotoUpload(event, playerIndex){
  const file = event.target.files[0];
  if(!file) return;
  
  if(file.size > 2 * 1024 * 1024){
    flashMessage(`Foto voor kandidaat ${playerIndex+1} is te groot (max 2MB)`);
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    playerAvatars[playerIndex] = dataUrl;
    
    document.getElementById(`avatar-${playerIndex}`).src = dataUrl;
    
    renderPhotoUpload(Math.max(2, Math.min(10, parseInt(numInput.value) || 2)));
    
    flashMessage(`Foto voor kandidaat ${playerIndex+1} geüpload`);
  };
  
  reader.readAsDataURL(file);
}

function removePhotoUpload(playerIndex){
  delete playerAvatars[playerIndex];
  
  renderPhotoUpload(Math.max(2, Math.min(10, parseInt(numInput.value) || 2)));
  
  flashMessage(`Foto voor kandidaat ${playerIndex+1} verwijderd`);
}

numInput.addEventListener('change', renderPlayerInputs);
renderPlayerInputs();

function chooseStartTimeByPlayers(n){
  if(n>=8) return 180; 
  if(n>=6) return 150; 
  if(n==5) return 140; 
  if(n==4) return 120; 
  if(n==3) return 110; 
  return 90; 
}

function chooseMinTimeByPlayers(n){
  if(n>=8) return 60; 
  if(n>=5) return 45; 
  if(n>=3) return 45;
  return 45;
}

function secondsToLabel(s){
  const m = Math.floor(s/60); const sec = s%60; return `${m}:${String(sec).padStart(2,'0')}`;
}

function findClosestBedje(secs){
  let candidate = bedjeTimes[0];
  for(const b of bedjeTimes){
    if(b.secs===secs) return b;
    if(b.secs<=(secs)) candidate = b;
    if(b.secs>secs) break;
  }
  return candidate;
}

function buildRounds(n) {
  const seq = [];

  const roundsNeeded = Math.max(1, n - 2);

  let baseTime = 150 + Math.max(0, n - 8) * 10; 
  if (n < 8) baseTime = 150 - (8 - n) * 10; 
  baseTime = Math.max(90, Math.min(baseTime, 180)); 

  for (let i = 0; i < roundsNeeded; i++) {
    const secs = baseTime - i * 10;
    const chosen = findClosestBedje(secs);
    seq.push({
      round: i + 1,
      secs: chosen.secs,
      label: secondsToLabel(chosen.secs),
      file: chosen.file,
      type: 'normal'
    });
  }

  if (twoPlayerMode === 'play') {
    const lastNormalSecs = Math.max(60, baseTime - roundsNeeded * 10);
    const extra = findClosestBedje(lastNormalSecs);
    seq.push({
      round: roundsNeeded + 1,
      secs: extra.secs,
      label: secondsToLabel(extra.secs) + ' — finale ronde',
      file: extra.file,
      type: 'normal-final' 
    });
  }

  seq.push({
    round: seq.length + 1,
    secs: 0,
    label: 'Head-to-Head',
    file: null,
    type: 'head-to-head'
  });

  return seq;
}




function playSound(src, {loop=false, stopCurrent=true, volume=1.0} = {}) {
    if(stopCurrent && !globalAudio.paused) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
    }
    globalAudio.src = src;
    globalAudio.loop = loop;
    globalAudio.volume = volume;
    globalAudio.currentTime = 0;
    globalAudio.play().catch(e => console.warn("Kon audio niet afspelen:", e));
}


function nextQuestion(){
  if(!quizQuestions || quizQuestions.length === 0) return;
  const player = currentPlayerForQuestion;
  const q = quizQuestions[currentQuestionIndex % quizQuestions.length];
  
  const displayArea = document.getElementById('currentQuestion');
  if(!displayArea){
    console.warn("Maak een div aan met id='currentQuestion' voor de vraagweergave");
    return;
  }

  displayArea.innerHTML = `<strong>${player.name}</strong>, jouw vraag:<br>${q.question}`;
  currentQuestionIndex++;
}


function buildMoneyChain() {
  const chainLength = players.length; 
  
  let roundsCount = (twoPlayerMode === 'skip') ? Math.max(1, chainLength - 2) : Math.max(1, chainLength - 1);
  const maxTotal = maxTotalAmount;

  let baseShape = [];
  for (let i = 1; i <= chainLength; i++) {
    baseShape.push(Math.pow(i, 2.2)); 
  }
  const topValueInShape = baseShape[baseShape.length - 1];

  let currentRoundTopValue = 0;

  if (chainDistributionMode === 'revival') {
    let weights = [];
    
    const stepEveryRound = (chainLength < 6);

    for (let i = 0; i < roundsCount; i++) {
      let w;
      if (i === roundsCount - 1 && roundsCount > 1) {
      } else {
        if (stepEveryRound) {
          w = 1 + i;
        } else {
          w = 1 + Math.floor(i / 2);
        }
        
        if (w >= 4) w = 3.5; 
      }
      weights.push(w);
    }

    const totalWeightSum = weights.reduce((a, b) => a + b, 0);
    const valuePerWeight = maxTotal / totalWeightSum;
    currentRoundTopValue = weights[currentRound] * valuePerWeight;
  } else {
    currentRoundTopValue = maxTotal / roundsCount;
  }

  const multiplier = currentRoundTopValue / topValueInShape;
  
  const chain = baseShape.map((val, idx) => {
    let scaled = val * multiplier;

    if (idx === chainLength - 1) return Math.round(scaled * 100) / 100;

    if (scaled >= 100) return Math.round(scaled / 5) * 5;
    if (scaled >= 10) return Math.round(scaled);
    if (scaled >= 1) return Math.round(scaled * 2) / 2; 
    return Math.round(scaled * 10) / 10;
  });

  return chain;
}


function renderRoundsList(){
  roundsList.innerHTML = '';
  rounds.forEach(r=>{
    const el = document.createElement('div'); el.className='round-pill';
    el.textContent = `Ronde ${r.round}: ${r.label}`;
    roundsList.appendChild(el);
  })
}

function renderChain(){
  moneyChainDiv.innerHTML = '';
  moneyChain.forEach((c,idx)=>{
    const d = document.createElement('div'); d.className='step'; d.textContent = `€${c.toFixed(2)}`;
    moneyChainDiv.appendChild(d);
  })
}

function renderPlayersUI(){
  voteArea.innerHTML = '';
  const alive = players.filter(p=>!p.elim);
  alive.forEach((p,idx)=>{
    const card = document.createElement('div');
    card.className='player-card';

    const name = document.createElement('div');
    name.textContent = p.name;
    name.style.fontWeight='600';

    const info = document.createElement('div');
    info.className='muted';

    const stats = p.roundStats[currentRound] || {correct:0, wrong:0, banked:0};
    info.textContent = `Goed: ${stats.correct}, Fout: ${stats.wrong}, Gebankt: ${stats.banked}`;

    const radio = document.createElement('input');
    radio.type='radio';
    radio.name='vote';
    radio.value=p.id;
    radio.id=`vote-${p.id}`;

    card.appendChild(name);
    card.appendChild(info);
    card.appendChild(document.createElement('br'));
    card.appendChild(radio);
    voteArea.appendChild(card);
  })
}


function startSuddenDeath(){
  inSuddenDeath = true;
  const finalists = players.filter(p=>!p.elim);
  if(finalists.length !== 2){
    flashMessage('Sudden death vereist precies 2 spelers!');
    return;
  }

  const first = prompt(`Wie mag beginnen met de eerste vraag? Typ de naam van ${finalists[0].name} of ${finalists[1].name}`);
  if(!first) return;
  sdCurrentPlayer = finalists.findIndex(p => p.name.toLowerCase() === first.toLowerCase());
  if(sdCurrentPlayer === -1) sdCurrentPlayer = 0;

  sdScores = [0,0];
  sdQuestions = [0,0];

  flashMessage(`Sudden death gestart!\n${finalists[sdCurrentPlayer].name} begint.\nElk krijgt 5 vragen.`);
  updateSuddenDeathUI();
}

function updateSuddenDeathUI(){
  const finalists = players.filter(p=>!p.elim);
  currentRoundLabel.textContent = `Sudden death — ${finalists[0].name}: ${sdScores[0]} / ${sdQuestions[0]} — ${finalists[1].name}: ${sdScores[1]} / ${sdQuestions[1]}`;
}

function flashMessage(msg, duration = 5000) { 
  const container = document.getElementById('flashContainer');
  if(!container) return;

  const div = document.createElement('div');
  div.className = 'flash-message';
  div.textContent = msg;

  container.appendChild(div);

  setTimeout(() => {
    div.style.transition = 'opacity 0.5s ease-in-out';
    div.style.opacity = 0;
    setTimeout(() => container.removeChild(div), 500); 
  }, duration - 500); 
}


function getStrongestAndWeakest(roundIndex) {
    const alive = players.filter(p => !p.elim);
    if(alive.length === 0) return {strongest: null, weakest: null};

    const roundStats = p => p.roundStats[roundIndex] || {correct:0, wrong:0, banked:0};

    let maxCorrect = Math.max(...alive.map(p => roundStats(p).correct));
    let strongest = alive.filter(p => roundStats(p).correct === maxCorrect);
    if(strongest.length > 1){
        let minWrong = Math.min(...strongest.map(p => roundStats(p).wrong));
        strongest = strongest.filter(p => roundStats(p).wrong === minWrong);
    }
    if(strongest.length > 1){
        let minBanked = Math.min(...strongest.map(p => roundStats(p).banked));
        strongest = strongest.filter(p => roundStats(p).banked === minBanked);
    }
    if(strongest.length > 1){
        strongest.sort((a,b)=>a.name.localeCompare(b.name));
    }
    const strongestPlayer = strongest[0];

    let minCorrect = Math.min(...alive.map(p => roundStats(p).correct));
    let weakest = alive.filter(p => roundStats(p).correct === minCorrect);
    if(weakest.length > 1){
        let maxWrong = Math.max(...weakest.map(p => roundStats(p).wrong));
        weakest = weakest.filter(p => roundStats(p).wrong === maxWrong);
    }
    if(weakest.length > 1){
        let maxBanked = Math.max(...weakest.map(p => roundStats(p).banked));
        weakest = weakest.filter(p => roundStats(p).banked === maxBanked);
    }
    if(weakest.length > 1){
        weakest.sort((a,b)=>a.name.localeCompare(b.name));
    }
    const weakestPlayer = weakest[0];

    return {strongest: strongestPlayer, weakest: weakestPlayer};
}

function calculateStrongestAndWeakest(roundIndex) {
  const alive = players.filter(p => !p.elim);
  if (alive.length === 0) return { strongest: null, weakest: null };

  function stats(p) {
    return p.roundStats[roundIndex] || { correct: 0, wrong: 0, banked: 0 };
  }

  const strongest = [...alive].sort((a, b) => {
    const sa = stats(a);
    const sb = stats(b);
    if (sb.correct !== sa.correct) return sb.correct - sa.correct; 
    if (sa.wrong !== sb.wrong) return sa.wrong - sb.wrong;         
    if (sa.banked !== sb.banked) return sa.banked - sb.banked;     
    return a.name.localeCompare(b.name);                           
  })[0];

  const weakest = [...alive].sort((a, b) => {
    const sa = stats(a);
    const sb = stats(b);
    if (sa.correct !== sb.correct) return sa.correct - sb.correct; 
    if (sb.wrong !== sa.wrong) return sb.wrong - sa.wrong;         
    if (sb.banked !== sa.banked) return sb.banked - sa.banked;     
    return a.name.localeCompare(b.name);                           
  })[0];

  return { strongest, weakest };
}

function renderStrongestWeakest(roundIndex = currentRound) {
  const div = document.getElementById("strongestWeakest");
  if (!div) return;

  const { strongest, weakest } = calculateStrongestAndWeakest(roundIndex);
  if (!strongest || !weakest) {
    div.innerHTML = `<em>Nog onvoldoende gegevens voor deze ronde.</em>`;
    return;
  }

  const s = strongest.roundStats[roundIndex] || { correct: 0, wrong: 0, banked: 0 };
  const w = weakest.roundStats[roundIndex] || { correct: 0, wrong: 0, banked: 0 };

  div.innerHTML = `
    <strong>Sterkste schakel:</strong> ${strongest.name} 
    — Goed: ${s.correct}, Fout: ${s.wrong}, Gebankt: ${s.banked}<br>
    <strong>Zwakste schakel:</strong> ${weakest.name} 
    — Goed: ${w.correct}, Fout: ${w.wrong}, Gebankt: ${w.banked}
  `;
}

function updateStatsAndStrongWeak(player, type) {
  player.roundStats = player.roundStats || {};
  player.roundStats[currentRound] = player.roundStats[currentRound] || { correct: 0, wrong: 0, banked: 0 };

  switch (type) {
    case "correct":
      player.roundStats[currentRound].correct++;
      break;
    case "wrong":
      player.roundStats[currentRound].wrong++;
      break;
    case "banked":
      player.roundStats[currentRound].banked++;
      break;
  }

  updatePlayerCard(player);
  renderStrongestWeakest(currentRound);
}


applyBtn.addEventListener('click', ()=>{
    const n = Math.max(2, Math.min(10, parseInt(numInput.value) || 2));
    
    const twoPlayerModeSelect = document.getElementById('twoPlayerMode');
    twoPlayerMode = twoPlayerModeSelect ? twoPlayerModeSelect.value : 'play';

    const startModeSelect = document.getElementById('firstRoundStartMode');
firstRoundStartMode = startModeSelect ? startModeSelect.value : 'alphabetical';

    const distSelect = document.getElementById('chainDistributionMode');
    chainDistributionMode = distSelect ? distSelect.value : 'classic';

    const autoBankSelect = document.getElementById('autoBankMode');
    const autoMode = autoBankSelect ? autoBankSelect.value : 'manual';
    autoBankOnMax = (autoMode === 'auto');
    
    players = [];
    for (let i = 0; i < n; i++) {
        const inp = document.getElementById(`p${i}`);
        const name = (inp && inp.value.trim()) ? inp.value.trim() : `Kandidaat ${i+1}`;
        players.push({
          id:i, 
          name:name, 
          elim:false,
          roundStats:{}, 
          avatar: playerAvatars[i] || './assets/avatar.png' 
        });
    }
    playerCountSpan.textContent = players.length;
    rounds = buildRounds(players.length);
    moneyChain = buildMoneyChain(players.length);
    currentRound = 0;
    chainAccum = 0.0;
    bankTotal = 0.0;
    eliminated = [];
    gamePhase = 'setup';

    if(quizQuestions && quizQuestions.length > 1){
        shuffleArray(quizQuestions);
    }

    renderRoundsList(); 
    renderChain(); 
    renderPlayersUI(); 
    updateHeads();
    updateButtonVisibility();
    
    broadcastToDisplay({
        type: 'game_created',
        players: players,
        moneyChain: moneyChain,
        maxTotal: maxTotalAmount
    });
});


resetBtn.addEventListener('click', ()=>{ 
    broadcastToDisplay({ type: 'game_reset' });
    location.reload(); 
});

function updateHeads(){
    const alivePlayers = players.filter(p => !p.elim);

    if(inHeadToHead){
        currentRoundLabel.textContent = `Ronde ${rounds.length + 1} — Head-to-Head`;
    } else {
        currentRoundLabel.textContent = `Ronde ${currentRound+1} van ${rounds.length}`;
    }

    bankTotalEl.textContent = `€${bankTotal.toFixed(2)}`;
    chainValueEl.textContent = `€${chainAccum.toFixed(2)}`;

    if(window.MoneyChainOverlay) {
        updateOverlay({
            currentRound,
            chainAccum,
            bankTotal,
            moneyChain
        });
    }
}


startRoundBtn.addEventListener('click', ()=>{
    if(!rounds.length) return flashMessage('Maak eerst het spel aan.');

    const r = rounds[currentRound];
    const alivePlayers = players.filter(p => !p.elim);

    if(r.type === 'head-to-head'){
        startHeadToHeadSelection();
        return;
    }

    startNormalRound(r);
    
    broadcastToDisplay({
        type: 'round_started',
        round: currentRound,
        time: r.secs
    });
    
    updateButtonVisibility();
});


function startNormalRound(r){
    const numQuestions = 50;
    const questionsForRound = getNewQuestions(numQuestions);

    currentRoundQuestions = questionsForRound;
    currentQuestionIndex = 0;

    const find = findClosestBedje(r.secs);
    if(!bedjeAudio) bedjeAudio = new Audio();
    bedjeAudio.src = './bedjes/' + find.file;
    bedjeAudio.currentTime = 0;
    bedjeAudio.play().catch(()=>{});

    moneyChain = buildMoneyChain(players.filter(p => !p.elim).length + 1); // Bereken nieuwe ketting
    renderChain();
    sendChainToOverlay();
    chainAccum = 0; chainIndex = 0;
    bankTotalAtRoundStart = bankTotal;
    roundBanked = 0;
    updateHeads();
    gamePhase = 'round_active';

    currentPlayerForQuestion = determineFirstPlayer(currentRound);
    showQuestion(currentPlayerForQuestion);

    startRoundTimer(r.secs);
    rounds[currentRound].eliminationDone = false;
    eliminateBtn.disabled = true;
}


function showNextHeadToHeadQuestion() {
    const finalists = players.filter(p => !p.elim);
    if(finalists.length !== 2) return;

    const player = finalists[sdCurrentPlayer];
    currentPlayerForQuestion = player;

    const q = quizQuestions[currentQuestionIndex % quizQuestions.length];
    currentQuestionIndex++;

    const questionDiv = document.getElementById('h2hQuestion');
    questionDiv.innerHTML = `<strong>${player.name}</strong>, jouw vraag:<br>${q.question}<br><em>Antwoord(en): ${q.answers.join(' / ')}</em>`;

    updateHeadToHeadScoresUI();
    
    broadcastToDisplay({
        type: 'h2h_question',
        question: q.question,
        activePlayer: sdCurrentPlayer
    });
}

function h2hRight() {
    const finalists = players.filter(p => !p.elim);

    if(inSuddenDeath){
        sdScores[sdCurrentPlayer]++; 
        sdQuestions[sdCurrentPlayer]++;

        sdCurrentPlayer = sdCurrentPlayer === 0 ? 1 : 0;
        
        broadcastToDisplay({
            type: 'h2h_score',
            scores: sdScores
        });
        
        showNextHeadToHeadQuestion();
        return;
    }

    sdScores[sdCurrentPlayer]++;
    sdQuestions[sdCurrentPlayer]++;
    
    broadcastToDisplay({
        type: 'h2h_score',
        scores: sdScores
    });
    
    checkHeadToHeadProgress();
}

function h2hWrong() {
    const finalists = players.filter(p => !p.elim);

    if(!inSuddenDeath && sdQuestions[0] >=5 && sdQuestions[1] >=5){
        return;
    }

    if(!inSuddenDeath && sdQuestions[0] >=0 && sdQuestions[1] >=0){
        sdQuestions[sdCurrentPlayer]++;
        
        broadcastToDisplay({
            type: 'h2h_score',
            scores: sdScores
        });
        
        checkHeadToHeadProgress();
        return;
    }

    if(inSuddenDeath){
        const loser = finalists[sdCurrentPlayer];
        const winner = finalists[sdCurrentPlayer === 0 ? 1 : 0];
        declareWinner(winner);
        return;
    }

    sdQuestions[sdCurrentPlayer]++;
    
    broadcastToDisplay({
        type: 'h2h_score',
        scores: sdScores
    });
    
    sdCurrentPlayer = sdCurrentPlayer === 0 ? 1 : 0;
    showNextHeadToHeadQuestion();
}

function startSuddenDeath() {
    const finalists = players.filter(p=>!p.elim);
    if(finalists.length !== 2){
        flashMessage('Sudden Death vereist precies 2 spelers!');
        return;
    }

    inSuddenDeath = true;
    sdScores = [0,0];
    sdQuestions = [0,0];

    const first = prompt(`Wie mag beginnen met de eerste Sudden Death vraag? Typ de naam van ${finalists[0].name} of ${finalists[1].name}`);
    sdCurrentPlayer = finalists.findIndex(p => p.name.toLowerCase() === first.toLowerCase());
    if(sdCurrentPlayer === -1) sdCurrentPlayer = 0;

    flashMessage(`Sudden Death gestart! De eerste fout betekent verlies.`);

    showNextHeadToHeadQuestion();
}

function checkHeadToHeadProgress() {
    const finalists = players.filter(p => !p.elim);

    if(!inSuddenDeath){
        if(sdQuestions[0] >=5 && sdQuestions[1] >=5){
            if(sdScores[0] > sdScores[1]){
                declareWinner(finalists[0]);
                return;
            } else if(sdScores[1] > sdScores[0]){
                declareWinner(finalists[1]);
                return;
            } else {
                inSuddenDeath = true;
                sdQuestions = [0,0]; 
                flashMessage('Gelijkspel! Sudden Death start!');
            }
        }
    } else {
        if(sdQuestions[0] > 0 && sdQuestions[1] > 0){
            const last0 = sdScores[0];
            const last1 = sdScores[1];
            if(Math.abs(last0 - last1) === 1){
                const winner = last0 > last1 ? finalists[0] : finalists[1];
                declareWinner(winner);
                return;
            }
        }
    }

    sdCurrentPlayer = sdCurrentPlayer === 0 ? 1 : 0;
    showNextHeadToHeadQuestion();
}

function declareWinner(player){
    flashMessage(`🎉 ${player.name} wint het spel en neemt het geld!`);
    inHeadToHead = false;
    inSuddenDeath = false;
    gamePhase = 'setup';

    if(bedjeAudio && !bedjeAudio.paused){
        bedjeAudio.pause();
        bedjeAudio.currentTime = 0;
    }

  const h2hContainer = document.getElementById('headToHeadContainer');
  if (h2hContainer) h2hContainer.style.display = 'none';

  playWinnerMusic();
    
    broadcastToDisplay({
        type: 'game_winner',
        winner: player,
        prize: bankTotal
    });

    showRegularUI();
}

function playWinnerMusic() {
  const player = effectAudio || new Audio();
  player.pause();
  player.currentTime = 0;
  player.src = "./soundtrack/Winner's Theme.mp3";
  player.play().catch(() => {
    const fallbacks = [
      './soundtrack/Main Sting.mp3',
      './soundtrack/Head to Head Start Sting.mp3'
    ];
    let i = 0;
    const tryFallback = () => {
      if (i >= fallbacks.length) return;
      player.pause();
      player.currentTime = 0;
      player.src = fallbacks[i++];
      player.play().catch(tryFallback);
    };
    tryFallback();
  });
}



function updateHeadToHeadScoresUI(){
    const finalists = players.filter(p=>!p.elim);
    const scoresDiv = document.getElementById('h2hScores');
    scoresDiv.innerHTML = `
        ${finalists[0].name}: ${sdScores[0]} / 5 vragen goed<br>
        ${finalists[1].name}: ${sdScores[1]} / 5 vragen goed
    `;
}

document.getElementById('h2hRightBtn').onclick = h2hRight;
document.getElementById('h2hWrongBtn').onclick = h2hWrong;


function checkSuddenDeathProgress(){
  const finalists = players.filter(p=>!p.elim);
  updateSuddenDeathUI();

  if(sdQuestions[sdCurrentPlayer] >= 5){
    sdCurrentPlayer = (sdCurrentPlayer === 0 ? 1 : 0);
  }

  if(sdQuestions[0] >= 5 && sdQuestions[1] >= 5){
    inSuddenDeath = false;
    const [s1, s2] = sdScores;
    let msg = `Einde Sudden Death!\n\n${finalists[0].name}: ${s1} goed\n${finalists[1].name}: ${s2} goed\n\n`;
    if(s1 > s2) msg += `🎉 ${finalists[0].name} wint het spel!`;
    else if(s2 > s1) msg += `🎉 ${finalists[1].name} wint het spel!`;
    else msg += `Het is gelijkspel — speel eventueel door met extra vragen.`;
    flashMessage(msg);
  } else {
    flashMessage(`Volgende vraag voor ${finalists[sdCurrentPlayer].name}`);
  }
}

function determineFirstPlayer(roundIdx) {
  const alivePlayers = players.filter(p => !p.elim);
  
  // Ronde 1 (index 0)
  if (roundIdx === 0) {
    if (firstRoundStartMode === 'random') {
      const randomIndex = Math.floor(Math.random() * alivePlayers.length);
      return alivePlayers[randomIndex];
    } else {
      // Sorteer alfabetisch op naam en kies de eerste
      return [...alivePlayers].sort((a, b) => a.name.localeCompare(b.name))[0];
    }
  }

  // Latere rondes: De sterkste schakel van de vorige ronde begint
  const { strongest } = calculateStrongestAndWeakest(roundIdx - 1);
  
  // Als de sterkste is weggestemd (niet meer 'alive'), 
  // dan valt de logica van calculateStrongestAndWeakest meestal al terug 
  // op de eerstvolgende beste speler die nog in het spel zit.
  return strongest || alivePlayers[0];
}



function hideRegularUI() {
    document.getElementById('playersInputs').style.display = 'none';
    document.getElementById('roundsList').style.display = 'none';
    document.getElementById('moneyChain').style.display = 'none';
    document.getElementById('currentQuestion').style.display = 'none';
    document.getElementById('voteArea').style.display = 'none';
    startRoundBtn.style.display = 'none';
    nextRoundBtn.style.display = 'none';
    bankBtn.style.display = 'none';
    rightBtn.style.display = 'none';
    wrongBtn.style.display = 'none';
    eliminateBtn.style.display = 'none';
}

function showRegularUI() {
    document.getElementById('playersInputs').style.display = 'block';
    document.getElementById('roundsList').style.display = 'block';
    document.getElementById('moneyChain').style.display = 'block';
    document.getElementById('currentQuestion').style.display = 'block';
    document.getElementById('voteArea').style.display = 'block';
    startRoundBtn.style.display = 'inline-block';
    nextRoundBtn.style.display = 'inline-block';
    bankBtn.style.display = 'inline-block';
    rightBtn.style.display = 'inline-block';
    wrongBtn.style.display = 'inline-block';
    eliminateBtn.style.display = 'inline-block';
    updateButtonVisibility();
}

function updateButtonVisibility() {
    const gameStarted = rounds.length > 0;
    const inVoting = gamePhase === 'voting';
    const inH2H = gamePhase === 'h2h_selection' || gamePhase === 'h2h_active';
    const roundActive = gamePhase === 'round_active';
    const roundReady = gamePhase === 'round_ready';
    
    const showQuizButtons = roundActive;
    rightBtn.style.display = showQuizButtons ? 'inline-block' : 'none';
    wrongBtn.style.display = showQuizButtons ? 'inline-block' : 'none';
    bankBtn.style.display = showQuizButtons ? 'inline-block' : 'none';
    
    const isFinaleRound = rounds[currentRound] && rounds[currentRound].type === 'normal-final';
    const showEliminateBtn = inVoting && !isFinaleRound;
    eliminateBtn.style.display = showEliminateBtn ? 'inline-block' : 'none';
    
    const showStartRound = gameStarted && !inH2H && (gamePhase === 'setup' || gamePhase === 'voting' || gamePhase === 'round_ready');
    startRoundBtn.style.display = showStartRound ? 'inline-block' : 'none';
    
    const showNextRound = gameStarted && gamePhase === 'voting' && !inH2H;
    nextRoundBtn.style.display = showNextRound ? 'inline-block' : 'none';
}

function getNewQuestions(num){
    const remaining = quizQuestions.filter(q => !usedQuestions.includes(q));
    
    if(remaining.length < num){
        flashMessage("Niet genoeg vragen over om een nieuwe ronde te vullen!");
        return remaining;
    }

    const shuffled = shuffleArray([...remaining]);
    const selected = shuffled.slice(0, num);

    usedQuestions.push(...selected);

    return selected;
}


function getNextPlayer(currentPlayer){
    const alive = players.filter(p => !p.elim).sort((a,b)=>a.name.localeCompare(b.name));
    let idx = alive.findIndex(p => p.id === currentPlayer.id);
    idx = (idx + 1) % alive.length;
    return alive[idx];
}

function showQuestion(player){
    if(!currentRoundQuestions || currentRoundQuestions.length === 0) return;
    currentPlayerForQuestion = player;

    const q = currentRoundQuestions[currentQuestionIndex % currentRoundQuestions.length];
    currentQuestionIndex++;

    const displayArea = document.getElementById('currentQuestion');
    displayArea.innerHTML = `<strong>${player.name}</strong>, jouw vraag:<br>${q.question}<br><em>Antwoord(en): ${q.answers.join(' / ')}</em>`;
    
    broadcastToDisplay({
        type: 'question_changed',
        player: player,
        question: q.question
    });
}




nextRoundBtn.addEventListener('click', () => {
  if(!rounds.length) return flashMessage('Maak eerst het spel aan.');

  const aliveCount = players.filter(p => !p.elim).length;
  const r = rounds[currentRound];
  const eliminationDone = r.eliminationDone || false;

  const needsElimination = r.type === 'normal' && !eliminationDone && aliveCount > 2;
  const skipToH2H = (twoPlayerMode === 'skip' && aliveCount === 2);
  
  if(needsElimination && !skipToH2H) {
    return flashMessage('Je moet eerst een speler elimineren voordat je naar de volgende ronde kunt.');
  }

  if(currentRound >= rounds.length - 1) {
    return flashMessage('Je zit al in de laatste ronde.');
  }

  clearInterval(roundTimerInterval);
  roundTimerInterval = null;
  if(bedjeAudio && !bedjeAudio.paused){
    bedjeAudio.pause();
    bedjeAudio.currentTime = 0;
  }

  chainAccum = 0.0;
  chainIndex = 0;
  currentRoundQuestions = [];
  currentQuestionIndex = 0;
  currentPlayerForQuestion = null;

  currentRound++;
  gamePhase = 'round_ready';
  renderPlayersUI();
  updateHeads();

  const upcoming = rounds[currentRound];
  
  broadcastToDisplay({
      type: 'round_ready',
      round: currentRound
  });
  
  if(upcoming.type === 'head-to-head') {
    flashMessage('Head-to-Head staat klaar. Klik op "Start ronde" om te beginnen.');
  } else if(upcoming.type === 'normal-final') {
    flashMessage('Finale ronde staat klaar. Klik op "Start ronde" wanneer je wilt beginnen.');
  } else {
    flashMessage(`Ronde ${upcoming.round} staat klaar. Klik op "Start ronde" om te starten.`);
  }
  
  updateButtonVisibility();
});



function startHeadToHeadSelection() {
    inHeadToHead = true;
    gamePhase = 'h2h_selection';
    const finalists = players.filter(p => !p.elim);
    if(finalists.length !== 2) return flashMessage('Er moeten precies 2 spelers over zijn voor Head-to-Head.');

  const prevRoundIndex = Math.max(0, currentRound - 1);
  const {strongest} = getStrongestAndWeakest(prevRoundIndex);
  const strongestName = strongest ? strongest.name : 'Sterkste schakel';

  broadcastToDisplay({
    type: 'h2h_selection',
    finalists,
    strongestName
  });

    hideRegularUI();

    const container = document.getElementById('headToHeadContainer');
    container.style.display = 'block';

    if(!bedjeAudio) bedjeAudio = new Audio();
    bedjeAudio.src = './soundtrack/Head to Head Start Sting.mp3';
    bedjeAudio.currentTime = 0;
    bedjeAudio.play().catch(()=>{});

    const select = document.getElementById('firstPlayerSelect');
    select.innerHTML = '';
    finalists.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });

    const confirmBtn = document.getElementById('confirmFirstPlayerBtn');
    confirmBtn.onclick = () => {
        const chosenId = parseInt(select.value, 10);
        sdCurrentPlayer = finalists.findIndex(p => p.id === chosenId);

        document.getElementById('firstPlayerSelectArea').style.display = 'none';
        document.getElementById('h2hQuestionArea').style.display = 'block';

        bedjeAudio.pause();
        bedjeAudio.currentTime = 0;
        bedjeAudio.src = './soundtrack/Head to Head.mp3';
        bedjeAudio.loop = true; 
        bedjeAudio.play().catch(()=>{});

            currentRoundQuestions = getNewQuestions(5); 
    currentQuestionIndex = 0;

        sdScores = [0,0];
        sdQuestions = [0,0];
        currentQuestionIndex = 0;
        gamePhase = 'h2h_active';
        updateSuddenDeathUI();

        broadcastToDisplay({
            type: 'headtohead_started',
          finalists: finalists,
          starter: sdCurrentPlayer
        });

        showNextHeadToHeadQuestion();
    };
    
    updateButtonVisibility();
}







rightBtn.addEventListener('click', () => {
  if (inHeadToHead) {
    h2hRight();
    return;
  }

  if (!currentPlayerForQuestion) return;

  if (chainIndex < moneyChain.length) {
    chainAccum = moneyChain[chainIndex]; 
    chainIndex++;
    updateOverlayChain(chainIndex); 
  }

  if (chainIndex >= moneyChain.length) {
    if (autoBankOnMax) {
      bankBtn.click();
      return;
    } else {
      console.log("Maximale ketting bereikt — wachten op bank.");
    }
  }

  updateHeads();
  
  broadcastToDisplay({
      type: 'answer_correct'
  });

  updateStatsAndStrongWeak(currentPlayerForQuestion, "correct");
  const nextPlayer = getNextPlayer(currentPlayerForQuestion);
  showQuestion(nextPlayer);
  
  updateButtonVisibility();
});



wrongBtn.addEventListener('click', ()=>{
  if(inHeadToHead){
    h2hWrong();
    return;
  }

  if(!currentPlayerForQuestion) return;

  chainAccum = 0.0;
  chainIndex = 0;
  updateHeads();
  
  broadcastToDisplay({
      type: 'answer_wrong'
  });

  updateStatsAndStrongWeak(currentPlayerForQuestion, "wrong");
  currentQuestionIndex++;
  const nextPlayer = getNextPlayer(currentPlayerForQuestion);
  showQuestion(nextPlayer);
  
  updateButtonVisibility();
});





bankBtn.addEventListener('click', () => {
    if (!currentPlayerForQuestion) return;

    const maxChainValue = Math.max(...moneyChain);
    const remainingCapacity = Math.max(0, Math.round((maxChainValue - roundBanked) * 100) / 100);

    if (remainingCapacity <= 0) {
        flashMessage('Het maximale bedrag voor deze ronde is al bereikt.');
        return;
    }

    const toBank = Math.min(chainAccum, remainingCapacity);
    if (toBank <= 0) return;


    const previousTotal = bankTotal;
    const prevRoundBanked = roundBanked;
    bankTotal = Math.round((bankTotal + toBank) * 100) / 100;
    roundBanked = Math.round((roundBanked + toBank) * 100) / 100;

    broadcastToDisplay({
        type: 'bank',
        amount: toBank
    });

    if (chainAccum >= maxChainValue && prevRoundBanked < maxChainValue && roundBanked >= maxChainValue) {
      bankTotal = Math.min(bankTotal, maxTotalAmount);
      clearInterval(roundTimerInterval);
      if (bedjeAudio && !bedjeAudio.paused) {
          bedjeAudio.pause();
          bedjeAudio.currentTime = 0;
      }
      effectAudio.src = './soundtrack/bank_complete.mp3';
      effectAudio.currentTime = 0;
      effectAudio.play().catch(() => {});

      flashMessage(`💰 Ronde-max bereikt: (€${previousTotal.toFixed(2)} + €${toBank.toFixed(2)}) tot €${roundBanked.toFixed(2)} — ronde eindigt!`);

      broadcastToDisplay({ type: 'bank_max' });

      chainAccum = 0.0;
      chainIndex = 0;
      overlayBanked();
      updateHeads();
      eliminateBtn.disabled = false;
      return;
    }

    bankTotal = Math.min(bankTotal, maxTotalAmount);
    chainAccum = 0.0;
    chainIndex = 0;
    updateHeads();
    updateStatsAndStrongWeak(currentPlayerForQuestion, "banked");

    showQuestion(currentPlayerForQuestion);

    updateButtonVisibility();
});





eliminateBtn.addEventListener('click', () => {
    const sel = document.querySelector('input[name="vote"]:checked');
    if(!sel) return flashMessage('Selecteer eerst wie je wilt elimineren.');

    const id = parseInt(sel.value,10);
    const p = players.find(x=>x.id===id);
    if(!p) return;
    
    const r = rounds[currentRound];
    if(r && r.type === 'normal-final') {
        return flashMessage('Dit is de finale ronde — geen eliminatie nodig! Ga naar Head-to-Head.');
    }

    p.elim = true;
    eliminated.push(p.name);
    renderPlayersUI();

    rounds[currentRound].eliminationDone = true;
    eliminateBtn.disabled = true;

    playSound('./soundtrack/The Walk Of Shame.mp3');

    const aliveCount = players.filter(p => !p.elim).length;
    if(aliveCount === 2){
        flashMessage('Er zijn nog 2 spelers over — volgende ronde is Head-to-Head!');
    } else {
        flashMessage(`${p.name} is geëlimineerd. Klik op "Volgende ronde" om door te gaan.`);
    }

    const voteCards = document.querySelectorAll('#voteArea .player-card');
    voteCards.forEach(card => {
        const pid = parseInt(card.querySelector('input').value, 10);
        const player = players.find(p=>p.id===pid);
        if(player && player.roundStats && player.roundStats[currentRound]){
            const stats = player.roundStats[currentRound];
            const info = card.querySelector('.muted');
            info.textContent = `Goed: ${stats.correct}, Fout: ${stats.wrong}, Gebankt: ${stats.banked}`;
        }
    });

    updateHeads();
    
    broadcastToDisplay({
        type: 'player_eliminated',
        playerName: p.name
    });

    broadcastToDisplay({
        type: 'voting_ended'
    });
    
    updateButtonVisibility();
});

document.getElementById('IntroBtn').addEventListener('click', () => {
    playSound('./soundtrack/Intro.mp3', {loop:false});
});

document.getElementById('ShortStingBtn').addEventListener('click', () => {
    playSound('./soundtrack/Short Sting.mp3', {loop:false});
});

document.getElementById('GeneralBedBtn').addEventListener('click', () => {
    playSound('./soundtrack/General Bed.mp3', {loop:false});
});

document.getElementById('afterInterviewBtn').addEventListener('click', () => {
    playSound('./soundtrack/After Interview Sting.wav', {loop:false});
});

document.getElementById('generalBumper').addEventListener('click', () => {
    playSound('./soundtrack/Main Sting.mp3', {loop:false});
});

let votingInterval = null;
let votingTimeLeft = 25;

function updatePlayerCard(player){
    const card = document.querySelector(`#voteArea .player-card input[value="${player.id}"]`).parentElement;
    const stats = player.roundStats[currentRound] || {correct:0, wrong:0, banked:0};
    card.querySelector('.muted').textContent = `Goed: ${stats.correct}, Fout: ${stats.wrong}, Gebankt: ${stats.banked}`;
}

document.getElementById('startVotingBtn').addEventListener('click', () => {
    candidateVotes = {};

    playSound('./soundtrack/Voting Music.mp3', {loop:false});

    votingTimeLeft = 25;
    updateVotingTimerDisplay();

    clearInterval(votingInterval);
    votingInterval = setInterval(() => {
        votingTimeLeft--;
        updateVotingTimerDisplay();
        
        broadcastToDisplay({
            type: 'voting_timer',
            time: votingTimeLeft
        });
        
        if(votingTimeLeft <= 0){
            clearInterval(votingInterval);
            flashMessage('Stemmen afgelopen!');

            broadcastToDisplay({
                type: 'voting_ended'
            });
        }
    }, 1000);
    
    const alive = players.filter(p => !p.elim);
    const stats = alive.map(p => {
        const roundStats = p.roundStats[currentRound] || {correct:0, wrong:0, banked:0};
        return {
            id: p.id,
            name: p.name,
            correct: roundStats.correct,
            wrong: roundStats.wrong,
            banked: roundStats.banked
        };
    });
    
    const result = getStrongestAndWeakest(currentRound);
    
    broadcastToDisplay({
        type: 'voting_started',
        time: votingTimeLeft,
        players: alive, 
        stats: {
            players: stats,
            strongest: result.strongest,
            weakest: result.weakest
        }
    });
    
    gamePhase = 'voting';
    updateButtonVisibility();
});

function updateVotingTimerDisplay() {
    const m = Math.floor(votingTimeLeft / 60);
    const s = votingTimeLeft % 60;
    document.getElementById('votingTimer').textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}


document.addEventListener('keydown', (e)=>{
  if(e.key==='b') bankBtn.click();
  if(e.key==='g') rightBtn.click();
  if(e.key==='f') wrongBtn.click();
});

const bc = new BroadcastChannel('moneyChainChannel');

function sendChainToOverlay(){
    if(!moneyChain) return;
    bc.postMessage({type:'initChain', chain: moneyChain});
}

function updateOverlayChain(index){
    bc.postMessage({type:'updateChain', index});
}

function overlayBanked(){
    bc.postMessage({type:'banked'});
}

window._zwak = {players, rounds, moneyChain, buildRounds, buildMoneyChain};

function startRoundTimer(durationSecs) {
  clearInterval(roundTimerInterval); 
  roundTimeLeft = durationSecs;
  updateTimerDisplay();

  roundTimerInterval = setInterval(() => {
    roundTimeLeft--;
    updateTimerDisplay();
    
    broadcastToDisplay({
        type: 'round_timer',
        time: roundTimeLeft
    });

    if (roundTimeLeft <= 0) {
      clearInterval(roundTimerInterval);
      flashMessage('Tijd is voorbij voor deze ronde!');
      chainAccum = 0;
      chainIndex = 0;
      updateHeads();

      eliminateBtn.disabled = false;

      renderStrongestWeakest(currentRound);
      
      updateButtonVisibility();
    }

    if (chainIndex >= moneyChain.length) {
      console.log('Maximale ketting bereikt — wacht op bankactie om ronde te beëindigen.');
    }
  }, 1000);
}




function updateTimerDisplay() {
  const m = Math.floor(roundTimeLeft / 60);
  const s = roundTimeLeft % 60;
  document.getElementById('roundTimer').textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
