// ============================================
// MAIN ENTRY POINT
// ============================================

import { MapController } from './map.js';
import { EventsManager } from './events.js';
import { UIController } from './ui.js';
import { APP_CONFIG } from './config.js';

/**
 * World Events Monitor Application
 * 
 * Architecture:
 * - MapController: Handles MapLibre GL JS initialization and map interactions
 * - EventsManager: Manages event data, API connections, and filtering
 * - UIController: Handles all UI interactions and rendering
 */
class WorldEventsApp {
  constructor() {
    this.map = null;
    this.events = null;
    this.ui = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      console.log('🌍 Initializing World Events Monitor...');

      // Initialize event manager first
      this.events = new EventsManager({
        onUpdate: (events, options) => this.handleEventsUpdate(events, options),
        onError: (error) => this.handleError(error)
      });

      // Initialize map
      this.map = new MapController('map', {
        onEventClick: (event) => this.handleEventClick(event),
        onViewportChange: (viewport) => this.handleViewportChange(viewport)
      });

      // Initialize UI controller
      this.ui = new UIController(this.events, this.map);

      // Load initial data
      await this.events.loadEvents();

      // Start real-time updates
      this.events.startPolling();
      this.events.connectSSE();

      // Handle window resize
      window.addEventListener('resize', () => {
        this.map.resize();
      });

      // Handle page visibility (pause/resume updates)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.events.stopPolling();
        } else {
          this.events.startPolling();
          this.events.checkForUpdates();
        }
      });

      // Show welcome alert
      setTimeout(() => {
        this.ui.showAlert('Real-time monitoring active. Data updates every 30 seconds.', 'info');
      }, 1000);

      this.initialized = true;
      console.log('✅ World Events Monitor initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
      this.showFatalError(error);
    }
  }

  /**
   * Handle events data updates
   */
  handleEventsUpdate(events, options = {}) {
    // Update UI
    this.ui.onEventsUpdate(events, options);
    
    // Log for debugging
    if (options.newEvent) {
      console.log('📍 New event:', options.newEvent.title);
    }
  }

  /**
   * Handle map event click
   */
  handleEventClick(event) {
    this.ui.showEventDetail(event);
  }

  /**
   * Handle viewport changes (for URL state)
   */
  handleViewportChange(viewport) {
    // Update URL with current viewport
    const params = new URLSearchParams(window.location.search);
    params.set('lat', viewport.center.lat.toFixed(6));
    params.set('lng', viewport.center.lng.toFixed(6));
    params.set('zoom', viewport.zoom.toFixed(2));
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error('Application error:', error);
    this.ui.showAlert(`Error: ${error.message}. Retrying...`, 'warning');
  }

  /**
   * Show fatal initialization error
   */
  showFatalError(error) {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          padding: 2rem;
          text-align: center;
          background: var(--color-bg-primary, #0d1117);
          color: var(--text-primary, #f0f6fc);
        ">
          <h1 style="margin-bottom: 1rem; color: var(--color-accent-danger, #da3633);">
            ⚠️ Initialization Failed
          </h1>
          <p style="color: var(--text-secondary, #8b949e); max-width: 500px;">
            ${error.message}
          </p>
          <button onclick="location.reload()" style="
            margin-top: 2rem;
            padding: 0.75rem 1.5rem;
            background: var(--color-accent-primary, #58a6ff);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          ">
            Reload Application
          </button>
        </div>
      `;
    }
  }

  /**
   * Public API for external control
   */
  useMockData(enabled) {
    this.events.useMockData(enabled);
  }

  setLayers(layers) {
    this.events.setLayers(layers);
  }

  flyTo(lat, lng, zoom) {
    this.map.flyTo([lng, lat], zoom);
  }

  resetView() {
    this.map.resetView();
  }
}

// ============================================
// INITIALIZATION
// ============================================

// Create global app instance
const app = new WorldEventsApp();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Expose app to global scope for debugging
window.worldEventsApp = app;

// Expose API for console debugging
window.EVENTS_API = {
  useMockData: (enabled) => app.useMockData(enabled),
  setLayers: (layers) => app.setLayers(layers),
  flyTo: (lat, lng, zoom) => app.flyTo(lat, lng, zoom),
  resetView: () => app.resetView(),
  getState: () => ({
    layers: [...app.events.activeLayers],
    timeRange: app.events.timeRange,
    eventCount: app.events.filteredEvents.length
  })
};

// Log available console commands
console.log('%c🔧 Developer Console Commands:', 'color: #58a6ff; font-weight: bold;');
console.log('%cEVENTS_API.useMockData(true/false)', 'color: #8b949e;', '- Toggle mock data mode');
console.log('%cEVENTS_API.setLayers(["conflicts", "wildfires"])', 'color: #8b949e;', '- Set active layers');
console.log('%cEVENTS_API.flyTo(lat, lng, zoom)', 'color: #8b949e;', '- Fly to location');
console.log('%cEVENTS_API.resetView()', 'color: #8b949e;', '- Reset map view');
console.log('%cEVENTS_API.getState()', 'color: #8b949e;', '- Get current state');
