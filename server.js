const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(__dirname));

// Routes
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'display.html'));
});

app.get('/candidate-voting', (req, res) => {
    res.sendFile(path.join(__dirname, 'candidate-voting.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let gameState = {
    players: [],
    currentRound: 0,
    moneyChain: [],
    bankTotal: 0,
    chainPosition: 0,
    roundTime: 0,
    currentQuestion: null,
    currentPlayer: null
};

// Store connected clients
const clients = {
    hosts: new Set(),
    displays: new Set(),
    candidates: new Set()
};

// Track logged in candidates to prevent multiple logins
const loggedInCandidates = new Set();

wss.on('connection', (ws, req) => {
    console.log('New client connected from:', req.socket.remoteAddress);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type);

            // Register client type
            if (data.type === 'register') {
                if (data.role === 'host') {
                    clients.hosts.add(ws);
                    ws.role = 'host';
                    console.log('Host registered. Total hosts:', clients.hosts.size);
                    
                    // Send current state to new host
                    ws.send(JSON.stringify({
                        type: 'state_sync',
                        state: gameState
                    }));
                } else if (data.role === 'display') {
                    clients.displays.add(ws);
                    ws.role = 'display';
                    console.log('Display registered. Total displays:', clients.displays.size);
                    
                    // Send current state to new display
                    ws.send(JSON.stringify({
                        type: 'state_sync',
                        state: gameState
                    }));
                } else if (data.role === 'candidate') {
                    clients.candidates.add(ws);
                    ws.role = 'candidate';
                    ws.loggedInPlayerId = null; // Track which player this candidate represents
                    console.log('Candidate registered. Total candidates:', clients.candidates.size);
                    
                    // Send current game state to candidate
                    ws.send(JSON.stringify({
                        type: 'game_created',
                        players: gameState.players
                    }));
                }
                return;
            }

            // Update game state for certain events
            switch (data.type) {
                case 'game_created':
                    gameState.players = data.players;
                    gameState.moneyChain = data.moneyChain;
                    gameState.maxTotal = data.maxTotal;
                    gameState.currentRound = 0;
                    gameState.bankTotal = 0;
                    gameState.chainPosition = 0;
                    break;
                    
                case 'round_started':
                    gameState.currentRound = data.round;
                    gameState.roundTime = data.time;
                    gameState.chainPosition = 0;
                    break;
                    
                case 'question_changed':
                    gameState.currentPlayer = data.player;
                    gameState.currentQuestion = data.question;
                    break;
                    
                case 'answer_correct':
                    gameState.chainPosition++;
                    break;
                    
                case 'answer_wrong':
                    gameState.chainPosition = 0;
                    break;
                    
                case 'bank':
                    gameState.chainPosition = 0;
                    break;
                    
                case 'round_timer':
                    gameState.roundTime = data.time;
                    break;
                    
                case 'voting_timer':
                    gameState.votingTime = data.time;
                    break;

                case 'voting_started':
                    // Update players in case they've changed
                    if (data.players) {
                        gameState.players = data.players;
                    }
                    break;
                    
                case 'player_eliminated':
                    const player = gameState.players.find(p => p.name === data.playerName);
                    if (player) player.elim = true;
                    break;
                    
                case 'game_reset':
                    gameState = {
                        players: [],
                        currentRound: 0,
                        moneyChain: [],
                        bankTotal: 0,
                        chainPosition: 0,
                        roundTime: 0,
                        currentQuestion: null,
                        currentPlayer: null
                    };
                    loggedInCandidates.clear(); // Reset candidate logins on game reset
                    break;

                // Candidate-specific messages
                case 'candidate_login':
                    // Handle candidate login attempt
                    if (loggedInCandidates.has(data.playerId)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Deze kandidaat is al ingelogd op een ander apparaat'
                        }));
                    } else {
                        loggedInCandidates.add(data.playerId);
                        ws.loggedInPlayerId = data.playerId;
                        ws.send(JSON.stringify({
                            type: 'candidate_login_success',
                            playerId: data.playerId
                        }));
                        console.log(`Candidate logged in as player ${data.playerId}`);
                    }
                    break;

                case 'candidate_vote':
                    // Handle candidate vote
                    if (ws.loggedInPlayerId !== data.voterId) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Je bent niet ingelogd als deze kandidaat'
                        }));
                        return;
                    }

                    // Forward vote to all hosts
                    clients.hosts.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'candidate_vote',
                                voterId: data.voterId,
                                votedForId: data.votedForId
                            }));
                        }
                    });

                    // Confirm vote to candidate
                    ws.send(JSON.stringify({
                        type: 'vote_registered'
                    }));

                    console.log(`Vote registered: Player ${data.voterId} voted for ${data.votedForId}`);
                    break;

                case 'request_state':
                    // Send current game state to requesting client
                    ws.send(JSON.stringify({
                        type: 'game_created',
                        players: gameState.players
                    }));
                    break;
            }

            // Broadcast to all displays (but not back to hosts)
            if (ws.role === 'host') {
                clients.displays.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });

                // Also broadcast voting-related messages to candidates
                if (data.type === 'voting_started' || data.type === 'voting_ended') {
                    clients.candidates.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(data));
                        }
                    });
                }

                console.log(`Broadcasted ${data.type} to ${clients.displays.size} displays and ${clients.candidates.size} candidates`);
            }
            
            // If display sends data, broadcast to hosts
            if (ws.role === 'display') {
                clients.hosts.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }

        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (ws.role === 'host') {
            clients.hosts.delete(ws);
            console.log('Host disconnected. Remaining hosts:', clients.hosts.size);
        } else if (ws.role === 'display') {
            clients.displays.delete(ws);
            console.log('Display disconnected. Remaining displays:', clients.displays.size);
        } else if (ws.role === 'candidate') {
            clients.candidates.delete(ws);
            // Remove from logged in candidates if they were logged in
            if (ws.loggedInPlayerId) {
                loggedInCandidates.delete(ws.loggedInPlayerId);
                console.log(`Candidate logged out: player ${ws.loggedInPlayerId}`);
            }
            console.log('Candidate disconnected. Remaining candidates:', clients.candidates.size);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connection_established',
        message: 'Connected to De Zwakste Schakel server'
    }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('DE ZWAKSTE SCHAKEL - WebSocket Server');
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Host URL:    http://localhost:${PORT}/dashboard`);
    console.log(`Display URL: http://localhost:${PORT}/display`);
    console.log('');
    console.log('Network access:');
    
    // Get local IP addresses
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`  http://${iface.address}:${PORT}/dashboard          (Host)`);
                console.log(`  http://${iface.address}:${PORT}/display  (Display)`);
            }
        }
    }
    console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});
