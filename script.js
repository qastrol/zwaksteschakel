/* ---------- Beschikbare bedjetijden (uit jouw lijst) ---------- */
const bedjeFiles = [
  '0：45.mp3','1：00.mp3','1：10.mp3','1：15.mp3','1：20.mp3','1：30.mp3','1：40.mp3','1：45.mp3','1：50.mp3','2：00.mp3','2：10.mp3','2：15.mp3','2：20.mp3','2：30.mp3','2：40.mp3','2：45.mp3','2：50.mp3','3：00.mp3'
];
// We trekken alleen de tijdslabels als minuten:seconds numeriek voor berekeningen
function parseLabelToSeconds(label){
  // label is like '1：30.mp3' (note: using U+FF1A fullwidth colon). we'll strip .mp3 and replace non-digit with ':'
  const base = label.replace('.mp3','').replace('：',':');
  const parts = base.split(':');
  const m = parseInt(parts[0],10);
  const s = parseInt(parts[1]||0,10);
  return m*60 + s;
}
const bedjeTimes = bedjeFiles.map(f=>({file:f,secs:parseLabelToSeconds(f)})).sort((a,b)=>a.secs-b.secs);

/* ---------- UI helpers ---------- */
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
let bedjeAudio; // één gedeelde audioplayer
// na renderRoundsList(); renderChain(); renderPlayersUI(); updateHeads();
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

let players = [];
let rounds = []; // array of {index, timeSecs, label, bedjeFile}
let moneyChain = []; // array of numeric euro values
let currentRound = 0; // 0-based
let chainAccum = 0.0; // current chain value
let bankTotal = 0.0;
let eliminated = [];
let roundTimerInterval = null;
let roundTimeLeft = 0; // in seconden
let usedQuestions = [];
let maxTotalAmount = 15.00; // standaard maximaal totaalbedrag
let chainIndex = 0; // huidige positie in de geldketting
let currentRoundQuestions = []; // vragen voor de huidige ronde
let playerAvatars = {}; // opslag voor player avatars (Base64 data URLs)
let bankTotalAtRoundStart = 0; // referentiepunt voor ronde
let roundBanked = 0; // hoeveel in deze ronde is gebankt
let gamePhase = 'setup'; // setup, round_active, voting, h2h_selection, h2h_active
let twoPlayerMode = 'play'; // 'skip' = direct naar H2H, 'play' = speel reguliere ronde
let autoBankOnMax = false; // false = require manual bank to end round; true = auto-bank when round max reached
let candidateVotes = {}; // Track votes from candidate mobile devices

/* ---------- WebSocket voor display synchronisatie ---------- */
let ws = null;
let wsConnected = false;

function connectWebSocket() {
  // Try to connect to WebSocket server
  try {
    ws = new WebSocket('ws://' + window.location.host);
    
    ws.onopen = () => {
      console.log('WebSocket verbonden met server');
      wsConnected = true;
      
      // Register as host
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
      
      // Try to reconnect after 3 seconds
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
        
        // Handle messages from server if needed
        if (data.type === 'state_sync') {
          console.log('State sync ontvangen van server');
        } else if (data.type === 'candidate_vote') {
          // Handle candidate vote from mobile device
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
  // Try WebSocket first
  if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
      return;
    } catch (e) {
      console.warn('WebSocket verzenden mislukt:', e);
      wsConnected = false;
    }
  }
  
  // Fallback to BroadcastChannel for local testing
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
    // Only allow voting during voting phase
    if (gamePhase !== 'voting') {
        console.warn('Candidate vote received outside voting phase');
        return;
    }

    // Validate voter and voted-for players exist and are alive
    const voter = players.find(p => p.id == voterId);
    const votedFor = players.find(p => p.id == votedForId);

    if (!voter || !votedFor || voter.elim || votedFor.elim) {
        console.warn('Invalid candidate vote:', voterId, votedForId);
        return;
    }

    // Can't vote for yourself
    if (voterId == votedForId) {
        console.warn('Player cannot vote for themselves');
        return;
    }

    // Record the vote
    candidateVotes[voterId] = votedForId;
    console.log(`Candidate vote recorded: ${voter.name} voted for ${votedFor.name}`);

    // Update the UI to show the vote (select the radio button)
    const radioBtn = document.querySelector(`input[name="vote"][value="${votedForId}"]`);
    if (radioBtn) {
        radioBtn.checked = true;
        flashMessage(`Stem ontvangen van ${voter.name} voor ${votedFor.name}`);
    }

    // Check if all candidates have voted
    const alivePlayers = players.filter(p => !p.elim);
    const votesReceived = Object.keys(candidateVotes).length;
    if (votesReceived === alivePlayers.length) {
        flashMessage('Alle kandidaten hebben gestemd!');
    }
}

// Connect on load
if (typeof WebSocket !== 'undefined') {
  connectWebSocket();
}


/* populate bedje select */
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
  // Altijd afronden op twee cijfers
  maxTotalAmount = Math.round(val * 100) / 100;

  document.getElementById('maxTotalDisplay').textContent = 
    `Huidig maximum: €${maxTotalAmount.toFixed(2)}`;

  flashMessage(`Maximaal totaalbedrag ingesteld op €${maxTotalAmount.toFixed(2)}.`);
});


