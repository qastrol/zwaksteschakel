# De Zwakste Schakel - Server Setup

## 🚀 Snelstart

### Stap 1: Installeer Node.js
Als je Node.js nog niet hebt geïnstalleerd:
1. Download van https://nodejs.org/ (LTS versie aanbevolen)
2. Installeer met standaard instellingen
3. Herstart je computer na installatie

### Stap 2: Start de Server
1. Dubbelklik op **`start_server.bat`**
2. Het script installeert automatisch de benodigde packages (eerste keer)
3. De server start en toont de toegangslinks

### Stap 3: Open de Pagina's
**Op dezelfde computer:**
- Host (spelleider): http://localhost:3000/
- Display (kandidaten): http://localhost:3000/display

**Op andere apparaten (hetzelfde netwerk):**
- Gebruik het IP-adres dat in de terminal wordt getoond
- Bijvoorbeeld: http://192.168.1.100:3000/display

## 📋 Gebruiksinstructies

### Voor de Spelleider (Host)
1. Open http://localhost:3000/ in een browser
2. Stel het spel in (aantal kandidaten, namen, etc.)
3. Klik op "Maak spel"
4. Alle displays worden automatisch bijgewerkt

### Voor Kandidaten/Toeschouwers (Display)
1. Open http://[IP-ADRES]:3000/display
2. De display synchroniseert automatisch met de host
3. Volg het spel op het grote scherm

## 🔧 Handmatige Setup (indien nodig)

Als de .bat file niet werkt, voer deze commando's uit in PowerShell:

```powershell
# Navigeer naar de map
cd "C:\Users\Gebruiker\Pictures\stream\De Zwakste Schakel\site"

# Installeer dependencies (eerste keer)
npm install

# Start de server
node server.js
```

## 🌐 Netwerk Setup

### Toegang vanaf andere apparaten:

1. **Vind je IP-adres:**
   - Open PowerShell
   - Typ: `ipconfig`
   - Zoek "IPv4 Address" onder je actieve netwerkadapter
   - Bijvoorbeeld: 192.168.1.100

2. **Open op andere apparaat:**
   - Zorg dat apparaten op hetzelfde WiFi-netwerk zitten
   - Open browser op ander apparaat
   - Ga naar: `http://[JE-IP]:3000/display`
   - Bijvoorbeeld: `http://192.168.1.100:3000/display`

### Firewall Instellingen (indien nodig):

Als andere apparaten geen verbinding kunnen maken:

1. Open Windows Defender Firewall
2. Klik "Een app of onderdeel toestaan via Windows Defender Firewall"
3. Klik "Instellingen wijzigen"
4. Klik "Andere app toestaan..."
5. Blader naar: `C:\Program Files\nodejs\node.exe`
6. Voeg toe en vink "Privé" aan

## 🔍 Probleemoplossing

### Server start niet:
- Controleer of Node.js is geïnstalleerd: `node --version`
- Controleer of poort 3000 vrij is
- Herstart je computer

### Display synchroniseert niet:
- Controleer of server draait
- Ververs de display pagina (F5)
- Controleer netwerkverbinding
- Kijk in browser console (F12) voor errors

### Verbinding verbroken:
- Server herstart automatisch de verbinding
- Ververs de pagina als het niet automatisch lukt

### Andere apparaten kunnen niet verbinden:
- Controleer firewall instellingen (zie hierboven)
- Zorg dat apparaten op hetzelfde netwerk zitten
- Gebruik het correcte IP-adres (niet localhost)
- Probeer antivirus tijdelijk uit te schakelen

## 📱 Aanbevolen Setup

### Optie 1: Dual Monitor
- Monitor 1: Host tool (voor spelleider)
- Monitor 2: Display (voor kandidaten, volledig scherm F11)

### Optie 2: Computer + TV/Beamer
- Computer: Host tool
- TV/Beamer: Display via HDMI of draadloos (Chromecast/AirPlay)

### Optie 3: Computer + Tablet/Laptop
- Computer: Host tool
- Tablet/Laptop: Display (via WiFi, gebruik IP-adres)

## 🎮 Tijdens het Spel

De host en display synchroniseren automatisch:
- ✅ Spel aanmaken
- ✅ Rondes starten
- ✅ Vragen tonen
- ✅ Antwoorden (goed/fout/bank)
- ✅ Timers
- ✅ Stemfase
- ✅ Eliminaties
- ✅ Head-to-Head finale
- ✅ Winnaar

## 💡 Tips

1. **Test voor de show:** Start de server en test beide schermen
2. **Stabiel netwerk:** Gebruik bekabeld internet voor de beste performance
3. **Volledig scherm:** Druk F11 op de display voor volledig scherm
4. **Backup plan:** Houd BroadcastChannel als fallback (werkt lokaal)

## 🛠️ Technische Details

**Stack:**
- Node.js + Express (webserver)
- WebSocket (ws package) voor real-time communicatie
- Automatische herverbinding bij disconnect
- Fallback naar BroadcastChannel voor lokaal gebruik

**Poorten:**
- 3000 (HTTP + WebSocket)

**Bestanden:**
- `server.js` - WebSocket server
- `start_server.bat` - Start script
- `package.json` - Dependencies
- `script.js` - Host logic (WebSocket client)
- `display.js` - Display logic (WebSocket client)

## 📞 Support

Bij problemen:
1. Check de server terminal voor error messages
2. Check browser console (F12) voor JavaScript errors
3. Herstart de server en ververs de browsers
