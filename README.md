# World Events Monitor

A premium, real-time world events monitoring interface with interactive mapping, layer controls, and live updates.

## Features

- **Interactive Map**: MapLibre GL JS with vector tiles, clustering, and heatmap modes
- **Event Layers**: Conflicts, military activity, climate anomalies, weather alerts, wildfires, sanctions, disease outbreaks
- **Time Controls**: Range selectors (24h, 7d, 30d) with animated timeline playback
- **Real-time Updates**: Server-Sent Events (SSE) with fallback to efficient polling
- **Responsive Design**: Mobile-first with collapsible sidebars
- **Accessibility**: WCAG AA compliant, keyboard navigation, ARIA labels

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

## Build for Production

```bash
npm run build
```

The `dist/` folder will contain the production build.

## API Integration

### Data Sources

This application uses the following open data sources:

1. **GDACS (Global Disaster Alert and Coordination System)**
   - URL: `https://www.gdacs.org/xml/rss.xml`
   - Provides: Natural disasters, earthquakes, tsunamis, cyclones, floods, droughts

2. **USGS Earthquake Feed**
   - URL: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`
   - Provides: Real-time earthquake data worldwide

3. **EONET (NASA Earth Observatory Natural Event Tracker)**
   - URL: `https://eonet.gsfc.nasa.gov/api/v3/events`
   - Provides: Wildfires, severe storms, ice, volcanoes

4. **OpenStreetMap (Vector Tiles)**
   - URL: `https://tiles.openfreemap.org/styles/liberty`
   - Provides: Base map tiles (no API key required)

5. **Nominatim Geocoding** (for search)
   - URL: `https://nominatim.openstreetmap.org/search`
   - Provides: Location search and geocoding

### WorldMonitor Integration

The reference repository (koala73/worldmonitor) requires self-hosting with Convex backend. For this implementation, we use the publicly available data sources listed above. To integrate with a self-hosted WorldMonitor instance:

1. Set the API endpoint in `src/config.js`:
   ```javascript
   export const API_CONFIG = {
     baseUrl: 'http://your-worldmonitor-instance/api',
     wsUrl: 'ws://your-worldmonitor-instance/ws'
   };
   ```

2. The application will automatically use SSE for real-time updates if available.

### Mock Data Mode

For demo purposes without external APIs, the app includes a mock data generator. Enable it in the browser console:

```javascript
window.EVENTS_API.useMockData(true);
```

## Architecture

```
src/
├── main.js           # Application entry point
├── map.js            # MapLibre GL initialization and layers
├── events.js         # Event data management and API
├── ui.js             # UI component handlers
├── time-controls.js  # Timeline and animation
├── search.js         # Geocoding and search
├── notifications.js  # Alerts and notifications
├── utils.js          # Helper functions
└── config.js         # Configuration and constants
```

## Design System

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for the complete design specification including colors, typography, spacing, and component specifications.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close panels/overlays |
| `Space` | Play/Pause timeline |
| `F` | Focus search |
| `L` | Toggle layer panel |
| `T` | Toggle time controls |
| `R` | Reset view |

## License

MIT License - See LICENSE file for details.