/* ---------- spelers inputs dynamisch ---------- */
function renderPlayerInputs(){
  playersInputs.innerHTML = '';
  const n = Math.max(2,Math.min(10,parseInt(numInput.value)||2));
  for(let i=0;i<n;i++){
    const inp = document.createElement('input');
    inp.type='text'; inp.placeholder = `Kandidaat ${i+1}`; inp.id = `p${i}`;
    playersInputs.appendChild(inp);
  }
  
  // Toon foto upload interface
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
    
    // Gebruik opgeslagen avatar of standaard
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
    
    // Event listener voor foto upload via knop
    const uploadBtn = photoCard.querySelector(`#upload-btn-${i}`);
    uploadBtn.addEventListener('click', () => {
      document.getElementById(`photo-input-${i}`).click();
    });
    
    // Event listener voor foto upload via afbeelding klikken
    const avatarImg = photoCard.querySelector(`#avatar-${i}`);
    avatarImg.addEventListener('click', () => {
      document.getElementById(`photo-input-${i}`).click();
    });
    
    // Event listener voor file input change
    const input = photoCard.querySelector(`#photo-input-${i}`);
    input.addEventListener('change', (e) => handlePhotoUpload(e, i));
    
    // Event listener voor verwijderen
    if (hasCustomAvatar) {
      const removeBtn = photoCard.querySelector(`#remove-btn-${i}`);
      removeBtn.addEventListener('click', () => removePhotoUpload(i));
    }
  }
}

function handlePhotoUpload(event, playerIndex){
  const file = event.target.files[0];
  if(!file) return;
  
  // Check bestandsgrootte (max 2MB)
  if(file.size > 2 * 1024 * 1024){
    flashMessage(`Foto voor kandidaat ${playerIndex+1} is te groot (max 2MB)`);
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    playerAvatars[playerIndex] = dataUrl;
    
    // Update preview
    document.getElementById(`avatar-${playerIndex}`).src = dataUrl;
    
    // Re-render foto upload sectie om verwijder knop toe te voegen
    renderPhotoUpload(Math.max(2, Math.min(10, parseInt(numInput.value) || 2)));
    
    flashMessage(`Foto voor kandidaat ${playerIndex+1} geüpload`);
  };
  
  reader.readAsDataURL(file);
}

function removePhotoUpload(playerIndex){
  delete playerAvatars[playerIndex];
  
  // Re-render foto upload sectie
  renderPhotoUpload(Math.max(2, Math.min(10, parseInt(numInput.value) || 2)));
  
  flashMessage(`Foto voor kandidaat ${playerIndex+1} verwijderd`);
}

numInput.addEventListener('change', renderPlayerInputs);
renderPlayerInputs();

/* ---------- algoritme: rondetijden bepalen ---------- */
function chooseStartTimeByPlayers(n){
  // heuristiek: meer spelers -> langere starttijden
  if(n>=8) return 180; // 3:00
  if(n>=6) return 150; // 2:30
  if(n==5) return 140; // 2:20
  if(n==4) return 120; // 2:00
  if(n==3) return 110; // 1:50
  return 90; // 1:30 for 2 spelers
}

function chooseMinTimeByPlayers(n){
  // laagste tijd in de reeks — chosen from available bedjes
  if(n>=8) return 60; // 1:00
  if(n>=5) return 45; // 0:45
  if(n>=3) return 45;
  return 45;
}

function secondsToLabel(s){
  const m = Math.floor(s/60); const sec = s%60; return `${m}:${String(sec).padStart(2,'0')}`;
}

