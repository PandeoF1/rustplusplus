# WebUI - Live Map Viewer

> The rustplusplus WebUI provides a real-time web interface for monitoring your Rust servers with live player tracking, map overlays, statistics, and replay functionality.

## Quick Start

The WebUI starts automatically when you launch rustplusplus:

```bash
npm start run
```

Access the WebUI at `http://localhost:3000`

### Docker

Ensure port 3000 is exposed:

```bash
docker-compose up -d
```

Or:

```bash
docker run --rm -it -p 3000:3000 ... ghcr.io/alexemanuelol/rustplusplus
```

### Configuration

The WebUI can be configured in `config/index.js`:

```javascript
webui: {
    enabled: process.env.RPP_WEBUI_ENABLED !== 'false', // Enable/disable WebUI
    port: process.env.RPP_WEBUI_PORT || 3000,           // WebUI port
}
```

Or using environment variables:
- `RPP_WEBUI_ENABLED` - Enable/disable WebUI (default: `true`)
- `RPP_WEBUI_PORT` - Port number (default: `3000`)

---

## Features

### Real-Time Map
- Live player positions and movement trails
- Monument markers and coordinate grid
- Death markers with time filtering (1 hour to 30 days)
- Event markers (Cargo Ship, Patrol Helicopter, Chinook)
- Vending machines and custom markers
- Interactive minimap with auto-follow

### Statistics Dashboard
- Player stats (playtime, deaths, sessions, movements)
- Server statistics and activity charts
- Death analytics
- PIN code authentication

### Map Replay
- Review historical player movements
- Adjustable playback speed (0.5x to 10x)
- Trail visualization with fade effects
- Timeline scrubbing and controls

---

## Accessing the WebUI

**Local**: `http://localhost:3000`

**Remote**: `http://YOUR_SERVER_IP:3000`

**Network**: `http://YOUR_LOCAL_IP:3000`

---

## Interface Overview

### Server Selector
Dropdown menu to switch between connected Discord guilds/servers.

### Sidebar

**Server Info**
- Server name, map seed/size, player count
- In-game time and team member status

**Map Controls**
- Toggle layers: Players, Trails, Monuments, Grid, Events, Death Markers
- Trail duration slider (1-30 minutes)
- Death marker time range (1 hour to 30 days)

**Minimap**
- Overview with player positions
- Follow player dropdown (auto-follow mode)
- Click to navigate main map

### Main Map
- Interactive map with pan/zoom controls
- Real-time updates every 3 seconds
- Full-screen view option

---

## Using Statistics

1. Click the **Statistics** button
2. Set a 4-digit PIN code on first access (optional)
3. Access player stats, server analytics, and leaderboards

---

## Using Map Replay

1. Click the **Replay** button
2. Select time range (start/end)
3. Click "Load Replay Data"
4. Use playback controls (play, pause, speed adjustment)

**Features**:
- Review historical player movements
- Playback speeds: 0.5x, 1x, 2x, 5x, 10x
- Timeline scrubbing
- Trail fade intensity control
- Historical death and event markers

---

## Troubleshooting

**WebUI Not Loading**
- Verify bot is running (`npm start run`)
- Check port 3000 is available
- Allow port 3000 in firewall

**No Server Data**
- Bot must be connected to Rust server
- Credentials must be configured
- Wait 30-60 seconds for initial connection

**Real-Time Updates Not Working**
- Check browser console for WebSocket errors
- Verify stable internet connection
- Use a modern browser (Chrome, Firefox, Edge, Safari)

**Statistics Not Loading**
- Set up PIN code authentication
- Ensure correct server selected
- Statistics require time to accumulate data

---

## Related Documentation

- [Installation Guide](installation.md)
- [Discord Bot Setup](discord_bot_setup.md)
- [Credentials Setup](credentials.md)
- [Commands List](commands.md)
- [Full Feature List](full_list_features.md)
