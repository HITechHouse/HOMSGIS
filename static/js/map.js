// Main map initialization and management
document.addEventListener('DOMContentLoaded', function() {
    // Get map info from the backend
    let mapInfo = {
        title: "Homs Map",
        description: "Map of Homs, Syria",
        extent: {
            xmin: 36.5880878006287,
            ymin: 34.6799548134312,
            xmax: 36.7711339108812,
            ymax: 34.7896548639074
        },
        spatialReference: "GCS_WGS_1984"
    };

    // Calculate the center of the map from the extent
    const center = [
        (mapInfo.extent.ymin + mapInfo.extent.ymax) / 2,
        (mapInfo.extent.xmin + mapInfo.extent.xmax) / 2
    ];

    // Initialize the map
    const map = L.map('map-container', {
        center: center,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
    });

    // Set the bounds of the map based on the extent
    const bounds = [
        [mapInfo.extent.ymin, mapInfo.extent.xmin],
        [mapInfo.extent.ymax, mapInfo.extent.xmax]
    ];
    map.fitBounds(bounds);

    // Add base maps
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        maxZoom: 17
    });

    // Add base layers to map
    osmLayer.addTo(map);

    // Base map control
    const baseMaps = {
        "OpenStreetMap": osmLayer,
        "Satellite": satelliteLayer,
        "Topographic": topoLayer
    };

    // Create layer groups for overlays
    const overlayMaps = {};
    const layerControls = {};
    const layerStyles = {};
    
    // Fetch map info from the server
    fetch('/api/map-info')
        .then(response => response.json())
        .then(data => {
            mapInfo = data;
            
            // Update map bounds if needed
            const newBounds = [
                [mapInfo.extent.ymin, mapInfo.extent.xmin],
                [mapInfo.extent.ymax, mapInfo.extent.xmax]
            ];
            map.fitBounds(newBounds);
            
            // Update page title if needed
            if (mapInfo.title) {
                document.title = `${mapInfo.title} - Interactive Map`;
            }
        })
        .catch(error => {
            console.error('Error fetching map info:', error);
        });

    // Default style for different feature types
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
        default: {
            fillColor: "#808080",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        }
    };

    // Random color generator for layers
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Add print control
    L.control.browserPrint({
        title: 'Print Map',
        position: 'topleft',
        printModes: [
            "Landscape",
            "Portrait",
            "Custom"
        ]
    }).addTo(map);

    // Link print button in navbar to the Leaflet print control
    document.getElementById('print-map-btn').addEventListener('click', function() {
        // Trigger click on the Leaflet print control
        document.querySelector('.leaflet-control-browser-print a').click();
    });

    // Selection handling
    let selectedFeatures = [];
    let selectedLayer = null;

    // Fetch available GeoJSON layers
    fetch('/api/geojson-layers')
        .then(response => response.json())
        .then(layers => {
            const layerControlDiv = document.getElementById('layer-control');
            
            if (layers.length === 0) {
                layerControlDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        No GeoJSON layers found. Please place your GeoJSON files in the static/data directory.
                    </div>
                `;
                return;
            }

            // Clear loading indicator
            layerControlDiv.innerHTML = '';
            
            // First load all the style information for each layer
            const stylePromises = layers.map(layer => 
                fetch(`/api/layer-style/${layer.id}`)
                    .then(res => res.json())
                    .then(styleInfo => {
                        // Store the style information
                        return { layer, styleInfo };
                    })
                    .catch(() => {
                        // Generate a fallback color if style fetch fails
                        const layerColor = getRandomColor();
                        return { 
                            layer, 
                            styleInfo: {
                                type: "default",
                                default_style: {
                                    color: layerColor,
                                    fillColor: layerColor,
                                    weight: 2,
                                    opacity: 0.7,
                                    fillOpacity: 0.5
                                }
                            } 
                        };
                    })
            );
            
            // Process all layers after we have their styles
            Promise.all(stylePromises)
                .then(layersWithStyles => {
                    // Add layers to the map
                    layersWithStyles.forEach(({ layer, styleInfo }, index) => {
                        // Determine a color for the layer legend
                        let legendColor;
                        
                        if (styleInfo && styleInfo.default_style) {
                            // Use fillColor for polygons and color for lines
                            if (styleInfo.geometry_type === 'Polygon' || styleInfo.geometry_type === 'MultiPolygon') {
                                legendColor = styleInfo.default_style.fillColor || "#3388ff";
                            } else {
                                legendColor = styleInfo.default_style.color || "#ff7800";
                            }
                        } else {
                            // Fallback to a random color
                            legendColor = getRandomColor();
                        }
                        
                        // Store the style for this layer
                        layerStyles[layer.id] = {
                            ...(styleInfo.default_style || {}),
                            originalStyleInfo: styleInfo  // Store complete style info
                        };

                        // Create layer checkbox UI
                        const layerItem = document.createElement('div');
                        layerItem.className = 'layer-item';
                        layerItem.innerHTML = `
                            <div class="form-check">
                                <input class="form-check-input layer-checkbox" type="checkbox" 
                                       id="layer-${layer.id}" data-layer="${layer.id}">
                                <span class="layer-legend" style="background-color: ${legendColor};"></span>
                                <label class="form-check-label layer-name" for="layer-${layer.id}">
                                    ${layer.name} 
                                    <small class="text-muted">(${layer.feature_count} features)</small>
                                </label>
                            </div>
                        `;
                        layerControlDiv.appendChild(layerItem);

                        // Add to layer selector in filter panel
                        const layerSelect = document.getElementById('layer-select');
                        const option = document.createElement('option');
                        option.value = layer.id;
                        option.textContent = layer.name;
                        layerSelect.appendChild(option);

                        // Add event listener
                        const checkbox = layerItem.querySelector(`#layer-${layer.id}`);
                        checkbox.addEventListener('change', function() {
                            const layerId = this.getAttribute('data-layer');
                            toggleLayer(layerId, this.checked);
                        });

                        // Load all layers by default
                        checkbox.checked = true;
                        toggleLayer(layer.id, true);
                    });
                });
        })
        .catch(error => {
            console.error('Error fetching GeoJSON layers:', error);
            document.getElementById('layer-control').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error loading map layers. Please try refreshing the page.
                </div>
            `;
        });

    // Function to toggle layer visibility
    function toggleLayer(layerId, visible) {
        if (visible) {
            // Check if the layer is already loaded
            if (!layerControls[layerId]) {
                loadGeoJSONLayer(layerId);
            } else if (!map.hasLayer(layerControls[layerId])) {
                map.addLayer(layerControls[layerId]);
            }
        } else if (layerControls[layerId] && map.hasLayer(layerControls[layerId])) {
            map.removeLayer(layerControls[layerId]);
        }
    }

    // Load GeoJSON layer data
    function loadGeoJSONLayer(layerId) {
        // First, try to get style information for this layer
        Promise.all([
            fetch(`/api/geojson/${layerId}.geojson`).then(res => res.json()),
            fetch(`/api/layer-style/${layerId}`).then(res => res.json()).catch(() => null),
            fetch(`/api/layer-properties/${layerId}`).then(res => res.json()).catch(() => null)
        ])
        .then(([data, styleInfo, propertyInfo]) => {
            // Create a new layer group for this GeoJSON
            const geoJSONLayer = L.layerGroup();
            
            // Store the original random color
            if (!layerStyles[layerId]) {
                layerStyles[layerId] = {
                    color: getRandomColor(),
                    fillColor: getRandomColor(),
                    weight: 2,
                    opacity: 0.7,
                    fillOpacity: 0.5
                };
            }
            
            // Determine if we should use style information from the MPK file
            const useOriginalStyle = styleInfo && 
                  (styleInfo.property_styles || styleInfo.default_style);
                  
            // Determine if we should add labels
            const addLabels = styleInfo && styleInfo.labels && styleInfo.labels.fields && 
                              styleInfo.labels.fields.length > 0;
            
            // Initialize a label overlay if needed
            let labelLayer = null;
            if (addLabels) {
                labelLayer = L.layerGroup();
            }
            
            // Add the GeoJSON to the layer group with styling
            const layer = L.geoJSON(data, {
                style: function(feature) {
                    // Determine feature type
                    let featureType = 'default';
                    if (feature.geometry && feature.geometry.type) {
                        featureType = feature.geometry.type;
                    }
                    
                    // Start with default styles for the feature type
                    let style = {
                        ...defaultStyles[featureType] || defaultStyles.default
                    };
                    
                    // If we have original style information, use it
                    if (useOriginalStyle) {
                        // Apply default style from the MPK
                        if (styleInfo.default_style) {
                            style = {
                                ...style,
                                ...styleInfo.default_style
                            };
                        }
                        
                        // Apply property-based styling if available
                        if (styleInfo.property_styles && feature.properties) {
                            for (const [property, propertyStyle] of Object.entries(styleInfo.property_styles)) {
                                if (feature.properties[property] !== undefined &&
                                    propertyStyle.values && 
                                    propertyStyle.values[feature.properties[property]]) {
                                    
                                    style = {
                                        ...style,
                                        ...propertyStyle.values[feature.properties[property]]
                                    };
                                }
                            }
                        }
                    } else {
                        // Use standard random color if no original style
                        style.color = layerStyles[layerId].color;
                        style.fillColor = layerStyles[layerId].fillColor;
                    }
                    
                    return style;
                },
                pointToLayer: function(feature, latlng) {
                    const pointStyle = {
                        radius: 6,
                        fillColor: layerStyles[layerId].fillColor,
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    };
                    
                    // Apply original styling for points if available
                    if (useOriginalStyle && styleInfo.default_style) {
                        if (styleInfo.default_style.radius) {
                            pointStyle.radius = styleInfo.default_style.radius;
                        }
                        if (styleInfo.default_style.fillColor) {
                            pointStyle.fillColor = styleInfo.default_style.fillColor;
                        }
                        if (styleInfo.default_style.color) {
                            pointStyle.color = styleInfo.default_style.color;
                        }
                    }
                    
                    // If labels should be added, create a label for this point
                    if (addLabels && feature.properties) {
                        createLabel(feature, latlng, styleInfo.labels);
                    }
                    
                    return L.circleMarker(latlng, pointStyle);
                },
                
                // After each feature is created, add a label if needed
                onEachFeature: function(feature, layer) {
                    // Create popup content with feature properties
                    if (feature.properties) {
                        let popupContent = '<div class="feature-popup">';
                        popupContent += '<h6 class="arabic-text">معلومات المعلم / Feature Properties</h6>';
                        popupContent += '<ul class="feature-properties arabic-text">';
                        
                        // Check if this feature has Arabic name
                        let hasArabicName = false;
                        if (feature.properties['arabic_label'] || feature.properties['ADM4_NAME_']) {
                            hasArabicName = true;
                        }
                        
                        // First show the Arabic name if available
                        if (feature.properties['arabic_label']) {
                            popupContent += `<li><span class="property-name">الاسم:</span> ${feature.properties['arabic_label']}</li>`;
                        } else if (feature.properties['ADM4_NAME_']) {
                            popupContent += `<li><span class="property-name">الاسم:</span> ${feature.properties['ADM4_NAME_']}</li>`;
                        }
                        
                        // Show the service metrics if this is a service layer
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
                        if (feature.properties['SMWCost'] !== undefined) {
                            popupContent += `<li><span class="property-name">تكلفة إدارة النفايات:</span> ${feature.properties['SMWCost']}</li>`;
                        }
                        if (feature.properties['waterCost'] !== undefined) {
                            popupContent += `<li><span class="property-name">تكلفة المياه:</span> ${feature.properties['waterCost']}</li>`;
                        }
                        if (feature.properties['housingCost'] !== undefined) {
                            popupContent += `<li><span class="property-name">تكلفة المساكن:</span> ${feature.properties['housingCost']}</li>`;
                        }
                        if (feature.properties['telecomCost'] !== undefined) {
                            popupContent += `<li><span class="property-name">تكلفة الاتصالات:</span> ${feature.properties['telecomCost']}</li>`;
                        }
                        if (feature.properties['swageCost'] !== undefined) {
                            popupContent += `<li><span class="property-name">تكلفة الصرف الصحي:</span> ${feature.properties['swageCost']}</li>`;
                        }
                        
                        // Include remaining properties if they're not already shown
                        Object.keys(feature.properties).forEach(key => {
                            // Skip the properties we've already displayed
                            if (key === 'arabic_label' || 
                                key === 'ADM4_NAME_' ||
                                key === 'power' || 
                                key === 'SMW' || 
                                key === 'waterSupply' || 
                                key === 'housing' || 
                                key === 'telecom' || 
                                key === 'swage' ||
                                key === 'powerCost' || 
                                key === 'SMWCost' || 
                                key === 'waterCost' || 
                                key === 'housingCost' || 
                                key === 'telecomCost' || 
                                key === 'swageCost' ||
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
                        click: function(e) {
                            L.DomEvent.stopPropagation(e);
                            selectFeature(feature, layer, layerId);
                        }
                    });
                    
                    // If labels should be added for polygons or lines
                    if (addLabels && feature.properties && 
                        feature.geometry && 
                        (feature.geometry.type === 'Polygon' || 
                         feature.geometry.type === 'MultiPolygon' ||
                         feature.geometry.type === 'LineString' ||
                         feature.geometry.type === 'MultiLineString')) {
                        try {
                            // Calculate the center of the feature for label placement
                            let center;
                            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                                // For polygons, use the centroid
                                const bounds = layer.getBounds();
                                center = bounds.getCenter();
                            } else {
                                // For lines, try to find a midpoint
                                const latlngs = layer.getLatLngs();
                                let midIndex = Math.floor(latlngs.length / 2);
                                if (Array.isArray(latlngs) && latlngs.length > 0) {
                                    if (Array.isArray(latlngs[0])) {
                                        // MultiLineString - use the first line's midpoint
                                        midIndex = Math.floor(latlngs[0].length / 2);
                                        center = latlngs[0][midIndex];
                                    } else {
                                        // LineString
                                        center = latlngs[midIndex];
                                    }
                                } else {
                                    // Fallback to bounds center
                                    const bounds = layer.getBounds();
                                    center = bounds.getCenter();
                                }
                            }
                            
                            createLabel(feature, center, styleInfo.labels);
                        } catch (e) {
                            console.error("Error creating label:", e);
                        }
                    }
                }
                });
                
                // Add the layer to the map
                geoJSONLayer.addLayer(layer);
                
                // Add label layer if it exists
                if (labelLayer) {
                    geoJSONLayer.addLayer(labelLayer);
                }
                
                geoJSONLayer.addTo(map);
                
                // Store the layer for future reference
                layerControls[layerId] = geoJSONLayer;
                
                // Function to create a label
                function createLabel(feature, position, labelConfig) {
                    if (!labelLayer) return;
                    
                    // Find the best property to use as a label
                    let labelText = '';
                    for (const field of labelConfig.fields) {
                        if (feature.properties[field]) {
                            labelText = feature.properties[field];
                            break;
                        }
                    }
                    
                    if (labelText) {
                        // Create the label
                        const labelOptions = {
                            className: 'map-label',
                            offset: [0, 0],
                            opacity: 0.9,
                            direction: 'center'
                        };
                        
                        // Determine if text is Arabic - this simple check looks for Arabic Unicode range
                        const isArabic = /[\u0600-\u06FF]/.test(labelText);
                        
                        if (labelConfig.font) {
                            // Set a custom CSS style
                            const labelStyle = document.createElement('style');
                            labelStyle.type = 'text/css';
                            labelStyle.innerHTML = `.map-label {
                                font: ${labelConfig.font};
                                font-family: 'Cairo', sans-serif;
                                color: ${labelConfig.color || '#333'};
                                text-shadow: -1px -1px 0 ${labelConfig.haloColor || '#fff'}, 
                                            1px -1px 0 ${labelConfig.haloColor || '#fff'}, 
                                            -1px 1px 0 ${labelConfig.haloColor || '#fff'}, 
                                            1px 1px 0 ${labelConfig.haloColor || '#fff'};
                                width: auto !important;
                                background: transparent;
                                border: none;
                                box-shadow: none;
                                direction: ${isArabic ? 'rtl' : 'ltr'};
                            }`;
                            document.head.appendChild(labelStyle);
                        }
                        
                        // Create a span with appropriate direction
                        const labelHTML = `<span class="arabic-text" style="direction: ${isArabic ? 'rtl' : 'ltr'}">${labelText}</span>`;
                        
                        const label = L.marker(position, {
                            icon: L.divIcon({
                                className: 'map-label',
                                html: labelHTML,
                                iconSize: [120, 20],  // Increased size for Arabic text
                                iconAnchor: [60, 10]
                            })
                        });
                        
                        labelLayer.addLayer(label);
                    }
                }
                
                // Adjust map view to show the layer
                try {
                    map.fitBounds(layer.getBounds());
                } catch (e) {
                    console.warn('Could not fit bounds for layer:', e);
                }
            })
            .catch(error => {
                console.error(`Error loading GeoJSON layer ${layerId}:`, error);
                alert(`Failed to load layer ${layerId}. Please check the console for details.`);
            });
    }

    // Handle feature selection
    function selectFeature(feature, layer, layerId) {
        // Toggle selected state
        const featureId = feature.id || JSON.stringify(feature.properties);
        const alreadySelected = selectedFeatures.findIndex(f => 
            (f.id && f.id === featureId) || 
            JSON.stringify(f.properties) === JSON.stringify(feature.properties)
        );
        
        if (alreadySelected >= 0) {
            // Deselect the feature - restore original style
            if (layer.resetStyle) {
                // If it's a direct GeoJSON layer
                layer.resetStyle();
            } else {
                // Determine appropriate style based on feature type
                let featureType = 'default';
                if (feature.geometry && feature.geometry.type) {
                    featureType = feature.geometry.type;
                }
                
                // Get the original style
                let originalStyle = { ...defaultStyles[featureType] || defaultStyles.default };
                
                // Apply layer-specific style
                const styleInfo = layerStyles[layerId].originalStyleInfo;
                if (styleInfo && styleInfo.default_style) {
                    originalStyle = { ...originalStyle, ...styleInfo.default_style };
                }
                
                // Apply property-based styling if available
                if (styleInfo && styleInfo.property_styles && feature.properties) {
                    for (const [property, propertyStyle] of Object.entries(styleInfo.property_styles)) {
                        if (feature.properties[property] !== undefined &&
                            propertyStyle.values && 
                            propertyStyle.values[feature.properties[property]]) {
                            
                            originalStyle = {
                                ...originalStyle,
                                ...propertyStyle.values[feature.properties[property]]
                            };
                        }
                    }
                }
                
                // Apply original style
                layer.setStyle(originalStyle);
            }
            
            selectedFeatures.splice(alreadySelected, 1);
        } else {
            // Determine appropriate highlight style based on feature type
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

    // Update selection info display
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
                    const nameProps = ['name', 'title', 'id', 'type', 'category'];
                    for (const prop of nameProps) {
                        if (feature.properties[prop]) {
                            featureName = feature.properties[prop];
                            break;
                        }
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

    // Clear selection
    document.getElementById('clear-selection').addEventListener('click', function() {
        // Reset all layer styles
        for (const layerId in layerControls) {
            const layerGroup = layerControls[layerId];
            layerGroup.eachLayer(layer => {
                if (layer instanceof L.GeoJSON) {
                    layer.resetStyle();
                }
            });
        }
        
        // Clear selected features array
        selectedFeatures = [];
        selectedLayer = null;
        
        // Update UI
        updateSelectionInfo();
        this.disabled = true;
    });

    // Initialize report modal
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

    // Handle report generation
    document.getElementById('generate-report-btn').addEventListener('click', function() {
        const reportModal = new bootstrap.Modal(document.getElementById('report-modal'));
        reportModal.show();
        updateReportModal();
    });

    // Create report
    document.getElementById('create-report-btn').addEventListener('click', function() {
        if (selectedFeatures.length === 0) {
            alert('Please select at least one feature to include in the report.');
            return;
        }
        
        // Get report data
        const reportTitle = document.getElementById('report-title').value || 'Homs Map Report';
        const reportDescription = document.getElementById('report-description').value || '';
        const includeMap = document.getElementById('include-map').checked;
        
        // Get map image if needed
        let mapImage = null;
        if (includeMap) {
            // Create a map image from the current view
            mapImage = map.getRenderer(map).canvas.toDataURL();
        }
        
        // Prepare report data
        const reportData = {
            title: reportTitle,
            description: reportDescription,
            mapImage: mapImage,
            layerName: selectedLayer ? document.querySelector(`label[for="layer-${selectedLayer}"]`).textContent.trim() : '',
            featureCount: selectedFeatures.length,
            selectionType: 'Manual Selection',
            features: selectedFeatures
        };
        
        // Encode the data to pass via URL
        const encodedData = encodeURIComponent(JSON.stringify(reportData));
        
        // Navigate to the report page with the data
        window.open(`/report?data=${encodedData}`, '_blank');
    });

    // Add base layer control
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // Make the map object globally accessible
    window.homsMap = map;
    window.selectedFeatures = selectedFeatures;
});
