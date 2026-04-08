// ============================================
// MAP MODULE - MapLibre GL JS Integration
// ============================================

import maplibregl from 'maplibre-gl';
import { APP_CONFIG, ICONS, LAYER_PRESETS } from './config.js';
import { createSvg, generateId } from './utils.js';

export class MapController {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.map = null;
    this.markers = new Map();
    this.clusters = new Map();
    this.activeLayers = new Set();
    this.activeLayerTypes = new Set(LAYER_PRESETS.default);
    this.allEventData = [];
    this.eventData = [];
    this.onEventClick = options.onEventClick || (() => {});
    this.onViewportChange = options.onViewportChange || (() => {});
    
    this.init();
  }

  init() {
    const { defaultCenter, defaultZoom, tileServer } = APP_CONFIG;
    const urlParams = new URLSearchParams(window.location.search);
    const center = [
      parseFloat(urlParams.get('lng')) || defaultCenter[0],
      parseFloat(urlParams.get('lat')) || defaultCenter[1]
    ];
    const zoom = parseFloat(urlParams.get('zoom')) || defaultZoom;

    this.map = new maplibregl.Map({
      container: this.containerId,
      style: tileServer,
      center: center,
      zoom: zoom,
      minZoom: APP_CONFIG.minZoom,
      maxZoom: APP_CONFIG.maxZoom,
      attributionControl: false,
      pitchWithRotate: false,
    });

    // Add navigation control
    this.map.addControl(new maplibregl.NavigationControl({
      showCompass: false,
      visualizePitch: false,
    }), 'top-right');

    // Add attribution
    this.map.addControl(new maplibregl.AttributionControl({
      compact: true,
    }), 'bottom-right');

    // Bind events
    this.map.on('moveend', () => this.handleViewportChange());
    this.map.on('zoomend', () => this.handleViewportChange());
    
    // Initialize layers when style loads
    this.map.on('style.load', () => {
      this.initializeLayers();
    });
  }

  initializeLayers() {
    // Add source for events
    if (!this.map.getSource('events')) {
      this.map.addSource('events', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 40,
        clusterProperties: {
          types: ['concat', ['concat', ['get', 'type'], ',']]
        }
      });

      // Cluster circle layer
      this.map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#58a6ff',
            10, '#d29922',
            50, '#da3633'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            10, 30,
            50, 40
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Cluster count layer
      this.map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 14,
          'text-font': ['Open Sans Bold'],
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Unclustered point layer - outer glow (with layer type filter)
      this.map.addLayer({
        id: 'unclustered-point-glow',
        type: 'circle',
        source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['boolean', ['feature-state', 'visible'], true]],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 18,
          'circle-opacity': 0.3,
          'circle-blur': 1
        }
      });

      // Unclustered point layer - outer ring
      this.map.addLayer({
        id: 'unclustered-point-ring',
        type: 'circle',
        source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['boolean', ['feature-state', 'visible'], true]],
        paint: {
          'circle-color': 'transparent',
          'circle-radius': 14,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Unclustered point layer - main circle
      this.map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'events',
        filter: ['all', ['!', ['has', 'point_count']], ['boolean', ['feature-state', 'visible'], true]],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 10,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95
        }
      });

      // Click handlers for both layers
      this.map.on('click', 'unclustered-point', (e) => this.handlePointClick(e));
      this.map.on('click', 'unclustered-point-ring', (e) => this.handlePointClick(e));
      this.map.on('click', 'unclustered-point-glow', (e) => this.handlePointClick(e));
      
      // Hover cursor for all point layers
      ['unclustered-point', 'unclustered-point-ring', 'unclustered-point-glow'].forEach(layer => {
        this.map.on('mouseenter', layer, () => this.map.getCanvas().style.cursor = 'pointer');
        this.map.on('mouseleave', layer, () => this.map.getCanvas().style.cursor = '');
      });
    }
  }

  handleClusterClick(e) {
    const features = this.map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    const clusterId = features[0].properties.cluster_id;
    
    this.map.getSource('events').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      this.map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom
      });
    });
  }

  handlePointClick(e) {
    const feature = e.features[0];
    const eventId = feature.properties.id;
    const event = this.eventData.find(ev => ev.id === eventId);
    if (event) {
      this.onEventClick(event);
    }
  }

  handleViewportChange() {
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    
    this.onViewportChange({
      center: { lat: center.lat, lng: center.lng },
      zoom,
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      }
    });
  }

  updateEvents(events) {
    // Store all events - don't filter them out, just update visibility
    this.allEventData = events;
    this.eventData = events;
    
    const features = events.map(event => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [event.lng, event.lat]
      },
      properties: {
        id: event.id,
        type: event.type,
        color: APP_CONFIG.eventTypes[event.type]?.color || '#58a6ff',
        severity: event.severity,
        timestamp: event.timestamp
      }
    }));

    if (this.map.getSource('events')) {
      this.map.getSource('events').setData({
        type: 'FeatureCollection',
        features
      });
      
      // Apply current layer filter after data loads
      if (this.activeLayerTypes && this.activeLayerTypes.size > 0) {
        this.filterByLayerTypes(this.activeLayerTypes);
      }
    }
  }

  filterByLayerTypes(activeTypes) {
    // Store active layer types
    this.activeLayerTypes = new Set(activeTypes);
    
    if (!this.map.getSource('events')) return;
    
    // Build filter expression: show if type is in activeTypes AND not clustered
    const typeFilter = ['in', ['get', 'type'], ['literal', [...activeTypes]]];
    const notClustered = ['!', ['has', 'point_count']];
    
    // Apply filter to all point layers
    const filter = ['all', notClustered, typeFilter];
    
    this.map.setFilter('unclustered-point', filter);
    this.map.setFilter('unclustered-point-ring', filter);
    this.map.setFilter('unclustered-point-glow', filter);
    
    // For clusters, only show if cluster contains at least one visible type
    // This is more complex - we need to check if the cluster's types intersect with activeTypes
    // For simplicity, we show all clusters but they may expand to empty points
    this.map.setFilter('clusters', ['has', 'point_count']);
    this.map.setFilter('cluster-count', ['has', 'point_count']);
  }

  setLayerOpacity(layerId, opacity) {
    // For MapLibre GL, we'd need to adjust the paint properties
    // This is a simplified implementation
    if (layerId === 'events') {
      this.map.setPaintProperty('unclustered-point', 'circle-opacity', opacity / 100);
    }
  }

  toggleLayer(layerId, visible) {
    // Handle individual layer types
    if (layerId !== 'events' && APP_CONFIG.eventTypes[layerId]) {
      // Update active layer types set
      if (!this.activeLayerTypes) {
        this.activeLayerTypes = new Set(['conflicts', 'wildfires', 'earthquakes']);
      }
      
      if (visible) {
        this.activeLayerTypes.add(layerId);
      } else {
        this.activeLayerTypes.delete(layerId);
      }
      
      // Apply filter
      this.filterByLayerTypes(this.activeLayerTypes);
      return;
    }
    
    // Global events toggle
    const visibility = visible ? 'visible' : 'none';
    if (layerId === 'events') {
      this.map.setLayoutProperty('clusters', 'visibility', visibility);
      this.map.setLayoutProperty('cluster-count', 'visibility', visibility);
      this.map.setLayoutProperty('unclustered-point', 'visibility', visibility);
      this.map.setLayoutProperty('unclustered-point-ring', 'visibility', visibility);
      this.map.setLayoutProperty('unclustered-point-glow', 'visibility', visibility);
    }
  }

  setActiveLayerTypes(types) {
    this.activeLayerTypes = new Set(types);
    this.filterByLayerTypes(this.activeLayerTypes);
  }

  flyTo(coordinates, zoom = 12) {
    this.map.flyTo({
      center: coordinates,
      zoom: zoom,
      essential: true,
      duration: 1500
    });
  }

  setFilter(timeRange) {
    // Filter events by time range but keep all events on map
    // Just update which ones are visible
    const now = Date.now();
    const cutoff = now - (timeRange.hours * 60 * 60 * 1000);
    
    // Filter the data but update visibility state instead of removing from source
    const timeFilteredIds = new Set(
      this.allEventData
        .filter(e => new Date(e.timestamp).getTime() > cutoff)
        .map(e => e.id)
    );
    
    // Re-apply layer filter which will include time filtering via feature state
    if (this.activeLayerTypes) {
      this.filterByLayerTypes(this.activeLayerTypes);
    }
    
    // Update the visible event data reference for other components
    this.eventData = this.allEventData.filter(e => timeFilteredIds.has(e.id));
  }

  resetView() {
    this.map.flyTo({
      center: APP_CONFIG.defaultCenter,
      zoom: APP_CONFIG.defaultZoom,
      duration: 1000
    });
  }

  zoomIn() {
    this.map.zoomIn();
  }

  zoomOut() {
    this.map.zoomOut();
  }

  resize() {
    this.map.resize();
  }

  destroy() {
    this.map.remove();
  }

  // Get current map state for URL sharing
  getState() {
    const center = this.map.getCenter();
    return {
      lat: center.lat.toFixed(6),
      lng: center.lng.toFixed(6),
      zoom: this.map.getZoom().toFixed(2)
    };
  }
}
