# De Zwakste Schakel - Display Weergave

## Overzicht

Dit display systeem biedt een visuele presentatie van De Zwakste Schakel quiz voor kandidaten en toeschouwers. Het synchroniseert automatisch met de host tool via de Browser BroadcastChannel API.

## Bestanden

- **display.html** - Het hoofdbestand voor de display weergave
- **display.css** - Styling voor de display interface
- **display.js** - JavaScript voor synchronisatie en weergave logica

## Gebruik

### 1. Setup

Open twee browservensters (of tabs):
1. **Host Tool** - `index.html` - Voor de spelleider
2. **Display** - `display.html` - Voor kandidaten/toeschouwers

**Belangrijk:** Beide vensters moeten in dezelfde browser op hetzelfde apparaat geopend zijn voor BroadcastChannel synchronisatie.

### 2. Display Scenes

Het display toont automatisch verschillende schermen afhankelijk van de spelstatus:

#### Wachtscherm
- Verschijnt bij het opstarten
- Wacht op spelcreatie door de host

#### Lobby
- Toont alle kandidaten
- Geeft de totale pot en aantal spelers weer

#### Actieve Ronde
- Toont de huidige vraag
- Speelsterkte statistieken per kandidaat
- Geldketting met huidige positie
- Pot totaal

#### Stemfase
- Aftellende timer (25 seconden)
- Statistieken van alle overgebleven kandidaten
- Sterkste en zwakste schakel indicatie

#### Eliminatie
- Toont welke kandidaat geëlimineerd is
- Automatische overgang na 5 seconden

#### Head-to-Head Finale
- Toont beide finalisten
- Live score bijhouden
- Huidige vraag weergave

#### Winnaar
- Felicitatie scherm met winnaarnaam
- Gewonnen bedrag

## Technische Details

### Communicatie

De display communiceert met de host via **BroadcastChannel** met de naam `'zwakste_schakel'`.

Belangrijke berichten:
- `game_created` - Spel aangemaakt
- `round_started` - Ronde gestart
- `question_changed` - Nieuwe vraag
- `answer_correct` - Goed antwoord
- `answer_wrong` - Fout antwoord
- `bank` - Geld gebankt
- `voting_started` - Stemfase begonnen
- `player_eliminated` - Speler geëlimineerd
- `headtohead_started` - Head-to-Head gestart
- `game_winner` - Winnaar bekend

### Visuele Effecten

- **Fade-in animaties** bij scene wissels
- **Flash effecten** bij antwoorden (groen=goed, rood=fout, goud=bank)
- **Pulse animatie** voor winnaar naam
- **Active highlights** voor huidige speler/vraag

### Responsive Design

Het display past zich aan voor verschillende schermgroottes:
- Desktop: Volledige layout met sidebar
- Tablet/Mobile: Gestapelde layout

## Styling

Kleuren schema:
- **Primair achtergrond**: Donkerblauw gradient (#000814 → #001d3d)
- **Accent goud**: #ffd60a (titels, bedragen)
- **Accent blauw**: #0077b6 (randen, highlights)
- **Succes**: #22c55e (correcte antwoorden)
- **Gevaar**: #dc2626 (foute antwoorden, zwakste schakel)

## Tips voor Gebruik

1. **Dual Monitor Setup**: Open de host tool op één scherm en display op een tweede scherm/projector
2. **Browser Refresh**: Als de synchronisatie niet werkt, herlaad beide vensters
3. **Fullscreen**: Druk F11 voor fullscreen display presentatie
4. **Dezelfde Browser**: Zorg dat beide vensters in dezelfde browser draaien (Chrome, Firefox, Edge)

## Troubleshooting

**Display toont niets:**
- Controleer of beide bestanden in dezelfde browser geopend zijn
- Controleer browser console voor errors (F12)

**Geen synchronisatie:**
- BroadcastChannel werkt alleen binnen dezelfde browser instantie
- Herlaad beide vensters
- Check of JavaScript errors zijn in de console

**Visuele glitches:**
- Probeer browser cache te legen (Ctrl+Shift+Delete)
- Update naar laatste browser versie

## Browser Compatibiliteit

Ondersteund in:
- Chrome 54+
- Firefox 38+
- Edge 79+
- Safari 15.4+

## Toekomstige Verbeteringen

Mogelijke toevoegingen:
- WebSocket support voor cross-device synchronisatie
- Kandidaat foto's in de display
- Animaties voor geldketting progressie
- Geluid effecten op display
- Statistieken grafiek na afloop
