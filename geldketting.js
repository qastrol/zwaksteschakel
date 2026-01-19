// Globale variabelen voor overlay
window.MoneyChainOverlay = {
    currentRound: 0,
    chainAccum: 0,
    bankTotal: 0,
    moneyChain: [],
    maxSteps: 0,
    updateCallback: null
};

// Functie om overlay bij te werken
function updateOverlay({currentRound, chainAccum, bankTotal, moneyChain}) {
    const state = window.MoneyChainOverlay;
    if (currentRound !== undefined) state.currentRound = currentRound;
    if (chainAccum !== undefined) state.chainAccum = chainAccum;
    if (bankTotal !== undefined) state.bankTotal = bankTotal;
    if (moneyChain !== undefined) {
        state.moneyChain = moneyChain;
        state.maxSteps = moneyChain.length;
    }

    if (state.updateCallback) state.updateCallback(state);
}
