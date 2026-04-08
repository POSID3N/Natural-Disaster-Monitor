// ============================================
// EVENTS MODULE - Data Management & API
// ============================================

import { APP_CONFIG, API_ENDPOINTS, LAYER_PRESETS } from './config.js';
import { generateId, formatRelativeTime, parseFeed, debounce } from './utils.js';

export class EventsManager {
  constructor(options = {}) {
    this.events = [];
    this.filteredEvents = [];
    this.activeLayers = new Set(LAYER_PRESETS.default);
    this.timeRange = APP_CONFIG.timeRanges['24h'];
    this.useMockData = false;
    this.onUpdate = options.onUpdate || (() => {});
    this.onError = options.onError || (() => {});
    this.pollInterval = null;
    this.eventSource = null;
    this.lastUpdate = null;
    
    this.init();
  }

  init() {
    // Load from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const layers = urlParams.get('layers')?.split(',');
    if (layers) {
      this.activeLayers = new Set(layers);
    }
    
    const time = urlParams.get('time');
    if (time && APP_CONFIG.timeRanges[time]) {
      this.timeRange = APP_CONFIG.timeRanges[time];
    }
  }

  // Generate mock events for demo
  generateMockEvents(count = 50) {
    const types = Object.keys(APP_CONFIG.eventTypes);
    const events = [];
    const now = Date.now();
    
    const locations = [
      { lat: 40.7128, lng: -74.0060, name: 'New York, USA' },
      { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
      { lat: 35.6762, lng: 139.6503, name: 'Tokyo, Japan' },
      { lat: -33.8688, lng: 151.2093, name: 'Sydney, Australia' },
      { lat: 55.7558, lng: 37.6173, name: 'Moscow, Russia' },
      { lat: 48.8566, lng: 2.3522, name: 'Paris, France' },
      { lat: 52.5200, lng: 13.4050, name: 'Berlin, Germany' },
      { lat: 19.4326, lng: -99.1332, name: 'Mexico City, Mexico' },
      { lat: -23.5505, lng: -46.6333, name: 'São Paulo, Brazil' },
      { lat: 28.6139, lng: 77.2090, name: 'New Delhi, India' },
      { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
      { lat: 41.9028, lng: 12.4964, name: 'Rome, Italy' },
      { lat: 39.9042, lng: 116.4074, name: 'Beijing, China' },
      { lat: 37.5665, lng: 126.9780, name: 'Seoul, South Korea' },
      { lat: 25.2048, lng: 55.2708, name: 'Dubai, UAE' },
      { lat: -1.2921, lng: 36.8219, name: 'Nairobi, Kenya' },
      { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires, Argentina' },
      { lat: 59.9139, lng: 10.7522, name: 'Oslo, Norway' },
      { lat: 64.1466, lng: -21.9426, name: 'Reykjavik, Iceland' },
      { lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro, Brazil' },
    ];

    const titles = {
      conflicts: ['Escalation in border region', 'Armed clash reported', 'Tensions rise in disputed area', 'Military buildup observed'],
      military: ['Naval exercises conducted', 'Air patrol increased', 'Troop movements detected', 'Military drill announced'],
      wildfires: ['Wildfire spreading rapidly', 'Fire containment efforts ongoing', 'Evacuation orders issued', 'Smoke affecting air quality'],
      earthquakes: [`M${(Math.random() * 5 + 3).toFixed(1)} earthquake reported`, 'Seismic activity detected', 'Aftershocks expected', 'Tremor felt across region'],
      storms: ['Severe storm warning issued', 'Hurricane approaching coast', 'Flash flood risk elevated', 'Tornado watch in effect'],
      climate: ['Temperature record broken', 'Drought conditions worsening', 'Unusual weather pattern detected', 'Sea level rise observed'],
      disease: ['Outbreak declared in region', 'Health emergency status', 'Vaccination campaign launched', 'Case numbers rising'],
      sanctions: ['Economic sanctions imposed', 'Trade restrictions announced', 'Asset freeze ordered', 'Diplomatic measures taken'],
    };

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const typeConfig = APP_CONFIG.eventTypes[type];
      const severity = typeConfig.severity[Math.floor(Math.random() * typeConfig.severity.length)];
      const titleList = titles[type];
      const title = titleList[Math.floor(Math.random() * titleList.length)];
      
      // Add some randomness to location
      const lat = location.lat + (Math.random() - 0.5) * 10;
      const lng = location.lng + (Math.random() - 0.5) * 10;
      
      // Random time within the selected range
      const hoursAgo = Math.random() * this.timeRange.hours;
      const timestamp = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
      
      events.push({
        id: generateId(),
        type,
        title: `${title} - ${location.name}`,
        description: `A ${severity} level ${typeConfig.label.toLowerCase()} event has been reported in ${location.name}. Authorities are monitoring the situation and coordinating response efforts.`,
        location: location.name,
        lat,
        lng,
        severity,
        timestamp,
        source: 'Demo Data',
        url: '#',
        confidence: Math.floor(Math.random() * 40 + 60),
        affectedArea: Math.floor(Math.random() * 1000 + 10),
        lastUpdate: timestamp
      });
    }

    // Sort by timestamp (newest first)
    return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async fetchRealData() {
    const events = [];
    
    try {
      // Fetch earthquakes from USGS
      if (this.activeLayers.has('earthquakes')) {
        const earthquakeData = await parseFeed(API_ENDPOINTS.usgs);
        earthquakeData.features.forEach(eq => {
          events.push({
            id: `usgs-${eq.id}`,
            type: 'earthquakes',
            title: `M${eq.properties.mag} Earthquake - ${eq.properties.place}`,
            description: `A magnitude ${eq.properties.mag} earthquake occurred at ${eq.properties.place}. Depth: ${eq.geometry.coordinates[2]}km.`,
            location: eq.properties.place,
            lat: eq.geometry.coordinates[1],
            lng: eq.geometry.coordinates[0],
            severity: this.magnitudeToSeverity(eq.properties.mag),
            timestamp: new Date(eq.properties.time).toISOString(),
            source: 'USGS',
            url: eq.properties.url,
            confidence: 95,
            affectedArea: 0,
            lastUpdate: new Date().toISOString()
          });
        });
      }

      // Fetch EONET events (wildfires, storms, etc)
      if (this.activeLayers.has('wildfires') || this.activeLayers.has('storms')) {
        const eonetData = await parseFeed(API_ENDPOINTS.eonet);
        eonetData.events.forEach(event => {
          const geometry = event.geometry[0];
          const type = this.categorizeEonetEvent(event.categories[0]?.title);
          
          if (this.activeLayers.has(type)) {
            events.push({
              id: `eonet-${event.id}`,
              type,
              title: event.title,
              description: event.description || `${event.title} - ${event.categories[0]?.title}`,
              location: geometry.coordinates.join(', '),
              lat: geometry.coordinates[1],
              lng: geometry.coordinates[0],
              severity: 'medium',
              timestamp: geometry.date,
              source: 'NASA EONET',
              url: event.sources[0]?.url || '#',
              confidence: 85,
              affectedArea: 0,
              lastUpdate: new Date().toISOString()
            });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching real data:', error);
      this.onError(error);
    }

    return events;
  }

  magnitudeToSeverity(mag) {
    if (mag < 4) return 'minor';
    if (mag < 5) return 'light';
    if (mag < 6) return 'moderate';
    if (mag < 7) return 'strong';
    return 'major';
  }

  categorizeEonetEvent(category) {
    const categoryMap = {
      'Wildfires': 'wildfires',
      'Severe Storms': 'storms',
      'Volcanoes': 'natural',
      'Icebergs': 'climate',
      'Drought': 'climate',
      'Dust and Haze': 'climate'
    };
    return categoryMap[category] || 'natural';
  }

  async loadEvents() {
    let events;
    
    if (this.useMockData) {
      events = this.generateMockEvents(60);
    } else {
      // Try real data first, fall back to mock
      try {
        events = await this.fetchRealData();
        if (events.length === 0) {
          events = this.generateMockEvents(60);
        }
      } catch {
        events = this.generateMockEvents(60);
      }
    }

    this.events = events;
    this.applyFilters();
    this.onUpdate(this.filteredEvents);
    this.lastUpdate = new Date();
  }

  applyFilters() {
    const now = Date.now();
    const cutoff = now - (this.timeRange.hours * 60 * 60 * 1000);
    
    this.filteredEvents = this.events.filter(event => {
      // Filter by layer
      if (!this.activeLayers.has(event.type)) return false;
      
      // Filter by time
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime < cutoff) return false;
      
      return true;
    });
  }

  setLayers(layers) {
    this.activeLayers = new Set(layers);
    this.applyFilters();
    this.onUpdate(this.filteredEvents);
    
    // Reload if we have new layer types
    const needsReload = [...this.activeLayers].some(layer => 
      !this.events.some(e => e.type === layer)
    );
    if (needsReload) {
      this.loadEvents();
    }
  }

  setTimeRange(rangeKey) {
    if (APP_CONFIG.timeRanges[rangeKey]) {
      this.timeRange = APP_CONFIG.timeRanges[rangeKey];
      this.applyFilters();
      this.onUpdate(this.filteredEvents);
    }
  }

  // Real-time updates via polling (SSE fallback)
  startPolling() {
    this.stopPolling();
    
    this.pollInterval = setInterval(() => {
      this.checkForUpdates();
    }, APP_CONFIG.updates.pollInterval);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // SSE connection for real-time updates
  connectSSE() {
    // In production, this would connect to your SSE endpoint
    // For demo, we simulate with periodic mock updates
    this.simulateRealtimeUpdates();
  }

  simulateRealtimeUpdates() {
    // Simulate new events coming in
    setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance every interval
        const newEvent = this.generateMockEvents(1)[0];
        newEvent.timestamp = new Date().toISOString();
        newEvent.title = `[NEW] ${newEvent.title}`;
        
        this.events.unshift(newEvent);
        this.applyFilters();
        this.onUpdate(this.filteredEvents, { newEvent });
      }
    }, 15000); // Every 15 seconds
  }

  async checkForUpdates() {
    // Check for updates from APIs
    if (!this.useMockData) {
      await this.loadEvents();
    }
  }

  getEventById(id) {
    return this.events.find(e => e.id === id);
  }

  useMockData(enabled) {
    this.useMockData = enabled;
    this.loadEvents();
  }

  destroy() {
    this.stopPolling();
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}