function findClosestBedje(secs){
  // return bedjeTimes element with secs <= desired otherwise the smallest greater
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

  // Normaal aantal eliminatierondes: tot er 3 spelers zijn
  const roundsNeeded = Math.max(1, n - 2);

  let baseTime = 150 + Math.max(0, n - 8) * 10; // 9→160s, 10→170s
  if (n < 8) baseTime = 150 - (8 - n) * 10; // 7→140s, 6→130s, etc.
  baseTime = Math.max(90, Math.min(baseTime, 180)); // begrens tussen 1:30 en 3:00

  // Bouw de eliminatierondes af met 10 seconden minder per ronde
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

  // 🆕 Extra gewone ronde met 2 spelers (alleen als twoPlayerMode === 'play')
  if (twoPlayerMode === 'play') {
    const lastNormalSecs = Math.max(60, baseTime - roundsNeeded * 10);
    const extra = findClosestBedje(lastNormalSecs);
    seq.push({
      round: roundsNeeded + 1,
      secs: extra.secs,
      label: secondsToLabel(extra.secs) + ' — finale ronde',
      file: extra.file,
      type: 'normal-final' // nieuw type
    });
  }

  // Voeg daarna de Head-to-Head toe
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


function buildMoneyChain(totalPlayers) {
  // ✅ Bepaal aantal rondes afhankelijk van twoPlayerMode
  let roundsCount;
  if (twoPlayerMode === 'skip') {
    // Geen reguliere ronde met 2 spelers, dus n-2 rondes (tot 3 spelers over)
    roundsCount = Math.max(1, totalPlayers - 2);
  } else {
    // Wel reguliere ronde met 2 spelers, dus n-1 rondes (tot 2 spelers over)
    roundsCount = Math.max(1, totalPlayers - 1);
  }
  
  const maxTotal = maxTotalAmount; // totaal te winnen geld in het hele spel
  const steps = totalPlayers;      // aantal stappen per ronde

  // 📈 Oorspronkelijke schaalvorm (ongeveer) — sterk stijgend aan het einde
  // Deze waarden worden als "vorm" gebruikt, niet als absolute bedragen.
  const referenceScale = [20, 50, 100, 200, 300, 450, 600, 800, 1000];
  
  // Als minder spelers, verkorten we dynamisch de schaal:
  const baseShape = referenceScale.slice(0, steps);

  // Normaliseer de som van de basisvorm
  const shapeSum = baseShape.reduce((a, b) => a + b, 0);
  const scaleFactor = (maxTotal / roundsCount) / shapeSum;

  // Pas schaal toe zodat het binnen het totaalbedrag per ronde past
  let scaledSteps = baseShape.map(v => v * scaleFactor);

  // ✅ Cumulatieve bedragen berekenen (zoals de originele ketting)
  const cumulative = [];
  let sum = 0;
  for (let i = 0; i < scaledSteps.length; i++) {
    sum += scaledSteps[i];

    // 🎯 Slim afronden:
    // kleine bedragen → op 0,05
    // middelgrote → op 0,10
    // grote → op hele euro’s
    let rounded = sum;
    if (sum < 1) {
      rounded = Math.round(sum * 100) / 100; // afronden op 0,01
      rounded = Math.max(rounded, 0.01); // minimaal €0,01
    } else if (sum < 10) {
      rounded = Math.round(sum * 10) / 10; // afronden op 0,10
    } else {
      rounded = Math.round(sum); // afronden op hele euro's
    }

    // Zorg dat afronding het eindbedrag niet overschrijdt
    if (i === scaledSteps.length - 1) {
      rounded = sum; // laatste stap blijft exact de maximumwaarde van deze ronde
    }

    cumulative.push(rounded);
  }

  return cumulative;
}


/* ---------- render helpers ---------- */
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

    // ✅ toon stats voor de huidige ronde (of 0 als niet gezet)
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

function flashMessage(msg, duration = 5000) { // standaard nu 5 seconden
  const container = document.getElementById('flashContainer');
  if(!container) return;

  const div = document.createElement('div');
  div.className = 'flash-message';
  div.textContent = msg;

  container.appendChild(div);

  // start fade-out vlak voordat de timeout afgelopen is
  setTimeout(() => {
    div.style.transition = 'opacity 0.5s ease-in-out';
    div.style.opacity = 0;
    setTimeout(() => container.removeChild(div), 500); // verwijder na fade
  }, duration - 500); // 0.5s fade-out
}


function getStrongestAndWeakest(roundIndex) {
    const alive = players.filter(p => !p.elim);
    if(alive.length === 0) return {strongest: null, weakest: null};

    const roundStats = p => p.roundStats[roundIndex] || {correct:0, wrong:0, banked:0};

    // --- Sterkste schakel ---
    let maxCorrect = Math.max(...alive.map(p => roundStats(p).correct));
    let strongest = alive.filter(p => roundStats(p).correct === maxCorrect);
    if(strongest.length > 1){
        // tie-break: minste fouten
        let minWrong = Math.min(...strongest.map(p => roundStats(p).wrong));
        strongest = strongest.filter(p => roundStats(p).wrong === minWrong);
    }
    if(strongest.length > 1){
        // tie-break: minste gebankt
        let minBanked = Math.min(...strongest.map(p => roundStats(p).banked));
        strongest = strongest.filter(p => roundStats(p).banked === minBanked);
    }
    if(strongest.length > 1){
        // tie-break: alfabet
        strongest.sort((a,b)=>a.name.localeCompare(b.name));
    }
    const strongestPlayer = strongest[0];

    // --- Zwakste schakel ---
    let minCorrect = Math.min(...alive.map(p => roundStats(p).correct));
    let weakest = alive.filter(p => roundStats(p).correct === minCorrect);
    if(weakest.length > 1){
        // tie-break: meeste fouten
        let maxWrong = Math.max(...weakest.map(p => roundStats(p).wrong));
        weakest = weakest.filter(p => roundStats(p).wrong === maxWrong);
    }
    if(weakest.length > 1){
        // tie-break: meeste gebankt
        let maxBanked = Math.max(...weakest.map(p => roundStats(p).banked));
        weakest = weakest.filter(p => roundStats(p).banked === maxBanked);
    }
    if(weakest.length > 1){
        // tie-break: alfabet
        weakest.sort((a,b)=>a.name.localeCompare(b.name));
    }
    const weakestPlayer = weakest[0];

    return {strongest: strongestPlayer, weakest: weakestPlayer};
}

/* --------------------  NIEUW: real-time sterkste/zwakste -------------------- */

/**
 * Bereken de sterkste en zwakste schakel voor de huidige ronde
 */
function calculateStrongestAndWeakest(roundIndex) {
  const alive = players.filter(p => !p.elim);
  if (alive.length === 0) return { strongest: null, weakest: null };

  function stats(p) {
    return p.roundStats[roundIndex] || { correct: 0, wrong: 0, banked: 0 };
  }

  // --- Sterkste schakel ---
  const strongest = [...alive].sort((a, b) => {
    const sa = stats(a);
    const sb = stats(b);
    if (sb.correct !== sa.correct) return sb.correct - sa.correct; // meest goed
    if (sa.wrong !== sb.wrong) return sa.wrong - sb.wrong;         // minst fout
    if (sa.banked !== sb.banked) return sa.banked - sb.banked;     // minst bank
    return a.name.localeCompare(b.name);                           // alfabetisch
  })[0];

  // --- Zwakste schakel ---
  const weakest = [...alive].sort((a, b) => {
    const sa = stats(a);
    const sb = stats(b);
    if (sa.correct !== sb.correct) return sa.correct - sb.correct; // minst goed
    if (sb.wrong !== sa.wrong) return sb.wrong - sa.wrong;         // meest fout
    if (sb.banked !== sa.banked) return sb.banked - sa.banked;     // meest bank
    return a.name.localeCompare(b.name);                           // alfabetisch
  })[0];

  return { strongest, weakest };
}

/**
 * Toon de huidige sterkste en zwakste schakel in de UI
 */
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

/**
 * Update de statistieken van een speler en herbereken direct sterkste/zwakste.
 */
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



/* ---------- core actions ---------- */
applyBtn.addEventListener('click', ()=>{
    const n = Math.max(2, Math.min(10, parseInt(numInput.value) || 2));
    
    // Lees de twoPlayerMode dropdown
    const twoPlayerModeSelect = document.getElementById('twoPlayerMode');
    twoPlayerMode = twoPlayerModeSelect ? twoPlayerModeSelect.value : 'play';

    // Lees de auto-bank modus (manual | auto)
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
          roundStats:{}, // voor statistieken per ronde
          avatar: playerAvatars[i] || './assets/avatar.png' // profielfoto
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

    // ✅ shuffle de vragen hier
    if(quizQuestions && quizQuestions.length > 1){
        shuffleArray(quizQuestions);
    }

    renderRoundsList(); 
    renderChain(); 
    renderPlayersUI(); 
    updateHeads();
    updateButtonVisibility();
    
    // Broadcast naar display
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

    // 🆕 Update overlay
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
    
    // Broadcast naar display
    broadcastToDisplay({
        type: 'round_started',
        round: currentRound,
        time: r.secs
    });
    
    updateButtonVisibility();
});


function startNormalRound(r){
    // kies een aantal vragen voor deze ronde (bijvoorbeeld aantal actieve spelers of 5)
    const numQuestions = 50;
    const questionsForRound = getNewQuestions(numQuestions);

    // sla lokaal op zodat showQuestion ze kan gebruiken
    currentRoundQuestions = questionsForRound;
    currentQuestionIndex = 0;

    const find = findClosestBedje(r.secs);
    if(!bedjeAudio) bedjeAudio = new Audio();
    bedjeAudio.src = './bedjes/' + find.file;
    bedjeAudio.currentTime = 0;
    bedjeAudio.play().catch(()=>{});

    moneyChain = buildMoneyChain(players.length);
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








// Verwijderd: dubbele definitie van showNextHeadToHeadQuestion met onjuiste Sudden Death start



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
    
    // Broadcast naar display
    broadcastToDisplay({
        type: 'h2h_question',
        question: q.question,
        activePlayer: sdCurrentPlayer
    });
}

// Behandeling bij juist antwoord
function h2hRight() {
    const finalists = players.filter(p => !p.elim);

    if(inSuddenDeath){
        sdScores[sdCurrentPlayer]++; // optioneel bijhouden
        sdQuestions[sdCurrentPlayer]++;

        // In Sudden Death: juiste antwoord → beurt naar andere speler
        sdCurrentPlayer = sdCurrentPlayer === 0 ? 1 : 0;
        
        // Broadcast scores naar display
        broadcastToDisplay({
            type: 'h2h_score',
            scores: sdScores
        });
        
        showNextHeadToHeadQuestion();
        return;
    }

    // Normale head-to-head (eerste 5 vragen)
    sdScores[sdCurrentPlayer]++;
    sdQuestions[sdCurrentPlayer]++;
    
    // Broadcast scores naar display
    broadcastToDisplay({
        type: 'h2h_score',
        scores: sdScores
    });
    
    checkHeadToHeadProgress();
}

// Behandeling bij fout antwoord
function h2hWrong() {
    const finalists = players.filter(p => !p.elim);

    if(!inSuddenDeath && sdQuestions[0] >=5 && sdQuestions[1] >=5){
        // dit zou normaal niet voorkomen
        return;
    }

    if(!inSuddenDeath && sdQuestions[0] >=0 && sdQuestions[1] >=0){
        // Na reguliere H2H vragen
        sdQuestions[sdCurrentPlayer]++;
        
        // Broadcast scores naar display
        broadcastToDisplay({
            type: 'h2h_score',
            scores: sdScores
        });
        
        checkHeadToHeadProgress();
        return;
    }

    // Sudden Death: fout = verlies
    if(inSuddenDeath){
        const loser = finalists[sdCurrentPlayer];
        const winner = finalists[sdCurrentPlayer === 0 ? 1 : 0];
        declareWinner(winner);
        return;
    }

    // Normale beurt: vraag fout
    sdQuestions[sdCurrentPlayer]++;
    
    // Broadcast scores naar display
    broadcastToDisplay({
        type: 'h2h_score',
        scores: sdScores
    });
    
    sdCurrentPlayer = sdCurrentPlayer === 0 ? 1 : 0;
    showNextHeadToHeadQuestion();
}

// Start Sudden Death
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


// Controleer voortgang en bepaal winnaar / Sudden Death
function checkHeadToHeadProgress() {
    const finalists = players.filter(p => !p.elim);

    if(!inSuddenDeath){
        // 5 vragen per speler voltooid?
        if(sdQuestions[0] >=5 && sdQuestions[1] >=5){
            if(sdScores[0] > sdScores[1]){
                declareWinner(finalists[0]);
                return;
            } else if(sdScores[1] > sdScores[0]){
                declareWinner(finalists[1]);
                return;
            } else {
                // start Sudden Death
                inSuddenDeath = true;
                sdQuestions = [0,0]; // reset vragen tellen
                flashMessage('Gelijkspel! Sudden Death start!');
            }
        }
    } else {
        // Sudden Death logica
        if(sdQuestions[0] > 0 && sdQuestions[1] > 0){
            const last0 = sdScores[0];
            const last1 = sdScores[1];
            // verschil tussen laatste beurt checken
            if(Math.abs(last0 - last1) === 1){
                const winner = last0 > last1 ? finalists[0] : finalists[1];
                declareWinner(winner);
                return;
            }
        }
    }

    // switch beurt
    sdCurrentPlayer = sdCurrentPlayer === 0 ? 1 : 0;
    showNextHeadToHeadQuestion();
}

function declareWinner(player){
    flashMessage(`🎉 ${player.name} wint het spel en neemt het geld!`);
    inHeadToHead = false;
    inSuddenDeath = false;
    gamePhase = 'setup';

    // stop eventuele andere muziek
    if(bedjeAudio && !bedjeAudio.paused){
        bedjeAudio.pause();
        bedjeAudio.currentTime = 0;
    }

  // Verberg H2H UI expliciet
  const h2hContainer = document.getElementById('headToHeadContainer');
  if (h2hContainer) h2hContainer.style.display = 'none';

  // Speel winnaarsmuziek (probeer een reeks bekende bestandsnamen, val terug op start sting)
  playWinnerMusic();
    
    // Broadcast winnaar naar display
    broadcastToDisplay({
        type: 'game_winner',
        winner: player,
        prize: bankTotal
    });

    // toon normale UI weer
    showRegularUI();
}

function playWinnerMusic() {
  // Speel expliciet de winnaarsmuziek
  const player = effectAudio || new Audio();
  player.pause();
  player.currentTime = 0;
  player.src = "./soundtrack/Winner's Theme.mp3";
  player.play().catch(() => {
    // Fallbacks indien bestand ontbreekt
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
    // speler is klaar, switch naar andere
    sdCurrentPlayer = (sdCurrentPlayer === 0 ? 1 : 0);
  }

  if(sdQuestions[0] >= 5 && sdQuestions[1] >= 5){
    // einde
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

function determineFirstPlayer(roundIndex){
    const alive = players.filter(p => !p.elim);

    if(roundIndex === 0){
        alive.sort((a,b)=>a.name.localeCompare(b.name));
        return alive[0];
    }

    // Sterkste schakel vorige ronde
    const {strongest} = getStrongestAndWeakest(roundIndex - 1);
    return strongest || alive[0];
}



function hideRegularUI() {
    // Verberg alles wat alleen relevant is voor normale rondes
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

// Beheer zichtbaarheid knoppen op basis van game-state
function updateButtonVisibility() {
    const gameStarted = rounds.length > 0;
    const inVoting = gamePhase === 'voting';
    const inH2H = gamePhase === 'h2h_selection' || gamePhase === 'h2h_active';
    const roundActive = gamePhase === 'round_active';
    const roundReady = gamePhase === 'round_ready';
    
    // Toon quiz-knoppen (Goed/Fout/Bank) ALLEEN tijdens actieve ronde
    const showQuizButtons = roundActive;
    rightBtn.style.display = showQuizButtons ? 'inline-block' : 'none';
    wrongBtn.style.display = showQuizButtons ? 'inline-block' : 'none';
    bankBtn.style.display = showQuizButtons ? 'inline-block' : 'none';
    
    // Toon elimineer-knop ALLEEN in voting fase EN NIET in de finale ronde
    const isFinaleRound = rounds[currentRound] && rounds[currentRound].type === 'normal-final';
    const showEliminateBtn = inVoting && !isFinaleRound;
    eliminateBtn.style.display = showEliminateBtn ? 'inline-block' : 'none';
    
    // Toon Start Ronde: spel moet zijn gestart EN we mogen NIET in H2H zijn EN (setup of na eliminatie of rond klaar)
    const showStartRound = gameStarted && !inH2H && (gamePhase === 'setup' || gamePhase === 'voting' || gamePhase === 'round_ready');
    startRoundBtn.style.display = showStartRound ? 'inline-block' : 'none';
    
    // Toon Volgende Ronde: ALLEEN na voting fase
    const showNextRound = gameStarted && gamePhase === 'voting' && !inH2H;
    nextRoundBtn.style.display = showNextRound ? 'inline-block' : 'none';
}

function getNewQuestions(num){
    // filter de vragen die nog niet gebruikt zijn
    const remaining = quizQuestions.filter(q => !usedQuestions.includes(q));
    
    if(remaining.length < num){
        flashMessage("Niet genoeg vragen over om een nieuwe ronde te vullen!");
        return remaining;
    }

    // shuffle de overgebleven vragen
    const shuffled = shuffleArray([...remaining]);
    const selected = shuffled.slice(0, num);

    // markeer ze als gebruikt
    usedQuestions.push(...selected);

    return selected;
}


// Bepaal volgende speler (alfabetisch, actieve spelers)
function getNextPlayer(currentPlayer){
    const alive = players.filter(p => !p.elim).sort((a,b)=>a.name.localeCompare(b.name));
    let idx = alive.findIndex(p => p.id === currentPlayer.id);
    idx = (idx + 1) % alive.length;
    return alive[idx];
}

// Toon een vraag in de HTML inclusief de spelernaam
function showQuestion(player){
    if(!currentRoundQuestions || currentRoundQuestions.length === 0) return;
    currentPlayerForQuestion = player;

    const q = currentRoundQuestions[currentQuestionIndex % currentRoundQuestions.length];
    currentQuestionIndex++;

    const displayArea = document.getElementById('currentQuestion');
    displayArea.innerHTML = `<strong>${player.name}</strong>, jouw vraag:<br>${q.question}<br><em>Antwoord(en): ${q.answers.join(' / ')}</em>`;
    
    // Broadcast naar display
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

  // Bij een gewone ronde moet eerst geëlimineerd worden (zolang er >2 spelers zijn)
  // Tenzij we in skip-mode zitten en er zijn precies 2 spelers over
  const needsElimination = r.type === 'normal' && !eliminationDone && aliveCount > 2;
  const skipToH2H = (twoPlayerMode === 'skip' && aliveCount === 2);
  
  if(needsElimination && !skipToH2H) {
    return flashMessage('Je moet eerst een speler elimineren voordat je naar de volgende ronde kunt.');
  }

  // Laatste ronde bereikt?
  if(currentRound >= rounds.length - 1) {
    return flashMessage('Je zit al in de laatste ronde.');
  }

  // Stop eventuele lopende timer/bedje van de vorige ronde
  clearInterval(roundTimerInterval);
  roundTimerInterval = null;
  if(bedjeAudio && !bedjeAudio.paused){
    bedjeAudio.pause();
    bedjeAudio.currentTime = 0;
  }

  // Reset tijdelijke ronde-data
  chainAccum = 0.0;
  chainIndex = 0;
  currentRoundQuestions = [];
  currentQuestionIndex = 0;
  currentPlayerForQuestion = null;

  // Zet alleen de volgende ronde klaar; start pas bij "Start ronde"
  currentRound++;
  gamePhase = 'round_ready';
  renderPlayersUI();
  updateHeads();

  const upcoming = rounds[currentRound];
  
  // Broadcast naar display dat ronde klaar is
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

  // Meld aan display dat de keuze voor de startspeler bezig is
  broadcastToDisplay({
    type: 'h2h_selection',
    finalists,
    strongestName
  });

    // Verberg normale UI
    hideRegularUI();

    // Toon Head-to-Head container
    const container = document.getElementById('headToHeadContainer');
    container.style.display = 'block';

    // Speel Start Sting
    if(!bedjeAudio) bedjeAudio = new Audio();
    bedjeAudio.src = './soundtrack/Head to Head Start Sting.mp3';
    bedjeAudio.currentTime = 0;
    bedjeAudio.play().catch(()=>{});

    // Vul select
    const select = document.getElementById('firstPlayerSelect');
    select.innerHTML = '';
    finalists.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });

    // Bevestig knop
    const confirmBtn = document.getElementById('confirmFirstPlayerBtn');
    confirmBtn.onclick = () => {
        const chosenId = parseInt(select.value, 10);
        sdCurrentPlayer = finalists.findIndex(p => p.id === chosenId);

        // Verberg selectie, toon vraaggebied
        document.getElementById('firstPlayerSelectArea').style.display = 'none';
        document.getElementById('h2hQuestionArea').style.display = 'block';

        // Stop Start Sting en start ronde muziek
        bedjeAudio.pause();
        bedjeAudio.currentTime = 0;
        bedjeAudio.src = './soundtrack/Head to Head.mp3';
        bedjeAudio.loop = true; // blijft herhalen
        bedjeAudio.play().catch(()=>{});

            currentRoundQuestions = getNewQuestions(5); // 5 H2H vragen
    currentQuestionIndex = 0;

        // reset scores
        sdScores = [0,0];
        sdQuestions = [0,0];
        currentQuestionIndex = 0;
        gamePhase = 'h2h_active';
        updateSuddenDeathUI();

        // Broadcast naar display
        broadcastToDisplay({
            type: 'headtohead_started',
          finalists: finalists,
          starter: sdCurrentPlayer
        });

        // start ronde
        showNextHeadToHeadQuestion();
    };
    
    updateButtonVisibility();
}







rightBtn.addEventListener('click', () => {
  if (inHeadToHead) {
    // Gebruik de centrale H2H logica zodat winst/tie-break correct wordt afgehandeld
    h2hRight();
    return;
  }

  if (!currentPlayerForQuestion) return;

  if (chainIndex < moneyChain.length) {
    chainAccum = moneyChain[chainIndex]; // cumulatieve waarde
    chainIndex++;
    updateOverlayChain(chainIndex); // update overlay
  }

  if (chainIndex >= moneyChain.length) {
    if (autoBankOnMax) {
      // automatisch bank uitvoeren en ronde laten eindigen (bankBtn handler regelt ronde-einde)
      bankBtn.click();
      return;
    } else {
      console.log("Maximale ketting bereikt — wachten op bank.");
    }
  }

  updateHeads();
  
  // Broadcast naar display
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
    // Gebruik de centrale H2H logica zodat winst/tie-break correct wordt afgehandeld
    h2hWrong();
    return;
  }

  if(!currentPlayerForQuestion) return;

  chainAccum = 0.0;
  chainIndex = 0;
  updateHeads();
  
  // Broadcast naar display
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

    // Bereken het maximaal te bankenn bedrag deze ronde
    const maxChainValue = Math.max(...moneyChain);
    const remainingCapacity = Math.max(0, Math.round((maxChainValue - roundBanked) * 100) / 100);

    if (remainingCapacity <= 0) {
        // Al op max voor deze ronde
        flashMessage('Het maximale bedrag voor deze ronde is al bereikt.');
        return;
    }

    // Bepaal hoeveel we daadwerkelijk kunnen bankenn (cap op per-ronde maximum)
    const toBank = Math.min(chainAccum, remainingCapacity);
    if (toBank <= 0) return;


    const previousTotal = bankTotal;
    // bewaar vorige waarde voor controle of we juist de ketting-top hebben bereikt
    const prevRoundBanked = roundBanked;
    bankTotal = Math.round((bankTotal + toBank) * 100) / 100;
    roundBanked = Math.round((roundBanked + toBank) * 100) / 100;

    // Broadcast naar display met exact bedrag
    broadcastToDisplay({
        type: 'bank',
        amount: toBank
    });

    // Controle of deze ronde het maximum van de ketting heeft bereikt
    // Alleen einde ronde wanneer de speler die nu bankt daadwerkelijk de ketting-top had gehaald
    // (dus zijn huidige `chainAccum` bevat de topstap). Zo voorkomen we dat meerdere kleine
    // bankacties samen de ronde laten eindigen wanneer geen enkele speler de top zelf heeft bereikt.
    if (chainAccum >= maxChainValue && prevRoundBanked < maxChainValue && roundBanked >= maxChainValue) {
      // Clamp totale pot op het spelmaximum
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

      // Broadcast naar display dat ronde-max is bereikt
      broadcastToDisplay({ type: 'bank_max' });

      chainAccum = 0.0;
      chainIndex = 0;
      overlayBanked();
      updateHeads();
      eliminateBtn.disabled = false;
      return;
    }

    // Normale logica als het maximum niet is overschreden
    bankTotal = Math.min(bankTotal, maxTotalAmount);
    // Als we slechts deels konden bankenn, we resetten chainAccum volledig
    chainAccum = 0.0;
    chainIndex = 0;
    updateHeads();
    updateStatsAndStrongWeak(currentPlayerForQuestion, "banked");

    // Bank wisselt NIET van speler - blijf bij huidige speler
    showQuestion(currentPlayerForQuestion);

    updateButtonVisibility();
});





eliminateBtn.addEventListener('click', () => {
    const sel = document.querySelector('input[name="vote"]:checked');
    if(!sel) return flashMessage('Selecteer eerst wie je wilt elimineren.');

    const id = parseInt(sel.value,10);
    const p = players.find(x=>x.id===id);
    if(!p) return;
    
    // 🆕 Check: Kan niet elimineren in de finale ronde (2 spelers)
    const r = rounds[currentRound];
    if(r && r.type === 'normal-final') {
        return flashMessage('Dit is de finale ronde — geen eliminatie nodig! Ga naar Head-to-Head.');
    }

    p.elim = true;
    eliminated.push(p.name);
    renderPlayersUI();

    // markeer eliminatie in deze ronde
    rounds[currentRound].eliminationDone = true;
    eliminateBtn.disabled = true;

    playSound('./soundtrack/The Walk Of Shame.mp3');

    const aliveCount = players.filter(p => !p.elim).length;
    if(aliveCount === 2){
        flashMessage('Er zijn nog 2 spelers over — volgende ronde is Head-to-Head!');
    } else {
        flashMessage(`${p.name} is geëlimineerd. Klik op "Volgende ronde" om door te gaan.`);
    }

    // 🆕 toon statistieken bij elke actieve speler
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
    
    // Broadcast naar display
    broadcastToDisplay({
        type: 'player_eliminated',
        playerName: p.name
    });

    // Broadcast voting ended to candidates
    broadcastToDisplay({
        type: 'voting_ended'
    });
    
    updateButtonVisibility();
});

document.getElementById('IntroBtn').addEventListener('click', () => {
    // Stop huidige muziek en speel Intro
    playSound('./soundtrack/Intro.mp3', {loop:false});
});

document.getElementById('ShortStingBtn').addEventListener('click', () => {
    // Stop huidige muziek en speel Short Sting
    playSound('./soundtrack/Short Sting.mp3', {loop:false});
});

document.getElementById('GeneralBedBtn').addEventListener('click', () => {
    // Stop huidige muziek en speel General Bed
    playSound('./soundtrack/General Bed.mp3', {loop:false});
});

document.getElementById('afterInterviewBtn').addEventListener('click', () => {
    // Stop huidige muziek en speel After Interview Sting
    playSound('./soundtrack/After Interview Sting.wav', {loop:false});
});

document.getElementById('generalBumper').addEventListener('click', () => {
    // Stop huidige muziek en speel Main Sting
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
    // Reset candidate votes for new voting round
    candidateVotes = {};

    // Stop andere muziek en speel Voting Music (één keer)
    playSound('./soundtrack/Voting Music.mp3', {loop:false});

    votingTimeLeft = 25;
    updateVotingTimerDisplay();

    clearInterval(votingInterval);
    votingInterval = setInterval(() => {
        votingTimeLeft--;
        updateVotingTimerDisplay();
        
        // Broadcast timer update naar display
        broadcastToDisplay({
            type: 'voting_timer',
            time: votingTimeLeft
        });
        
        if(votingTimeLeft <= 0){
            clearInterval(votingInterval);
            flashMessage('Stemmen afgelopen!');

            // Broadcast voting ended to candidates
            broadcastToDisplay({
                type: 'voting_ended'
            });
        }
    }, 1000);
    
    // Broadcast voting started met statistieken
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
        players: alive, // Send full player objects for candidate voting
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


/* keyboard shortcuts (host convenience) */
document.addEventListener('keydown', (e)=>{
  if(e.key==='b') bankBtn.click();
  if(e.key==='g') rightBtn.click();
  if(e.key==='f') wrongBtn.click();
});

// Communicatie met overlay
const bc = new BroadcastChannel('moneyChainChannel');

// Nieuwe functie: stuur ketting naar overlay
function sendChainToOverlay(){
    if(!moneyChain) return;
    bc.postMessage({type:'initChain', chain: moneyChain});
}

// Update voortgang
function updateOverlayChain(index){
    bc.postMessage({type:'updateChain', index});
}

// Stuur bank actie
function overlayBanked(){
    bc.postMessage({type:'banked'});
}

// expose some helper functions for debugging in console
window._zwak = {players, rounds, moneyChain, buildRounds, buildMoneyChain};

function startRoundTimer(durationSecs) {
  clearInterval(roundTimerInterval); // reset vorige timer
  roundTimeLeft = durationSecs;
  updateTimerDisplay();

  roundTimerInterval = setInterval(() => {
    roundTimeLeft--;
    updateTimerDisplay();
    
    // Broadcast timer update naar display
    broadcastToDisplay({
        type: 'round_timer',
        time: roundTimeLeft
    });

    // ⏰ Stop ronde als tijd op is
    if (roundTimeLeft <= 0) {
      clearInterval(roundTimerInterval);
      flashMessage('Tijd is voorbij voor deze ronde!');
      chainAccum = 0;
      chainIndex = 0;
      updateHeads();

      // nu mag de host elimineren
      eliminateBtn.disabled = false;

      // stop reguliere rondemuziek
      // if (bedjeAudio && !bedjeAudio.paused) {
      //   bedjeAudio.pause();
      //   bedjeAudio.currentTime = 0;
      // }

      // 🆕 Toon sterkste en zwakste schakel
      renderStrongestWeakest(currentRound);
      
      // Update knop-zichtbaarheid
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
