/**
 * Homs Interactive Map - Main Application Script
 * This script handles all the map functionality, including:
 * - Loading and displaying GeoJSON layers
 * - Handling layer visibility and styling
 * - Interactive filtering
 * - Feature selection
 * - Report generation
 */

// Create a self-executing function to avoid polluting the global namespace
(function() {
    // Map configuration 
    const mapConfig = {
        center: [34.73, 36.68], // Homs, Syria
        zoom: 13,
        minZoom: 10,
        maxZoom: 19,
        extent: {
            xmin: 36.5880878006287,
            ymin: 34.6799548134312,
            xmax: 36.7711339108812,
            ymax: 34.7896548639074
        }
    };
    
    // Available layers configuration - reduced to only show neighborhoods and roads
    const layersConfig = [
        {
            id: "neighborhood",
            name: "الأحياء",
            filename: "data/neighborhood.geojson",
            styleFile: "static/styles/neighborhood_style.json",
            visible: true
        },
        {
            id: "routes",
            name: "الطرق",
            filename: "data/routes.geojson",
            styleFile: "static/styles/routes_style.json",
            visible: true
        }
    ];
    
    // Default style configuration for each layer (will be overridden by MXD styles when available)
    const layerStyles = {
        "neighborhood": {
            fillColor: "#E5F5E0", 
            color: "#31A354",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.7
        },
        "electricity": {
            fillColor: "#FFEDA0", 
            color: "#FEB24C",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        "waste_water": {
            fillColor: "#BFD3E6", 
            color: "#6BAED6",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        "telecom": {
            fillColor: "#EFEDF5", 
            color: "#9E9AC8",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        "housing": {
            fillColor: "#FEE0D2", 
            color: "#FC9272",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        "clean_water": {
            fillColor: "#D1E5F0", 
            color: "#4292C6",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        "swm": {
            fillColor: "#E5F5E0", 
            color: "#41AB5D",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        },
        "routes": {
            color: "#636363",
            weight: 1.5,
            dashArray: "5, 5", 
            opacity: 0.7
        }
    };
    
    // Loaded style information from MXD
    let mxdStyles = {};
    
    // Map and layer globals
    let map;
    let baseMaps;
    let layerControls = {};
    let selectedFeatures = [];
    let selectedLayer = null;
    let activeFilters = {};
    
    // Thematic mapping variables
    let neighborhoodProperties = [];
    let activeThematicProperty = null;
    let activeColorScheme = 'green';
    
    // Advanced filtering variables
    let filterCriteriaCount = 0;
    let advancedFilterCriteria = [];
    let advancedFilterLogic = 'AND';
    
    // Classification variables
    let activeClassificationField = null;
    
    // Default styles for different feature types
    const defaultStyles = {
        Point: {
            radius: 6,
            fillColor: "#ff7800",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        },
        LineString: {
            color: "#3388ff",
            weight: 3,
            opacity: 0.7
        },
        Polygon: {
            fillColor: "#3388ff",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.5
        },
        MultiPolygon: {
            fillColor: "#3388ff",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.5
        },
        MultiLineString: {
            color: "#3388ff",
            weight: 3,
            opacity: 0.7
        },
        default: {
            fillColor: "#808080",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        }
    };
    
    // Initialize the application when DOM is ready
    document.addEventListener('DOMContentLoaded', initializeApp);
    
    /**
     * Initialize the application
     */
    function initializeApp() {
        initializeMap();
        loadMXDStyles()
            .then(() => {
                loadLayers();
                initializeClassification();
                setupEventListeners();
            });
    }
    
    /**
     * Initialize the classification panel
     */
    function initializeClassification() {
        // Disable the apply button initially
        const applyButton = document.getElementById('apply-classification');
        if (applyButton) {
            applyButton.disabled = true;
        }
    }
    
    /**
     * Load MXD style information for layers
     * @return {Promise} Promise that resolves when styles are loaded
     */
    function loadMXDStyles() {
        return new Promise((resolve, reject) => {
            // Try to load each layer's style file
            const stylePromises = layersConfig.map(layerConfig => {
                if (!layerConfig.styleFile) {
                    return Promise.resolve();
                }
                
                return fetch(layerConfig.styleFile)
                    .then(response => {
                        if (!response.ok) {
                            console.warn(`Style file not found for ${layerConfig.id}, using default style`);
                            return null;
                        }
                        return response.json();
                    })
                    .then(styleInfo => {
                        if (styleInfo) {
                            mxdStyles[layerConfig.id] = styleInfo;
                            
                            // Update the default style with the MXD style
                            if (styleInfo.default_style) {
                                layerStyles[layerConfig.id] = {
                                    ...layerStyles[layerConfig.id],
                                    ...styleInfo.default_style
                                };
                            }
                        }
                    })
                    .catch(error => {
                        console.warn(`Error loading style for ${layerConfig.id}:`, error);
                    });
            });
            
            // Wait for all style loads to complete
            Promise.all(stylePromises)
                .then(() => {
                    console.log("MXD styles loaded:", Object.keys(mxdStyles));
                    resolve();
                })
                .catch(reject);
        });
    }
    
    /**
     * Update layer styles from MXD information
     * This is a public function that can be called from the HTML
     * @param {Array} layers - Array of layer configurations
     */
    window.updateLayerStyles = function(layers) {
        if (!layers || !Array.isArray(layers)) {
            console.warn("Invalid layers configuration");
            return;
        }
        
        // Update the style information for each layer
        layers.forEach(layer => {
            const layerId = layer.id;
            if (!layerId) return;
            
            // If we have style info for this layer, update it
            if (layer.style) {
                // Update the layer style
                layerStyles[layerId] = {
                    ...layerStyles[layerId],
                    ...layer.style
                };
                
                // If the layer is already loaded, update its style
                if (layerControls[layerId] && layerControls[layerId].layer) {
                    const geoJSONLayer = layerControls[layerId].layer.getLayers()[0];
                    if (geoJSONLayer) {
                        geoJSONLayer.setStyle(layerStyles[layerId]);
                    }
                }
            }
        });
    }
    
    /**
     * Initialize the Leaflet map
     */
    function initializeMap() {
        // Create the map
        map = L.map('map-container', {
            center: mapConfig.center,
            zoom: mapConfig.zoom,
            minZoom: mapConfig.minZoom,
            maxZoom: mapConfig.maxZoom,
            zoomControl: true
        });
        
        // Set the bounds based on the extent
        const bounds = [
            [mapConfig.extent.ymin, mapConfig.extent.xmin],
            [mapConfig.extent.ymax, mapConfig.extent.xmax]
        ];
        map.fitBounds(bounds);
        
        // Add base layers
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
        
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        });
        
        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
            maxZoom: 17
        });
        
        // Define base map layers
        baseMaps = {
            "OpenStreetMap": osmLayer,
            "Satellite": satelliteLayer,
            "Topographic": topoLayer
        };
        
        // Add print control if the plugin is loaded
        try {
            if (typeof L.control.browserPrint === 'function') {
                L.control.browserPrint({
                    title: 'Print Map',
                    position: 'topleft',
                    printModes: [
                        "Landscape",
                        "Portrait",
                        "Custom"
                    ]
                }).addTo(map);
            } else {
                console.warn("Leaflet print plugin not loaded. Print functionality disabled.");
                
                // Disable the print button
                const printBtn = document.getElementById('print-map-btn');
                if (printBtn) {
                    printBtn.disabled = true;
                    printBtn.title = "Print functionality not available";
                    printBtn.innerHTML = '<i class="fas fa-print"></i> طباعة (غير متوفر)';
                    printBtn.classList.replace('btn-outline-light', 'btn-outline-secondary');
                }
            }
        } catch (error) {
            console.error("Error initializing print control:", error);
        }
    }
    
    /**
     * Load all GeoJSON layers
     */
    function loadLayers() {
        const layerControlDiv = document.getElementById('layer-control');
        if (layerControlDiv) {
            layerControlDiv.innerHTML = ''; // Clear loading indicator
            
            // Add each layer to the control panel
            layersConfig.forEach(layerConfig => {
                // Create layer checkbox UI
                const layerItem = document.createElement('div');
                layerItem.className = 'layer-item';
                
                // Get style color for legend
                const style = layerStyles[layerConfig.id];
                const legendColor = style ? (style.fillColor || style.color || "#3388ff") : "#3388ff";
                
                layerItem.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input layer-checkbox" type="checkbox" 
                               id="layer-${layerConfig.id}" data-layer="${layerConfig.id}" ${layerConfig.visible ? 'checked' : ''}>
                        <span class="layer-legend" style="background-color: ${legendColor};"></span>
                        <label class="form-check-label layer-name" for="layer-${layerConfig.id}">
                            ${layerConfig.name}
                        </label>
                    </div>
                `;
                layerControlDiv.appendChild(layerItem);
                
                // Add event listener to checkbox
                const checkbox = layerItem.querySelector(`#layer-${layerConfig.id}`);
                checkbox.addEventListener('change', function() {
                    const layerId = this.getAttribute('data-layer');
                    toggleLayer(layerId, this.checked);
                });
            });
        }
        
        // Add to layer selector in filter panel if it exists
        const layerSelect = document.getElementById('layer-select');
        if (layerSelect) {
            layersConfig.forEach(layerConfig => {
                const option = document.createElement('option');
                option.value = layerConfig.id;
                option.textContent = layerConfig.name;
                layerSelect.appendChild(option);
            });
        }
        
        // Add to criteria layer selects in advanced filter if they exist
        const criteriaSelectorTemplate = document.getElementById('filter-criteria-template');
        if (criteriaSelectorTemplate) {
            // We'll handle this when criteria are created
        }
        
        // Load visible layers
        layersConfig.forEach(layerConfig => {
            if (layerConfig.visible) {
                loadGeoJSONLayer(layerConfig);
            }
        });
    }
    
    /**
     * Load a GeoJSON layer
     * @param {Object} layerConfig - Configuration for the layer
     */
    function loadGeoJSONLayer(layerConfig) {
        const layerId = layerConfig.id;
        
        // Skip if layer is already loaded
        if (layerControls[layerId]) {
            return;
        }
        
        // Show loading indicator
        updateLoadingStatus(`Loading ${layerConfig.name}...`, true);
        
        // Fetch the GeoJSON data
        fetch(layerConfig.filename)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${layerConfig.filename}`);
                }
                return response.json();
            })
            .then(data => {
                // Create a new layer group
                const geoJSONLayer = L.layerGroup();
                
                // Get the style for this layer
                const layerStyle = layerStyles[layerId] || defaultStyles.default;
                
                // Process the GeoJSON data
                const layer = L.geoJSON(data, {
                    style: feature => {
                        // Determine feature type
                        let featureType = 'default';
                        if (feature.geometry && feature.geometry.type) {
                            featureType = feature.geometry.type;
                        }
                        
                        // Create a new style object
                        let finalStyle = {};
                        
                        // 1. Start with default style for the feature type
                        Object.assign(finalStyle, defaultStyles[featureType] || defaultStyles.default);
                        
                        // 2. Apply the layer style from layers.json (with highest priority for colors)
                        if (layerStyle) {
                            // We forcefully apply the color, fillColor, and opacity values
                            if (layerStyle.color) finalStyle.color = layerStyle.color;
                            if (layerStyle.fillColor) finalStyle.fillColor = layerStyle.fillColor;
                            if (layerStyle.weight) finalStyle.weight = layerStyle.weight;
                            if (layerStyle.opacity !== undefined) finalStyle.opacity = layerStyle.opacity;
                            if (layerStyle.fillOpacity !== undefined) finalStyle.fillOpacity = layerStyle.fillOpacity;
                            if (layerStyle.dashArray) finalStyle.dashArray = layerStyle.dashArray;
                        }
                        
                        // 3. Check for MXD-specific styling (thematic)
                        const mxdStyle = mxdStyles[layerId];
                        if (mxdStyle) {
                            // Check if this is a thematic layer with property-based styling
                            if (mxdStyle.thematic && mxdStyle.thematic_property && mxdStyle.property_styles && feature.properties) {
                                const propStyles = mxdStyle.property_styles[mxdStyle.thematic_property];
                                if (propStyles && propStyles.type === 'range') {
                                    // Get the feature property value
                                    const propValue = parseFloat(feature.properties[mxdStyle.thematic_property]);
                                    
                                    // Find the style for this value
                                    for (const range of propStyles.ranges) {
                                        if (propValue >= range.min && propValue < range.max && range.style) {
                                            // Apply range-specific color and fill values (highest priority)
                                            if (range.style.color) finalStyle.color = range.style.color;
                                            if (range.style.fillColor) finalStyle.fillColor = range.style.fillColor;
                                            if (range.style.weight) finalStyle.weight = range.style.weight;
                                            if (range.style.opacity !== undefined) finalStyle.opacity = range.style.opacity;
                                            if (range.style.fillOpacity !== undefined) finalStyle.fillOpacity = range.style.fillOpacity;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // Apply MXD-specific properties (if not already set)
                            if (mxdStyle.render_properties) {
                                // Apply MXD-specific properties that aren't already set
                                for (const prop in mxdStyle.render_properties) {
                                    // Don't override colors from the layer style
                                    if (prop !== 'color' && prop !== 'fillColor') {
                                        finalStyle[prop] = mxdStyle.render_properties[prop];
                                    }
                                }
                            }
                        }
                        
                        return finalStyle;
                    },
                    pointToLayer: (feature, latlng) => {
                        // Create a new style object for points
                        let pointStyle = {};
                        
                        // 1. Start with default point style
                        Object.assign(pointStyle, defaultStyles.Point);
                        
                        // 2. Apply the layer style from layers.json with highest priority
                        if (layerStyle) {
                            // We forcefully apply the color values
                            if (layerStyle.color) pointStyle.color = layerStyle.color;
                            if (layerStyle.fillColor) pointStyle.fillColor = layerStyle.fillColor;
                            if (layerStyle.radius) pointStyle.radius = layerStyle.radius;
                            if (layerStyle.weight) pointStyle.weight = layerStyle.weight;
                            if (layerStyle.opacity !== undefined) pointStyle.opacity = layerStyle.opacity;
                            if (layerStyle.fillOpacity !== undefined) pointStyle.fillOpacity = layerStyle.fillOpacity;
                        }
                        
                        // 3. Check for MXD-specific styling
                        const mxdStyle = mxdStyles[layerId];
                        if (mxdStyle && feature.properties) {
                            // Check for thematic styling
                            if (mxdStyle.thematic && mxdStyle.thematic_property && mxdStyle.property_styles) {
                                const propStyles = mxdStyle.property_styles[mxdStyle.thematic_property];
                                if (propStyles && propStyles.type === 'range') {
                                    // Get the feature property value
                                    const propValue = parseFloat(feature.properties[mxdStyle.thematic_property]);
                                    
                                    // Find the style for this value
                                    for (const range of propStyles.ranges) {
                                        if (propValue >= range.min && propValue < range.max && range.style) {
                                            // Apply range-specific color values with high priority
                                            if (range.style.color) pointStyle.color = range.style.color;
                                            if (range.style.fillColor) pointStyle.fillColor = range.style.fillColor;
                                            if (range.style.radius) pointStyle.radius = range.style.radius;
                                            if (range.style.weight) pointStyle.weight = range.style.weight;
                                            if (range.style.opacity !== undefined) pointStyle.opacity = range.style.opacity;
                                            if (range.style.fillOpacity !== undefined) pointStyle.fillOpacity = range.style.fillOpacity;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // Apply MXD-specific properties but don't override the colors
                            if (mxdStyle.render_properties) {
                                for (const prop in mxdStyle.render_properties) {
                                    // Don't override colors from the layer style
                                    if (prop !== 'color' && prop !== 'fillColor') {
                                        pointStyle[prop] = mxdStyle.render_properties[prop];
                                    }
                                }
                            }
                        }
                        
                        return L.circleMarker(latlng, pointStyle);
                    },
                    onEachFeature: (feature, layer) => {
                        // Create popup content
                        if (feature.properties) {
                            let popupContent = '<div class="feature-popup">';
                            popupContent += '<h6 class="arabic-text">معلومات المعلم / Feature Properties</h6>';
                            popupContent += '<ul class="feature-properties arabic-text">';
                            
                            // Add Arabic label if available
                            if (feature.properties['arabic_label']) {
                                popupContent += `<li><span class="property-name">الاسم:</span> ${feature.properties['arabic_label']}</li>`;
                            } else if (feature.properties['ADM4_NAME_']) {
                                popupContent += `<li><span class="property-name">الاسم:</span> ${feature.properties['ADM4_NAME_']}</li>`;
                            }
                            
                            // Show service metrics if available
                            if (feature.properties['power'] !== undefined) {
                                popupContent += `<li><span class="property-name">الكهرباء:</span> ${feature.properties['power']}</li>`;
                            }
                            if (feature.properties['SMW'] !== undefined) {
                                popupContent += `<li><span class="property-name">إدارة النفايات الصلبة:</span> ${feature.properties['SMW']}</li>`;
                            }
                            if (feature.properties['waterSupply'] !== undefined) {
                                popupContent += `<li><span class="property-name">مياه الشرب:</span> ${feature.properties['waterSupply']}</li>`;
                            }
                            if (feature.properties['housing'] !== undefined) {
                                popupContent += `<li><span class="property-name">المساكن:</span> ${feature.properties['housing']}</li>`;
                            }
                            if (feature.properties['telecom'] !== undefined) {
                                popupContent += `<li><span class="property-name">الاتصالات:</span> ${feature.properties['telecom']}</li>`;
                            }
                            if (feature.properties['swage'] !== undefined) {
                                popupContent += `<li><span class="property-name">الصرف الصحي:</span> ${feature.properties['swage']}</li>`;
                            }
                            
                            // Show costs if available
                            if (feature.properties['powerCost'] !== undefined) {
                                popupContent += `<li><span class="property-name">تكلفة الكهرباء:</span> ${feature.properties['powerCost']}</li>`;
                            }
                            
                            // Include remaining properties
                            Object.keys(feature.properties).forEach(key => {
                                // Skip properties we've already shown
                                if (key === 'arabic_label' || 
                                    key === 'ADM4_NAME_' ||
                                    key === 'power' || 
                                    key === 'SMW' || 
                                    key === 'waterSupply' || 
                                    key === 'housing' || 
                                    key === 'telecom' || 
                                    key === 'swage' ||
                                    key === 'powerCost' ||
                                    feature.properties[key] === null || 
                                    feature.properties[key] === undefined) {
                                    return;
                                }
                                
                                popupContent += `<li><span class="property-name">${key}:</span> ${feature.properties[key]}</li>`;
                            });
                            
                            popupContent += '</ul>';
                            popupContent += '</div>';
                            
                            layer.bindPopup(popupContent);
                        }
                        
                        // Add click event for selection
                        layer.on({
                            click: e => {
                                L.DomEvent.stopPropagation(e);
                                selectFeature(feature, layer, layerId);
                            }
                        });
                        
                        // Labels are disabled as per user request
                        // Uncomment this block if you want to enable labels again
                        /*
                        if (feature.properties && 
                            (feature.properties['arabic_label'] || 
                             feature.properties['ADM4_NAME_'] || 
                             feature.properties['name'] || 
                             feature.properties['Name'] || 
                             feature.properties['LABEL'] || 
                             feature.properties['label'])) {
                            try {
                                // Get center of the feature
                                const bounds = layer.getBounds();
                                const center = bounds.getCenter();
                                
                                // Create a label using any available label field
                                const labelText = feature.properties['arabic_label'] || 
                                                feature.properties['ADM4_NAME_'] || 
                                                feature.properties['name'] || 
                                                feature.properties['Name'] || 
                                                feature.properties['LABEL'] || 
                                                feature.properties['label'];
                                
                                // Check for MXD label styling
                                let labelStyle = null;
                                if (mxdStyles[layerId] && mxdStyles[layerId].labels) {
                                    labelStyle = mxdStyles[layerId].labels;
                                }
                                
                                createLabel(center, labelText, labelStyle);
                            } catch (e) {
                                console.error("Error creating label:", e);
                            }
                        }
                        */
                    }
                });
                
                // Add the GeoJSON to the layer group
                geoJSONLayer.addLayer(layer);
                
                // Add to map
                geoJSONLayer.addTo(map);
                
                // Store the layer for future reference
                layerControls[layerId] = {
                    layer: geoJSONLayer,
                    config: layerConfig
                };
                
                updateLoadingStatus("", false);
            })
            .catch(error => {
                console.error(`Error loading GeoJSON layer ${layerId}:`, error);
                updateLoadingStatus(`Error loading ${layerConfig.name}`, false);
            });
    }
    
    /**
     * Create a label for a map feature
     * @param {L.LatLng} position - Position for the label
     * @param {string} labelText - Text to display
     * @param {Object} labelStyle - Optional style from MXD
     */
    function createLabel(position, labelText, labelStyle) {
        // Skip if there's no text
        if (!labelText) return;
        
        // Determine if text is Arabic
        const isArabic = /[\u0600-\u06FF]/.test(labelText);
        
        // Default styling
        let fontStyle = "font-family: 'Cairo', sans-serif; font-size: 14px; font-weight: bold;";
        let textColor = "color: #333333;";
        let textShadow = "text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;";
        
        // Apply MXD styling if available
        if (labelStyle) {
            if (labelStyle.font) {
                fontStyle = `font-family: 'Cairo', sans-serif; ${labelStyle.font.replace(/^[^;]*family:[^;]*;?/i, '')};`;
            }
            
            if (labelStyle.color) {
                textColor = `color: ${labelStyle.color};`;
            }
            
            if (labelStyle.haloColor && labelStyle.haloWidth) {
                const width = labelStyle.haloWidth || 2;
                textShadow = `text-shadow: 0px 0px ${width}px ${labelStyle.haloColor}, 0px 0px ${width}px ${labelStyle.haloColor};`;
            }
        }
        
        // Create label HTML with applied styling
        const labelHTML = `
            <span class="arabic-text" style="
                direction: ${isArabic ? 'rtl' : 'ltr'};
                ${fontStyle}
                ${textColor}
                ${textShadow}
                white-space: nowrap;
                display: inline-block;
                padding: 2px 4px;
                border-radius: 3px;
                background-color: rgba(255, 255, 255, 0.5);
            ">${labelText}</span>
        `;
        
        // Create a marker with a custom icon
        const label = L.marker(position, {
            icon: L.divIcon({
                className: 'map-label',
                html: labelHTML,
                iconSize: [200, 40],  // Larger size to accommodate various label lengths
                iconAnchor: [100, 20] // Center anchor point
            }),
            interactive: false, // Make labels non-interactive to avoid interfering with clicks
            pane: 'markerPane' // Place in the marker pane to appear above polygons
        });
        
        // Add to map
        label.addTo(map);
    }
    
    /**
     * Toggle layer visibility
     * @param {string} layerId - ID of the layer to toggle
     * @param {boolean} visible - Whether the layer should be visible
     */
    function toggleLayer(layerId, visible) {
        // Get the layer configuration
        const layerConfig = layersConfig.find(lc => lc.id === layerId);
        
        if (!layerConfig) {
            console.error(`Layer configuration not found for ${layerId}`);
            return;
        }
        
        if (visible) {
            // Check if layer is already loaded
            if (!layerControls[layerId]) {
                loadGeoJSONLayer(layerConfig);
            } else {
                // Just add it to the map
                layerControls[layerId].layer.addTo(map);
            }
        } else if (layerControls[layerId]) {
            // Remove from map
            map.removeLayer(layerControls[layerId].layer);
        }
    }
    
    /**
     * Display a loading status message
     * @param {string} message - Message to display
     * @param {boolean} isLoading - Whether loading is in progress
     */
    function updateLoadingStatus(message, isLoading) {
        const loadingIndicator = document.createElement('div');
        
        if (isLoading) {
            loadingIndicator.innerHTML = `
                <div class="d-flex justify-content-center">
                    <div class="spinner-border text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
                <p class="text-center text-muted mt-2">${message}</p>
            `;
            
            // Append only if not already present
            const existingIndicator = document.querySelector('.loading-indicator');
            if (!existingIndicator) {
                loadingIndicator.className = 'loading-indicator';
                document.body.appendChild(loadingIndicator);
            }
        } else {
            // Remove any existing loading indicator
            const existingIndicator = document.querySelector('.loading-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
        }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Helper function to safely add event listener
        function addSafeEventListener(id, event, handler) {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        }
        
        // Layer selection
        addSafeEventListener('layer-select', 'change', handleLayerSelect);
        
        // Property selection
        addSafeEventListener('property-select', 'change', handlePropertySelect);
        
        // Filter buttons
        addSafeEventListener('apply-filter', 'click', applyFilter);
        addSafeEventListener('clear-filter', 'click', clearFilter);
        
        // Selection
        addSafeEventListener('clear-selection', 'click', clearSelection);
        
        // Report generation
        addSafeEventListener('generate-report-btn', 'click', showReportModal);
        addSafeEventListener('create-report-btn', 'click', generateReport);
        
        // Print button
        addSafeEventListener('print-map-btn', 'click', function() {
            // Check if print plugin is loaded
            const printControl = document.querySelector('.leaflet-control-browser-print a');
            if (printControl) {
                printControl.click();
            } else {
                alert('Print functionality is not available. The print plugin could not be loaded.');
            }
        });
        
        // Thematic mapping
        loadNeighborhoodProperties();
        addSafeEventListener('thematic-property-select', 'change', handleThematicPropertySelect);
        addSafeEventListener('color-scheme-select', 'change', handleColorSchemeSelect);
        addSafeEventListener('apply-thematic', 'click', applyThematicMap);
        addSafeEventListener('reset-thematic', 'click', resetThematicMap);
        
        // Advanced filtering
        addSafeEventListener('quick-search', 'input', handleQuickSearch);
        addSafeEventListener('search-button', 'click', performQuickSearch);
        addSafeEventListener('add-filter-criteria', 'click', addFilterCriteria);
        addSafeEventListener('filter-logic', 'change', handleFilterLogicChange);
        addSafeEventListener('apply-advanced-filter', 'click', applyAdvancedFilter);
        addSafeEventListener('clear-advanced-filter', 'click', clearAdvancedFilter);
        
        // Infrastructure classification
        addSafeEventListener('classification-field-select', 'change', handleClassificationFieldSelect);
        addSafeEventListener('apply-classification', 'click', applyClassification);
        addSafeEventListener('reset-classification', 'click', resetClassification);
        
        // Initialize filter criteria container if it exists
        if (document.getElementById('filter-criteria-container')) {
            initializeAdvancedFiltering();
        }
    }
    
    /**
     * Handle layer selection in filter panel
     */
    function handleLayerSelect() {
        const layerId = this.value;
        const filterPropertiesDiv = document.getElementById('filter-properties');
        const propertySelect = document.getElementById('property-select');
        
        // Reset
        propertySelect.innerHTML = '<option value="">Select a property</option>';
        document.getElementById('filter-controls').classList.add('d-none');
        document.getElementById('apply-filter').disabled = true;
        
        if (!layerId) {
            filterPropertiesDiv.classList.add('d-none');
            return;
        }
        
        filterPropertiesDiv.classList.remove('d-none');
        
        // Get the properties for this layer
        const layerControl = layerControls[layerId];
        if (!layerControl) return;
        
        // First layer in the group should be the GeoJSON
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return;
        
        // Get a feature from the layer to extract properties
        let properties = [];
        try {
            geoJSONLayer.eachLayer(layer => {
                if (layer.feature && layer.feature.properties) {
                    properties = Object.keys(layer.feature.properties);
                    throw new Error('Break'); // Use error to break out of eachLayer
                }
            });
        } catch (e) {
            if (e.message !== 'Break') console.error(e);
        }
        
        // Add properties to select
        properties.forEach(prop => {
            const option = document.createElement('option');
            option.value = prop;
            option.textContent = prop;
            propertySelect.appendChild(option);
        });
    }
    
    /**
     * Handle property selection in filter panel
     */
    function handlePropertySelect() {
        const layerId = document.getElementById('layer-select').value;
        const property = this.value;
        
        const filterControls = document.getElementById('filter-controls');
        const textControl = document.getElementById('filter-text-control');
        const numberControl = document.getElementById('filter-number-control');
        const selectControl = document.getElementById('filter-select-control');
        
        // Reset
        textControl.classList.add('d-none');
        numberControl.classList.add('d-none');
        selectControl.classList.add('d-none');
        document.getElementById('apply-filter').disabled = true;
        
        if (!property) {
            filterControls.classList.add('d-none');
            return;
        }
        
        filterControls.classList.remove('d-none');
        
        // Determine the property type and values
        const propertyType = determinePropertyType(layerId, property);
        
        if (propertyType === 'number') {
            // For numeric properties, show min/max inputs
            numberControl.classList.remove('d-none');
            document.getElementById('apply-filter').disabled = false;
            
            // Retrieve min/max values
            const { min, max } = getPropertyMinMax(layerId, property);
            document.getElementById('filter-min').placeholder = `Min (${min})`;
            document.getElementById('filter-max').placeholder = `Max (${max})`;
        } else if (propertyType === 'categorical') {
            // For categorical properties, show select dropdown
            selectControl.classList.remove('d-none');
            document.getElementById('apply-filter').disabled = false;
            
            // Get unique values
            const values = getPropertyUniqueValues(layerId, property);
            const selectElement = document.getElementById('filter-select');
            
            // Reset the select
            selectElement.innerHTML = '<option value="">All values</option>';
            
            // Add options
            values.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                selectElement.appendChild(option);
            });
        } else {
            // Default to text filter
            textControl.classList.remove('d-none');
            document.getElementById('apply-filter').disabled = false;
        }
    }
    
    /**
     * Determine the type of a property
     * @param {string} layerId - ID of the layer
     * @param {string} property - Property name
     * @returns {string} - Property type ('number', 'categorical', or 'text')
     */
    function determinePropertyType(layerId, property) {
        const layerControl = layerControls[layerId];
        if (!layerControl) return 'text';
        
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return 'text';
        
        let values = [];
        let allNumbers = true;
        
        // Collect values
        geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties && 
                layer.feature.properties[property] !== undefined && 
                layer.feature.properties[property] !== null) {
                
                values.push(layer.feature.properties[property]);
                
                // Check if all values are numbers
                if (isNaN(parseFloat(layer.feature.properties[property]))) {
                    allNumbers = false;
                }
            }
        });
        
        // Get unique values
        const uniqueValues = [...new Set(values)];
        
        // If all values are numbers, return 'number'
        if (allNumbers) {
            return 'number';
        }
        
        // If there are few unique values, treat as categorical
        if (uniqueValues.length <= 10) {
            return 'categorical';
        }
        
        // Default to text
        return 'text';
    }
    
    /**
     * Get minimum and maximum values for a numeric property
     * @param {string} layerId - ID of the layer
     * @param {string} property - Property name
     * @returns {Object} - Object with min and max values
     */
    function getPropertyMinMax(layerId, property) {
        const layerControl = layerControls[layerId];
        if (!layerControl) return { min: 0, max: 0 };
        
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return { min: 0, max: 0 };
        
        let values = [];
        
        // Collect values
        geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties && 
                layer.feature.properties[property] !== undefined && 
                layer.feature.properties[property] !== null) {
                
                const numValue = parseFloat(layer.feature.properties[property]);
                if (!isNaN(numValue)) {
                    values.push(numValue);
                }
            }
        });
        
        // Return min and max
        return {
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }
    
    /**
     * Get unique values for a categorical property
     * @param {string} layerId - ID of the layer
     * @param {string} property - Property name
     * @returns {Array} - Array of unique values
     */
    function getPropertyUniqueValues(layerId, property) {
        const layerControl = layerControls[layerId];
        if (!layerControl) return [];
        
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return [];
        
        let values = [];
        
        // Collect values
        geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties && 
                layer.feature.properties[property] !== undefined && 
                layer.feature.properties[property] !== null) {
                
                values.push(layer.feature.properties[property]);
            }
        });
        
        // Return unique values
        return [...new Set(values)].sort();
    }
    
    /**
     * Apply the current filter
     */
    function applyFilter() {
        const layerId = document.getElementById('layer-select').value;
        const property = document.getElementById('property-select').value;
        
        if (!layerId || !property) return;
        
        const propertyType = determinePropertyType(layerId, property);
        let filterValue;
        
        if (propertyType === 'number') {
            // Get min/max values from inputs
            const minValue = document.getElementById('filter-min').value;
            const maxValue = document.getElementById('filter-max').value;
            
            filterValue = {
                min: minValue === '' ? null : parseFloat(minValue),
                max: maxValue === '' ? null : parseFloat(maxValue)
            };
        } else if (propertyType === 'categorical') {
            // Get selected value
            filterValue = document.getElementById('filter-select').value;
        } else {
            // Get text value
            filterValue = document.getElementById('filter-text').value;
        }
        
        // Store the active filter
        activeFilters[layerId] = {
            property,
            type: propertyType,
            value: filterValue
        };
        
        // Enable clear filter button
        document.getElementById('clear-filter').disabled = false;
        
        // Apply the filter to the layer
        applyFilterToLayer(layerId);
    }
    
    /**
     * Apply a filter to a specific layer
     * @param {string} layerId - ID of the layer to filter
     */
    function applyFilterToLayer(layerId) {
        const filter = activeFilters[layerId];
        if (!filter) return;
        
        const layerControl = layerControls[layerId];
        if (!layerControl) return;
        
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return;
        
        // Apply the filter to each feature
        geoJSONLayer.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                const properties = layer.feature.properties;
                let visible = true;
                
                if (properties[filter.property] === undefined || properties[filter.property] === null) {
                    visible = false;
                } else if (filter.type === 'number') {
                    const value = parseFloat(properties[filter.property]);
                    
                    if (filter.value.min !== null && value < filter.value.min) {
                        visible = false;
                    }
                    if (filter.value.max !== null && value > filter.value.max) {
                        visible = false;
                    }
                } else if (filter.type === 'categorical' && filter.value) {
                    visible = properties[filter.property].toString() === filter.value;
                } else if (filter.type === 'text' && filter.value) {
                    visible = properties[filter.property].toString().toLowerCase().includes(filter.value.toLowerCase());
                }
                
                // Show/hide the feature
                if (visible) {
                    layer.setStyle({ opacity: 1, fillOpacity: 0.7 });
                } else {
                    layer.setStyle({ opacity: 0.2, fillOpacity: 0.1 });
                }
            }
        });
    }
    
    /**
     * Clear the current filter
     */
    function clearFilter() {
        const layerId = document.getElementById('layer-select').value;
        
        if (!layerId) return;
        
        // Remove the filter
        delete activeFilters[layerId];
        
        // Reset the filter controls
        document.getElementById('filter-properties').classList.add('d-none');
        document.getElementById('filter-controls').classList.add('d-none');
        document.getElementById('property-select').innerHTML = '<option value="">Select a property</option>';
        document.getElementById('filter-text').value = '';
        document.getElementById('filter-min').value = '';
        document.getElementById('filter-max').value = '';
        document.getElementById('filter-select').innerHTML = '<option value="">All values</option>';
        
        // Disable buttons
        document.getElementById('apply-filter').disabled = true;
        document.getElementById('clear-filter').disabled = true;
        
        // Reset the layer
        const layerControl = layerControls[layerId];
        if (!layerControl) return;
        
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return;
        
        // Reset all features to visible
        geoJSONLayer.eachLayer(layer => {
            if (layer.setStyle) {
                const style = layerStyles[layerId] || defaultStyles.default;
                layer.setStyle({ ...style, opacity: 1, fillOpacity: style.fillOpacity || 0.7 });
            }
        });
    }
    
    /**
     * Select or deselect a feature
     * @param {Object} feature - GeoJSON feature
     * @param {L.Layer} layer - Leaflet layer
     * @param {string} layerId - ID of the layer
     */
    function selectFeature(feature, layer, layerId) {
        // Toggle selected state
        const featureId = feature.id || JSON.stringify(feature.properties);
        
        // Check if already selected
        const alreadySelected = selectedFeatures.findIndex(f => 
            (f.id && f.id === featureId) || 
            JSON.stringify(f.properties) === JSON.stringify(feature.properties)
        );
        
        if (alreadySelected >= 0) {
            // Deselect the feature - restore original style
            const originalStyle = layerStyles[layerId] || defaultStyles.default;
            layer.setStyle(originalStyle);
            
            // Remove from selected features
            selectedFeatures.splice(alreadySelected, 1);
        } else {
            // Determine highlight style based on feature type
            let highlightStyle = {
                color: '#ffff00',
                fillColor: '#ffff00',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.5
            };
            
            // For line features, just change color and weight
            if (feature.geometry && 
                (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
                highlightStyle = {
                    color: '#ffff00',
                    weight: 5,
                    opacity: 1
                };
            }
            
            // Apply highlight style
            layer.setStyle(highlightStyle);
            
            // Add to selected features
            selectedFeatures.push({
                id: featureId,
                layerId: layerId,
                properties: feature.properties,
                geometry: feature.geometry
            });
            
            // Remember which layer this feature belongs to
            selectedLayer = layerId;
        }
        
        // Update selection info
        updateSelectionInfo();
        
        // Enable/disable clear selection button
        document.getElementById('clear-selection').disabled = selectedFeatures.length === 0;
    }
    
    /**
     * Update selection info display
     */
    function updateSelectionInfo() {
        const selectionInfoDiv = document.getElementById('selection-info');
        
        if (selectedFeatures.length === 0) {
            selectionInfoDiv.innerHTML = '<p class="text-muted text-center">No features selected</p>';
            return;
        }
        
        let infoHtml = `<p><strong>${selectedFeatures.length}</strong> feature(s) selected</p>`;
        
        if (selectedFeatures.length <= 5) {
            infoHtml += '<ul class="list-unstyled">';
            selectedFeatures.forEach(feature => {
                // Find a good property to display as the feature name
                let featureName = feature.id || 'Unnamed feature';
                if (feature.properties) {
                    // Look for common name properties
                    if (feature.properties['arabic_label']) {
                        featureName = feature.properties['arabic_label'];
                    } else if (feature.properties['ADM4_NAME_']) {
                        featureName = feature.properties['ADM4_NAME_'];
                    } else if (feature.properties['name']) {
                        featureName = feature.properties['name'];
                    }
                }
                
                infoHtml += `<li><i class="fas fa-map-marker-alt me-2"></i>${featureName}</li>`;
            });
            infoHtml += '</ul>';
        }
        
        selectionInfoDiv.innerHTML = infoHtml;
        
        // Also update the report modal
        updateReportModal();
    }
    
    /**
     * Clear all selections
     */
    function clearSelection() {
        // Reset all layer styles
        for (const layerId in layerControls) {
            const layerControl = layerControls[layerId];
            const geoJSONLayer = layerControl.layer.getLayers()[0];
            
            if (geoJSONLayer) {
                geoJSONLayer.eachLayer(layer => {
                    if (layer.setStyle) {
                        const style = layerStyles[layerId] || defaultStyles.default;
                        layer.setStyle(style);
                    }
                });
            }
        }
        
        // Clear selected features array
        selectedFeatures = [];
        selectedLayer = null;
        
        // Update UI
        updateSelectionInfo();
        document.getElementById('clear-selection').disabled = true;
    }
    
    /**
     * Show the report modal
     */
    function showReportModal() {
        const reportModal = new bootstrap.Modal(document.getElementById('report-modal'));
        reportModal.show();
        updateReportModal();
    }
    
    /**
     * Update the report modal with selected features
     */
    function updateReportModal() {
        const selectedCount = document.getElementById('selected-count');
        const selectedFeaturesTable = document.getElementById('selected-features-table').querySelector('tbody');
        
        // Update count
        selectedCount.textContent = selectedFeatures.length;
        
        // Update table
        if (selectedFeatures.length === 0) {
            selectedFeaturesTable.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">No features selected</td>
                </tr>
            `;
            return;
        }
        
        selectedFeaturesTable.innerHTML = '';
        selectedFeatures.forEach((feature, index) => {
            // Find a good property to display as the feature name
            let featureName = feature.id || `Feature ${index + 1}`;
            if (feature.properties) {
                if (feature.properties['arabic_label']) {
                    featureName = feature.properties['arabic_label'];
                } else if (feature.properties['ADM4_NAME_']) {
                    featureName = feature.properties['ADM4_NAME_'];
                }
            }
            
            // Create feature properties preview
            let propertiesPreview = 'No properties';
            if (feature.properties) {
                const propEntries = Object.entries(feature.properties);
                if (propEntries.length > 0) {
                    // Show first 3 properties
                    propertiesPreview = propEntries.slice(0, 3).map(([key, value]) => {
                        return `${key}: ${value}`;
                    }).join(', ');
                    
                    if (propEntries.length > 3) {
                        propertiesPreview += `, and ${propEntries.length - 3} more`;
                    }
                }
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${featureName}</td>
                <td>${propertiesPreview}</td>
            `;
            selectedFeaturesTable.appendChild(row);
        });
    }
    
    /**
     * Generate a report
     */
    function generateReport() {
        if (selectedFeatures.length === 0) {
            alert('Please select at least one feature for the report.');
            return;
        }
        
        const title = document.getElementById('report-title').value || 'Map Report';
        const description = document.getElementById('report-description').value || '';
        const includeMap = document.getElementById('include-map').checked;
        
        // Create a report window
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <link href="https://cdn.replit.com/agent/bootstrap-agent-dark-theme.min.css" rel="stylesheet">
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    body {
                        padding: 20px;
                        font-family: 'Cairo', sans-serif;
                    }
                    .report-header {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .report-map {
                        margin: 20px 0;
                        text-align: center;
                    }
                    .report-map img {
                        max-width: 100%;
                        height: auto;
                        border: 1px solid #ddd;
                    }
                    .report-features {
                        margin-top: 30px;
                    }
                    .report-section {
                        margin-bottom: 30px;
                    }
                    .report-footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 0.9em;
                        color: #777;
                    }
                    .arabic {
                        direction: rtl;
                        text-align: right;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="report-header">
                        <h1>${title}</h1>
                        <p>${description}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <div class="report-section">
                        <h2>Selected Features</h2>
                        <p>Number of features: ${selectedFeatures.length}</p>
                        
                        <div class="report-features">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Properties</th>
                                    </tr>
                                </thead>
                                <tbody>
        `);
        
        // Add each selected feature
        selectedFeatures.forEach((feature, index) => {
            // Find a good property to display as the feature name
            let featureName = feature.id || `Feature ${index + 1}`;
            if (feature.properties) {
                if (feature.properties['arabic_label']) {
                    featureName = feature.properties['arabic_label'];
                } else if (feature.properties['ADM4_NAME_']) {
                    featureName = feature.properties['ADM4_NAME_'];
                }
            }
            
            // Display properties
            let propertyRows = '';
            if (feature.properties) {
                for (const [key, value] of Object.entries(feature.properties)) {
                    if (value !== null && value !== undefined) {
                        propertyRows += `<tr><td>${key}</td><td>${value}</td></tr>`;
                    }
                }
            }
            
            reportWindow.document.write(`
                <tr>
                    <td>${index + 1}</td>
                    <td class="arabic">${featureName}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary mb-2" type="button" data-bs-toggle="collapse" data-bs-target="#properties-${index}">
                            Show Properties
                        </button>
                        <div class="collapse" id="properties-${index}">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Property</th>
                                        <th>Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${propertyRows}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `);
        });
        
        // Add map screenshot if requested
        let mapHtml = '';
        if (includeMap) {
            // In a real implementation, we would capture and include the map image here
            mapHtml = `
                <div class="report-section report-map">
                    <h2>Map View</h2>
                    <p class="text-muted">Map screenshot will be included here</p>
                    <!-- <img src="map_screenshot.png" alt="Map Screenshot"> -->
                </div>
            `;
        }
        
        // Finish the report
        reportWindow.document.write(`
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${mapHtml}
                    
                    <div class="report-footer">
                        <p>Generated by Homs Interactive Map on ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
        
        reportWindow.document.close();
        
        // Close the modal
        const reportModal = bootstrap.Modal.getInstance(document.getElementById('report-modal'));
        reportModal.hide();
    }
    
    /**
     * Load neighborhood properties for thematic mapping
     */
    function loadNeighborhoodProperties() {
        // Only load if we have the neighborhood layer
        if (!layerControls['neighborhood'] || !layerControls['neighborhood'].layer) {
            console.warn('Neighborhood layer not loaded yet, will retry in 1 second');
            setTimeout(loadNeighborhoodProperties, 1000);
            return;
        }
        
        const geoJSONLayer = layerControls['neighborhood'].layer.getLayers()[0];
        if (!geoJSONLayer) {
            console.warn('Neighborhood GeoJSON layer not found');
            return;
        }
        
        // Get properties from the first feature
        let firstFeatureProperties = {};
        try {
            geoJSONLayer.eachLayer(layer => {
                if (layer.feature && layer.feature.properties) {
                    firstFeatureProperties = layer.feature.properties;
                    throw new Error('Break'); // Use error to break out of eachLayer
                }
            });
        } catch (e) {
            if (e.message !== 'Break') console.error(e);
        }
        
        // Store the properties and create the thematic property dropdown
        neighborhoodProperties = Object.keys(firstFeatureProperties);
        populateThematicProperties();
        updateColorPreview();
    }
    
    /**
     * Populate the thematic property select with neighborhood properties
     */
    function populateThematicProperties() {
        const select = document.getElementById('thematic-property-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">اختر حقل</option>';
        
        // Add all properties for thematic mapping
        if (neighborhoodProperties && neighborhoodProperties.length) {
            neighborhoodProperties.forEach(prop => {
                const option = document.createElement('option');
                option.value = prop;
                option.textContent = prop;
                select.appendChild(option);
            });
        }
    }
    
    /**
     * Handle thematic property selection
     */
    function handleThematicPropertySelect() {
        activeThematicProperty = this.value;
        
        // Enable/disable the apply button
        document.getElementById('apply-thematic').disabled = !activeThematicProperty;
        
        // Update color preview
        updateColorPreview();
    }
    
    /**
     * Handle color scheme selection
     */
    function handleColorSchemeSelect() {
        activeColorScheme = this.value;
        updateColorPreview();
    }
    
    /**
     * Update the color preview based on selected color scheme
     */
    function updateColorPreview() {
        const colorPreview = document.getElementById('color-preview');
        if (!colorPreview) return;
        
        colorPreview.innerHTML = '';
        
        // Get color array based on selection
        const colors = getColorScheme(activeColorScheme, 5);
        
        // Create a preview element for each color
        colors.forEach(color => {
            const colorBox = document.createElement('div');
            colorBox.style.backgroundColor = color;
            colorBox.style.flex = '1';
            colorBox.style.height = '100%';
            colorPreview.appendChild(colorBox);
        });
    }
    
    /**
     * Get a color scheme array
     * @param {string} scheme - The color scheme name
     * @param {number} bins - Number of color bins
     * @returns {Array} Array of color hex codes
     */
    function getColorScheme(scheme, bins) {
        const colorSchemes = {
            'green': ['#edf8e9', '#c7e9c0', '#a1d99b', '#74c476', '#31a354'],
            'blue': ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd'],
            'red': ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26'],
            'purple': ['#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#756bb1'],
            'orange': ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603']
        };
        
        return colorSchemes[scheme] || colorSchemes['green'];
    }
    
    /**
     * Apply the thematic map to the neighborhood layer
     */
    function applyThematicMap() {
        if (!activeThematicProperty) {
            alert('الرجاء اختيار خاصية للتصنيف الموضوعي');
            return;
        }
        
        const neighborhoodLayer = layerControls['neighborhood'];
        if (!neighborhoodLayer || !neighborhoodLayer.layer) {
            alert('طبقة الأحياء غير متوفرة');
            return;
        }
        
        const geoJSONLayer = neighborhoodLayer.layer.getLayers()[0];
        
        // Get the property type
        const propertyType = determinePropertyType('neighborhood', activeThematicProperty);
        
        // Get the colors
        const colors = getColorScheme(activeColorScheme, 5);
        
        if (propertyType === 'number') {
            // Get the min/max values for the selected property
            const { min, max } = getPropertyMinMax('neighborhood', activeThematicProperty);
            
            // Create a range for each color bin
            const range = max - min;
            const binSize = range / 5;
            const bins = [
                min,
                min + binSize,
                min + binSize * 2,
                min + binSize * 3,
                min + binSize * 4,
                max
            ];
            
            // Apply colors to the features based on numeric values
            geoJSONLayer.setStyle(feature => {
                const value = parseFloat(feature.properties[activeThematicProperty]);
                let color = colors[0]; // Default to lowest bin
                
                // Find which bin this value falls into
                for (let i = 0; i < 5; i++) {
                    if (value >= bins[i] && value <= bins[i + 1]) {
                        color = colors[i];
                        break;
                    }
                }
                
                return {
                    fillColor: color,
                    weight: 1,
                    opacity: 1,
                    color: '#333',
                    fillOpacity: 0.7
                };
            });
            
            // Create a numeric legend
            createNumericLegend(bins, colors, activeThematicProperty);
        } else {
            // For categorical/text properties
            // Get unique values
            const uniqueValues = getPropertyUniqueValues('neighborhood', activeThematicProperty);
            
            // Create a color mapping for unique values (up to 5 colors)
            const colorMap = {};
            uniqueValues.forEach((value, index) => {
                const colorIndex = index % 5; // Cycle through the 5 colors
                colorMap[value] = colors[colorIndex];
            });
            
            // Apply colors to the features based on categorical values
            geoJSONLayer.setStyle(feature => {
                const value = feature.properties[activeThematicProperty];
                const color = colorMap[value] || colors[0]; // Use mapped color or default
                
                return {
                    fillColor: color,
                    weight: 1,
                    opacity: 1,
                    color: '#333',
                    fillOpacity: 0.7
                };
            });
            
            // Create a categorical legend
            createCategoricalLegend(colorMap, activeThematicProperty);
        }
    }
    
    /**
     * Create a numeric legend for the thematic map
     * @param {Array} bins - Array of bin boundary values
     * @param {Array} colors - Array of colors for each bin
     * @param {string} property - The property being displayed
     */
    function createNumericLegend(bins, colors, property) {
        // Remove existing legend if any
        const existingLegend = document.querySelector('.thematic-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Create a new legend
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'info legend thematic-legend');
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.border = '1px solid #ccc';
            div.style.borderRadius = '5px';
            div.style.direction = 'rtl';
            div.style.textAlign = 'right';
            
            // Add legend title
            div.innerHTML = `<strong>${property}</strong><br>`;
            
            // Add color squares and labels
            for (let i = 0; i < 5; i++) {
                const from = bins[i].toFixed(2);
                const to = bins[i + 1].toFixed(2);
                
                div.innerHTML += 
                    `<i style="background:${colors[i]}; width:18px; height:18px; display:inline-block; margin-left:8px; opacity:0.7;"></i> ` +
                    `${from} - ${to}<br>`;
            }
            
            return div;
        };
        
        legend.addTo(map);
    }
    
    /**
     * Create a categorical legend for the thematic map
     * @param {Object} colorMap - Map of values to colors
     * @param {string} property - The property being displayed
     */
    function createCategoricalLegend(colorMap, property) {
        // Remove existing legend if any
        const existingLegend = document.querySelector('.thematic-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Create a new legend
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'info legend thematic-legend');
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.border = '1px solid #ccc';
            div.style.borderRadius = '5px';
            div.style.direction = 'rtl';
            div.style.textAlign = 'right';
            
            // Add legend title
            div.innerHTML = `<strong>${property}</strong><br>`;
            
            // Add color squares and labels for each category
            Object.entries(colorMap).forEach(([value, color]) => {
                div.innerHTML += 
                    `<i style="background:${color}; width:18px; height:18px; display:inline-block; margin-left:8px; opacity:0.7;"></i> ` +
                    `${value}<br>`;
            });
            
            return div;
        };
        
        legend.addTo(map);
    }
    
    /**
     * Reset the thematic map to default style
     */
    function resetThematicMap() {
        const neighborhoodLayer = layerControls['neighborhood'];
        if (!neighborhoodLayer || !neighborhoodLayer.layer) {
            return;
        }
        
        const geoJSONLayer = neighborhoodLayer.layer.getLayers()[0];
        
        // Reset to default style
        geoJSONLayer.setStyle(layerStyles['neighborhood']);
        
        // Remove thematic legend
        const existingLegend = document.querySelector('.thematic-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Reset the property select
        document.getElementById('thematic-property-select').value = '';
        activeThematicProperty = null;
        document.getElementById('apply-thematic').disabled = true;
    }
    
    /* ------ Advanced Filtering Functions ------ */
    
    /**
     * Initialize the advanced filtering UI
     */
    function initializeAdvancedFiltering() {
        // Reset any existing filters
        clearAdvancedFilter();
        
        // Prepare the filter logic panel
        document.getElementById('filter-logic').value = 'AND';
        advancedFilterLogic = 'AND';
    }
    
    /**
     * Handle quick search input changes
     */
    function handleQuickSearch() {
        // Enable/disable search button based on input
        const searchText = document.getElementById('quick-search').value.trim();
        document.getElementById('search-button').disabled = searchText.length === 0;
    }
    
    /**
     * Perform quick search across all visible layers
     */
    function performQuickSearch() {
        const searchText = document.getElementById('quick-search').value.trim().toLowerCase();
        if (!searchText) return;
        
        // Clear any existing selections
        clearSelection();
        
        // Keep track of search results
        let totalFound = 0;
        const searchResults = [];
        
        // Search all visible layers
        Object.entries(layerControls).forEach(([layerId, layerControl]) => {
            // Skip if layer is not visible
            if (!layerControl.visible) return;
            
            const geoJSONLayer = layerControl.layer.getLayers()[0];
            if (!geoJSONLayer) return;
            
            // Search all features in the layer
            geoJSONLayer.eachLayer(layer => {
                if (!layer.feature || !layer.feature.properties) return;
                
                const properties = layer.feature.properties;
                let found = false;
                
                // Check if any property contains the search text
                for (const key in properties) {
                    if (properties[key] !== null && properties[key] !== undefined) {
                        const value = properties[key].toString().toLowerCase();
                        if (value.includes(searchText)) {
                            found = true;
                            break;
                        }
                    }
                }
                
                // If found, add to results and highlight
                if (found) {
                    totalFound++;
                    
                    // Select the feature
                    selectFeature(layer.feature, layer, layerId);
                    
                    // Add to search results
                    searchResults.push({
                        layer: layerId,
                        feature: layer.feature,
                        name: getFeatureName(layer.feature)
                    });
                }
            });
        });
        
        // Show search results message
        if (totalFound > 0) {
            alert(`تم العثور على ${totalFound} نتيجة مطابقة`);
        } else {
            alert('لم يتم العثور على نتائج مطابقة');
        }
    }
    
    /**
     * Get a display name for a feature
     */
    function getFeatureName(feature) {
        if (!feature || !feature.properties) return 'Unknown';
        
        // Try to find a good name property
        if (feature.properties.arabic_label) {
            return feature.properties.arabic_label;
        } else if (feature.properties.ADM4_NAME_) {
            return feature.properties.ADM4_NAME_;
        } else if (feature.properties.name) {
            return feature.properties.name;
        }
        
        // Use ID or first property as fallback
        return feature.id || `معلم ${Object.values(feature.properties)[0]}`;
    }
    
    /**
     * Add a new filter criteria
     */
    function addFilterCriteria() {
        // Create a filter criteria from the template
        const template = document.getElementById('filter-criteria-template');
        const filterCriteriaContainer = document.getElementById('filter-criteria-container');
        
        // Clone the template
        const filterCriteria = document.importNode(template.content, true).querySelector('.filter-criteria');
        
        // Set an ID and update the number
        filterCriteriaCount++;
        filterCriteria.id = `filter-criteria-${filterCriteriaCount}`;
        filterCriteria.querySelector('.filter-number').textContent = `معيار ${filterCriteriaCount}`;
        
        // Add layer options
        const layerSelect = filterCriteria.querySelector('.criteria-layer');
        layersConfig.forEach(layerConfig => {
            const option = document.createElement('option');
            option.value = layerConfig.id;
            option.textContent = layerConfig.name;
            layerSelect.appendChild(option);
        });
        
        // Add event listeners
        layerSelect.addEventListener('change', handleCriteriaLayerSelect);
        filterCriteria.querySelector('.remove-criteria').addEventListener('click', function() {
            removeFilterCriteria(filterCriteria.id);
        });
        
        // Add to container
        filterCriteriaContainer.appendChild(filterCriteria);
        
        // Show the filter logic if we have more than one criteria
        if (filterCriteriaCount > 1) {
            document.getElementById('filter-logic-container').classList.remove('d-none');
        }
        
        // Add initial criteria object
        advancedFilterCriteria.push({
            id: filterCriteria.id,
            layer: '',
            property: '',
            operator: '',
            value: null
        });
        
        // Disable apply button until criteria is complete
        document.getElementById('apply-advanced-filter').disabled = true;
    }
    
    /**
     * Handle layer selection in criteria
     */
    function handleCriteriaLayerSelect() {
        const filterCriteria = this.closest('.filter-criteria');
        const criteriaId = filterCriteria.id;
        const layerId = this.value;
        
        // Update the criteria object
        const criteriaIndex = advancedFilterCriteria.findIndex(c => c.id === criteriaId);
        if (criteriaIndex !== -1) {
            advancedFilterCriteria[criteriaIndex].layer = layerId;
            advancedFilterCriteria[criteriaIndex].property = '';
            advancedFilterCriteria[criteriaIndex].operator = '';
            advancedFilterCriteria[criteriaIndex].value = null;
        }
        
        // Update property select
        const propertyContainer = filterCriteria.querySelector('.criteria-property-container');
        const propertySelect = filterCriteria.querySelector('.criteria-property');
        const operatorContainer = filterCriteria.querySelector('.criteria-operator-container');
        const valueContainer = filterCriteria.querySelector('.criteria-value-container');
        
        // Reset
        propertySelect.innerHTML = '<option value="">اختر خاصية</option>';
        operatorContainer.classList.add('d-none');
        valueContainer.classList.add('d-none');
        valueContainer.innerHTML = '';
        
        if (!layerId) {
            propertyContainer.classList.add('d-none');
            return;
        }
        
        // Show property container
        propertyContainer.classList.remove('d-none');
        
        // Get properties from the layer
        const layerControl = layerControls[layerId];
        if (!layerControl) return;
        
        const geoJSONLayer = layerControl.layer.getLayers()[0];
        if (!geoJSONLayer) return;
        
        // Get a feature from the layer to extract properties
        let properties = [];
        try {
            geoJSONLayer.eachLayer(layer => {
                if (layer.feature && layer.feature.properties) {
                    properties = Object.keys(layer.feature.properties);
                    throw new Error('Break'); // Use error to break out of eachLayer
                }
            });
        } catch (e) {
            if (e.message !== 'Break') console.error(e);
        }
        
        // Add properties to select
        properties.forEach(prop => {
            const option = document.createElement('option');
            option.value = prop;
            option.textContent = prop;
            propertySelect.appendChild(option);
        });
        
        // Add event listener to property select
        propertySelect.addEventListener('change', function() {
            handleCriteriaPropertySelect.call(this, criteriaId);
        });
        
        // Check if all criteria are valid
        checkAdvancedFilterCriteria();
    }
    
    /**
     * Handle property selection in criteria
     */
    function handleCriteriaPropertySelect(criteriaId) {
        const filterCriteria = this.closest('.filter-criteria');
        const property = this.value;
        const layerId = filterCriteria.querySelector('.criteria-layer').value;
        
        // Update the criteria object
        const criteriaIndex = advancedFilterCriteria.findIndex(c => c.id === criteriaId);
        if (criteriaIndex !== -1) {
            advancedFilterCriteria[criteriaIndex].property = property;
            advancedFilterCriteria[criteriaIndex].operator = '';
            advancedFilterCriteria[criteriaIndex].value = null;
        }
        
        // Update operator select
        const operatorContainer = filterCriteria.querySelector('.criteria-operator-container');
        const operatorSelect = filterCriteria.querySelector('.criteria-operator');
        const valueContainer = filterCriteria.querySelector('.criteria-value-container');
        
        // Reset
        operatorSelect.innerHTML = '';
        valueContainer.classList.add('d-none');
        valueContainer.innerHTML = '';
        
        if (!property) {
            operatorContainer.classList.add('d-none');
            return;
        }
        
        // Show operator container
        operatorContainer.classList.remove('d-none');
        
        // Determine property type to show appropriate operators
        const propertyType = determinePropertyType(layerId, property);
        
        // Add operators based on property type
        if (propertyType === 'number') {
            // Numeric operators
            const operators = [
                { value: 'eq', text: 'مساوي لـ (=)' },
                { value: 'ne', text: 'غير مساوي لـ (≠)' },
                { value: 'gt', text: 'أكبر من (>)' },
                { value: 'lt', text: 'أصغر من (<)' },
                { value: 'gte', text: 'أكبر من أو يساوي (≥)' },
                { value: 'lte', text: 'أصغر من أو يساوي (≤)' },
                { value: 'between', text: 'بين قيمتين' }
            ];
            
            operators.forEach(op => {
                const option = document.createElement('option');
                option.value = op.value;
                option.textContent = op.text;
                operatorSelect.appendChild(option);
            });
        } else if (propertyType === 'categorical') {
            // Categorical operators
            const operators = [
                { value: 'eq', text: 'مساوي لـ (=)' },
                { value: 'ne', text: 'غير مساوي لـ (≠)' },
                { value: 'in', text: 'موجود في مجموعة' }
            ];
            
            operators.forEach(op => {
                const option = document.createElement('option');
                option.value = op.value;
                option.textContent = op.text;
                operatorSelect.appendChild(option);
            });
        } else {
            // Text operators
            const operators = [
                { value: 'eq', text: 'مساوي لـ (=)' },
                { value: 'ne', text: 'غير مساوي لـ (≠)' },
                { value: 'contains', text: 'يحتوي على' },
                { value: 'startswith', text: 'يبدأ بـ' },
                { value: 'endswith', text: 'ينتهي بـ' }
            ];
            
            operators.forEach(op => {
                const option = document.createElement('option');
                option.value = op.value;
                option.textContent = op.text;
                operatorSelect.appendChild(option);
            });
        }
        
        // Add event listener to operator select
        operatorSelect.addEventListener('change', function() {
            handleCriteriaOperatorSelect.call(this, criteriaId, propertyType);
        });
        
        // Check if all criteria are valid
        checkAdvancedFilterCriteria();
    }
    
    /**
     * Handle operator selection in criteria
     */
    function handleCriteriaOperatorSelect(criteriaId, propertyType) {
        const filterCriteria = this.closest('.filter-criteria');
        const operator = this.value;
        const layerId = filterCriteria.querySelector('.criteria-layer').value;
        const property = filterCriteria.querySelector('.criteria-property').value;
        
        // Update the criteria object
        const criteriaIndex = advancedFilterCriteria.findIndex(c => c.id === criteriaId);
        if (criteriaIndex !== -1) {
            advancedFilterCriteria[criteriaIndex].operator = operator;
            advancedFilterCriteria[criteriaIndex].value = null;
        }
        
        // Update value container
        const valueContainer = filterCriteria.querySelector('.criteria-value-container');
        
        // Reset
        valueContainer.innerHTML = '';
        
        if (!operator) {
            valueContainer.classList.add('d-none');
            return;
        }
        
        // Show value container
        valueContainer.classList.remove('d-none');
        
        // Create value inputs based on operator and property type
        if (propertyType === 'number') {
            if (operator === 'between') {
                // Two inputs for between operator
                valueContainer.innerHTML = `
                    <div class="row g-2 mb-2">
                        <div class="col">
                            <label class="form-label arabic-text small">من:</label>
                            <input type="number" class="form-control form-control-sm criteria-value-min" placeholder="القيمة الدنيا">
                        </div>
                        <div class="col">
                            <label class="form-label arabic-text small">إلى:</label>
                            <input type="number" class="form-control form-control-sm criteria-value-max" placeholder="القيمة العليا">
                        </div>
                    </div>
                `;
                
                // Add event listeners
                const minInput = valueContainer.querySelector('.criteria-value-min');
                const maxInput = valueContainer.querySelector('.criteria-value-max');
                
                minInput.addEventListener('input', function() {
                    if (criteriaIndex !== -1) {
                        advancedFilterCriteria[criteriaIndex].value = {
                            min: this.value === '' ? null : parseFloat(this.value),
                            max: maxInput.value === '' ? null : parseFloat(maxInput.value)
                        };
                        checkAdvancedFilterCriteria();
                    }
                });
                
                maxInput.addEventListener('input', function() {
                    if (criteriaIndex !== -1) {
                        advancedFilterCriteria[criteriaIndex].value = {
                            min: minInput.value === '' ? null : parseFloat(minInput.value),
                            max: this.value === '' ? null : parseFloat(this.value)
                        };
                        checkAdvancedFilterCriteria();
                    }
                });
            } else {
                // Single input for other numeric operators
                valueContainer.innerHTML = `
                    <div class="mb-2">
                        <label class="form-label arabic-text small">القيمة:</label>
                        <input type="number" class="form-control form-control-sm criteria-value-single" placeholder="أدخل قيمة">
                    </div>
                `;
                
                // Add event listener
                valueContainer.querySelector('.criteria-value-single').addEventListener('input', function() {
                    if (criteriaIndex !== -1) {
                        advancedFilterCriteria[criteriaIndex].value = this.value === '' ? null : parseFloat(this.value);
                        checkAdvancedFilterCriteria();
                    }
                });
            }
        } else if (propertyType === 'categorical') {
            if (operator === 'in') {
                // Multi-select for 'in' operator
                const values = getPropertyUniqueValues(layerId, property);
                
                valueContainer.innerHTML = `
                    <div class="mb-2">
                        <label class="form-label arabic-text small">القيم:</label>
                        <select class="form-select form-select-sm criteria-value-multi" multiple size="4">
                            ${values.map(value => `<option value="${value}">${value}</option>`).join('')}
                        </select>
                        <small class="text-muted">اضغط CTRL لاختيار قيم متعددة</small>
                    </div>
                `;
                
                // Add event listener
                valueContainer.querySelector('.criteria-value-multi').addEventListener('change', function() {
                    if (criteriaIndex !== -1) {
                        const selectedValues = Array.from(this.selectedOptions).map(option => option.value);
                        advancedFilterCriteria[criteriaIndex].value = selectedValues.length > 0 ? selectedValues : null;
                        checkAdvancedFilterCriteria();
                    }
                });
            } else {
                // Single select for other categorical operators
                const values = getPropertyUniqueValues(layerId, property);
                
                valueContainer.innerHTML = `
                    <div class="mb-2">
                        <label class="form-label arabic-text small">القيمة:</label>
                        <select class="form-select form-select-sm criteria-value-single">
                            <option value="">اختر قيمة</option>
                            ${values.map(value => `<option value="${value}">${value}</option>`).join('')}
                        </select>
                    </div>
                `;
                
                // Add event listener
                valueContainer.querySelector('.criteria-value-single').addEventListener('change', function() {
                    if (criteriaIndex !== -1) {
                        advancedFilterCriteria[criteriaIndex].value = this.value === '' ? null : this.value;
                        checkAdvancedFilterCriteria();
                    }
                });
            }
        } else {
            // Text input for text operators
            valueContainer.innerHTML = `
                <div class="mb-2">
                    <label class="form-label arabic-text small">القيمة:</label>
                    <input type="text" class="form-control form-control-sm criteria-value-text" placeholder="أدخل نص">
                </div>
            `;
            
            // Add event listener
            valueContainer.querySelector('.criteria-value-text').addEventListener('input', function() {
                if (criteriaIndex !== -1) {
                    advancedFilterCriteria[criteriaIndex].value = this.value === '' ? null : this.value;
                    checkAdvancedFilterCriteria();
                }
            });
        }
        
        // Check if all criteria are valid
        checkAdvancedFilterCriteria();
    }
    
    /**
     * Remove a filter criteria
     */
    function removeFilterCriteria(criteriaId) {
        // Remove the criteria element
        const filterCriteria = document.getElementById(criteriaId);
        if (filterCriteria) {
            filterCriteria.remove();
        }
        
        // Remove the criteria from the array
        const criteriaIndex = advancedFilterCriteria.findIndex(c => c.id === criteriaId);
        if (criteriaIndex !== -1) {
            advancedFilterCriteria.splice(criteriaIndex, 1);
        }
        
        // Update filter criteria numbers
        const criteriaList = document.querySelectorAll('.filter-criteria');
        criteriaList.forEach((criteria, index) => {
            criteria.querySelector('.filter-number').textContent = `معيار ${index + 1}`;
        });
        
        // Hide the filter logic if we have only one criteria
        if (criteriaList.length <= 1) {
            document.getElementById('filter-logic-container').classList.add('d-none');
        }
        
        // Update filter criteria count
        filterCriteriaCount = criteriaList.length;
        
        // Check if all criteria are valid
        checkAdvancedFilterCriteria();
    }
    
    /**
     * Handle filter logic change
     */
    function handleFilterLogicChange() {
        advancedFilterLogic = this.value;
    }
    
    /**
     * Check if all advanced filter criteria are valid
     */
    function checkAdvancedFilterCriteria() {
        let allValid = true;
        
        // Check each criteria
        advancedFilterCriteria.forEach(criteria => {
            if (!criteria.layer || !criteria.property || !criteria.operator || criteria.value === null) {
                allValid = false;
            }
        });
        
        // Enable/disable apply button
        document.getElementById('apply-advanced-filter').disabled = !allValid || advancedFilterCriteria.length === 0;
    }
    
    /**
     * Apply advanced filter
     */
    function applyAdvancedFilter() {
        // Make sure we have valid criteria
        if (advancedFilterCriteria.length === 0) {
            alert('الرجاء إضافة معيار تصفية واحد على الأقل');
            return;
        }
        
        // Apply filter to all layers
        Object.entries(layerControls).forEach(([layerId, layerControl]) => {
            // Skip if layer is not visible
            if (!layerControl.visible) return;
            
            const geoJSONLayer = layerControl.layer.getLayers()[0];
            if (!geoJSONLayer) return;
            
            // Apply filter to each feature
            geoJSONLayer.eachLayer(layer => {
                if (!layer.feature || !layer.feature.properties) return;
                
                const properties = layer.feature.properties;
                let visible = true;
                
                // Check each criteria
                const criteriaResults = advancedFilterCriteria.map(criteria => {
                    // Skip criteria that don't apply to this layer
                    if (criteria.layer !== layerId) return true;
                    
                    // Check the property exists
                    if (properties[criteria.property] === undefined || properties[criteria.property] === null) {
                        return false;
                    }
                    
                    // Get the property value and type
                    const value = properties[criteria.property];
                    const propertyType = determinePropertyType(layerId, criteria.property);
                    
                    // Evaluate the criteria
                    switch (criteria.operator) {
                        case 'eq':
                            return propertyType === 'number' ? 
                                parseFloat(value) === criteria.value : 
                                value.toString() === criteria.value.toString();
                        case 'ne':
                            return propertyType === 'number' ? 
                                parseFloat(value) !== criteria.value : 
                                value.toString() !== criteria.value.toString();
                        case 'gt':
                            return parseFloat(value) > criteria.value;
                        case 'lt':
                            return parseFloat(value) < criteria.value;
                        case 'gte':
                            return parseFloat(value) >= criteria.value;
                        case 'lte':
                            return parseFloat(value) <= criteria.value;
                        case 'between':
                            const numValue = parseFloat(value);
                            return (criteria.value.min === null || numValue >= criteria.value.min) && 
                                   (criteria.value.max === null || numValue <= criteria.value.max);
                        case 'contains':
                            return value.toString().includes(criteria.value);
                        case 'startswith':
                            return value.toString().startsWith(criteria.value);
                        case 'endswith':
                            return value.toString().endsWith(criteria.value);
                        case 'in':
                            return criteria.value.includes(value.toString());
                        default:
                            return true;
                    }
                });
                
                // Determine if the feature should be visible based on the filter logic
                if (advancedFilterLogic === 'AND') {
                    visible = criteriaResults.every(result => result);
                } else {
                    visible = criteriaResults.some(result => result);
                }
                
                // Show/hide the feature
                if (visible) {
                    layer.setStyle({ opacity: 1, fillOpacity: 0.7 });
                } else {
                    layer.setStyle({ opacity: 0.2, fillOpacity: 0.1 });
                }
            });
        });
    }
    
    /**
     * Clear advanced filter
     */
    function clearAdvancedFilter() {
        // Reset filter criteria
        advancedFilterCriteria = [];
        filterCriteriaCount = 0;
        
        // Clear the filter criteria container
        document.getElementById('filter-criteria-container').innerHTML = '';
        
        // Hide the filter logic
        document.getElementById('filter-logic-container').classList.add('d-none');
        
        // Disable the apply button
        document.getElementById('apply-advanced-filter').disabled = true;
        
        // Reset quick search
        document.getElementById('quick-search').value = '';
        document.getElementById('search-button').disabled = true;
        
        // Reset all layers to visible
        Object.entries(layerControls).forEach(([layerId, layerControl]) => {
            // Skip if layer is not visible
            if (!layerControl.visible) return;
            
            const geoJSONLayer = layerControl.layer.getLayers()[0];
            if (!geoJSONLayer) return;
            
            // Reset all features to visible
            geoJSONLayer.eachLayer(layer => {
                if (layer.setStyle) {
                    const style = layerStyles[layerId] || defaultStyles.default;
                    layer.setStyle({ ...style, opacity: 1, fillOpacity: style.fillOpacity || 0.7 });
                }
            });
        });
    }
    
    /* ------ Infrastructure Classification Functions ------ */
    
    /**
     * Handle classification field selection
     */
    function handleClassificationFieldSelect() {
        const field = this.value;
        const legendContainer = document.getElementById('classification-legend-container');
        const applyButton = document.getElementById('apply-classification');
        
        if (!legendContainer) return;
        
        // Reset legend container
        legendContainer.innerHTML = '';
        
        // Disable apply button if no field selected
        if (applyButton) {
            applyButton.disabled = !field;
        }
        
        if (!field) {
            legendContainer.innerHTML = '<p class="text-muted text-center arabic-text">اختر حقل التصنيف لعرض تفاصيله</p>';
            return;
        }
        
        // Show legend for selected field
        legendContainer.innerHTML = generateClassificationLegend(field);
    }
    
    /**
     * Apply classification to the neighborhood layer
     */
    function applyClassification() {
        const fieldSelect = document.getElementById('classification-field-select');
        if (!fieldSelect) return;
        
        const field = fieldSelect.value;
        
        if (!field) {
            alert('الرجاء اختيار حقل للتصنيف');
            return;
        }
        
        // Set active classification field
        activeClassificationField = field;
        
        // Get the neighborhood layer
        const neighborhoodLayer = layerControls['neighborhood'];
        if (!neighborhoodLayer || !neighborhoodLayer.layer) {
            alert('طبقة الأحياء غير متوفرة');
            return;
        }
        
        const geoJSONLayer = neighborhoodLayer.layer.getLayers()[0];
        if (!geoJSONLayer) {
            console.error('GeoJSON layer not found');
            return;
        }
        
        // Log some debugging info
        console.log(`Applying classification for field: ${field}`);
        
        try {
            // Apply classification style to each feature
            geoJSONLayer.setStyle(feature => {
                // Create a completely new style object to avoid references to old styles
                return applyClassificationStyle(feature, field);
            });
            
            // Force redraw by toggling layer visibility
            map.removeLayer(neighborhoodLayer.layer);
            map.addLayer(neighborhoodLayer.layer);
            
            console.log('Classification applied successfully');
        } catch (error) {
            console.error('Error applying classification:', error);
        }
        
        // Add classification legend to map
        addClassificationLegendToMap(field);
    }
    
    /**
     * Add classification legend to map
     * @param {string} field - Field to show legend for
     */
    function addClassificationLegendToMap(field) {
        if (!map) return;
        
        // Remove existing legend if any
        const existingLegend = document.querySelector('.map-classification-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Create legend control
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'map-classification-legend info');
            
            const html = generateClassificationLegend(field);
            div.innerHTML = html;
            
            // Add some styling specific to map legend
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '5px';
            div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
            
            return div;
        };
        
        legend.addTo(map);
    }
    
    /**
     * Reset classification to default styles
     */
    function resetClassification() {
        // Reset active classification field
        activeClassificationField = null;
        
        // Reset the field select
        const fieldSelect = document.getElementById('classification-field-select');
        const legendContainer = document.getElementById('classification-legend-container');
        const applyButton = document.getElementById('apply-classification');
        
        if (fieldSelect) {
            fieldSelect.value = '';
        }
        
        // Reset legend container
        if (legendContainer) {
            legendContainer.innerHTML = '<p class="text-muted text-center arabic-text">اختر حقل التصنيف لعرض تفاصيله</p>';
        }
        
        // Get the neighborhood layer
        const neighborhoodLayer = layerControls['neighborhood'];
        if (!neighborhoodLayer || !neighborhoodLayer.layer) {
            return;
        }
        
        const geoJSONLayer = neighborhoodLayer.layer.getLayers()[0];
        if (!geoJSONLayer) {
            console.error('GeoJSON layer not found');
            return;
        }
        
        try {
            console.log('Resetting classification styles');
            
            // Reset to default style - create a new style object to avoid reference issues
            const defaultStyle = { ...layerStyles['neighborhood'] };
            geoJSONLayer.setStyle(defaultStyle);
            
            // Force redraw by toggling layer visibility
            map.removeLayer(neighborhoodLayer.layer);
            map.addLayer(neighborhoodLayer.layer);
            
            console.log('Classification reset successfully');
        } catch (error) {
            console.error('Error resetting classification:', error);
        }
        
        // Remove map legend
        const mapLegend = document.querySelector('.map-classification-legend');
        if (mapLegend) {
            mapLegend.remove();
        }
        
        // Disable apply button
        if (applyButton) {
            applyButton.disabled = true;
        }
    }
})();