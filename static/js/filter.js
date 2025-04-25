// Map filtering functionality
document.addEventListener('DOMContentLoaded', function() {
    // Filter-related DOM elements
    const layerSelect = document.getElementById('layer-select');
    const filterPropertiesDiv = document.getElementById('filter-properties');
    const propertySelect = document.getElementById('property-select');
    const filterControls = document.getElementById('filter-controls');
    const filterTextControl = document.getElementById('filter-text-control');
    const filterNumberControl = document.getElementById('filter-number-control');
    const filterSelectControl = document.getElementById('filter-select-control');
    const applyFilterBtn = document.getElementById('apply-filter');
    const clearFilterBtn = document.getElementById('clear-filter');
    
    // Current filter state
    let currentFilter = {
        layerId: null,
        property: null,
        type: null,
        value: null,
        min: null,
        max: null
    };
    
    // Store original layer data for resetting filters
    const originalLayers = {};
    
    // Listen for layer selection change
    layerSelect.addEventListener('change', function() {
        const layerId = this.value;
        
        if (!layerId) {
            // No layer selected, hide property selection
            filterPropertiesDiv.classList.add('d-none');
            resetFilterControls();
            return;
        }
        
        // Show property selection and fetch available properties
        filterPropertiesDiv.classList.remove('d-none');
        
        // Reset property select
        propertySelect.innerHTML = '<option value="">Select a property</option>';
        
        // Fetch properties for the selected layer
        fetch(`/api/layer-properties/${layerId}.geojson`)
            .then(response => response.json())
            .then(properties => {
                if (properties.error) {
                    throw new Error(properties.error);
                }
                
                // Add properties to select dropdown
                properties.sort().forEach(property => {
                    const option = document.createElement('option');
                    option.value = property;
                    option.textContent = property;
                    propertySelect.appendChild(option);
                });
                
                // Store current layer ID
                currentFilter.layerId = layerId;
            })
            .catch(error => {
                console.error('Error fetching layer properties:', error);
                filterPropertiesDiv.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error loading properties: ${error.message}
                    </div>
                `;
            });
    });
    
    // Listen for property selection change
    propertySelect.addEventListener('change', function() {
        const property = this.value;
        
        if (!property) {
            // No property selected, hide filter controls
            resetFilterControls();
            return;
        }
        
        // Show filter controls
        filterControls.classList.remove('d-none');
        
        // Determine the property type and show appropriate filter control
        determinePropertyType(currentFilter.layerId, property);
        
        // Store current property
        currentFilter.property = property;
    });
    
    // Determine property type and show appropriate filter controls
    function determinePropertyType(layerId, property) {
        fetch(`/api/geojson/${layerId}.geojson`)
            .then(response => response.json())
            .then(data => {
                // Find the first feature with this property that has a non-null value
                let propertyValue = null;
                let propertyType = 'string';
                let uniqueValues = new Set();
                
                // Loop through features to determine property type and collect unique values
                for (const feature of data.features) {
                    if (feature.properties && feature.properties[property] !== undefined && feature.properties[property] !== null) {
                        propertyValue = feature.properties[property];
                        
                        // Add to unique values
                        uniqueValues.add(propertyValue);
                        
                        // Get property type
                        if (typeof propertyValue === 'number') {
                            propertyType = 'number';
                        } else if (typeof propertyValue === 'boolean') {
                            propertyType = 'boolean';
                        }
                        
                        // If we have a non-null value, we can determine the type
                        if (propertyValue !== null) {
                            break;
                        }
                    }
                }
                
                // Hide all filter controls first
                filterTextControl.classList.add('d-none');
                filterNumberControl.classList.add('d-none');
                filterSelectControl.classList.add('d-none');
                
                // Show appropriate filter control based on property type
                if (propertyType === 'number') {
                    filterNumberControl.classList.remove('d-none');
                    
                    // Enable apply button
                    applyFilterBtn.disabled = false;
                    clearFilterBtn.disabled = false;
                    
                    // Find min/max values if this is a numeric property
                    let minVal = Number.MAX_VALUE;
                    let maxVal = Number.MIN_VALUE;
                    
                    for (const feature of data.features) {
                        if (feature.properties && feature.properties[property] !== undefined && feature.properties[property] !== null) {
                            const val = Number(feature.properties[property]);
                            if (!isNaN(val)) {
                                minVal = Math.min(minVal, val);
                                maxVal = Math.max(maxVal, val);
                            }
                        }
                    }
                    
                    // Set min/max inputs
                    document.getElementById('filter-min').value = minVal;
                    document.getElementById('filter-max').value = maxVal;
                    
                    // Store filter type
                    currentFilter.type = 'number';
                } else if (uniqueValues.size <= 10) {
                    // If there are few unique values, show a select dropdown
                    filterSelectControl.classList.remove('d-none');
                    
                    // Clear existing options
                    const filterSelect = document.getElementById('filter-select');
                    filterSelect.innerHTML = '<option value="">All values</option>';
                    
                    // Add unique values as options
                    Array.from(uniqueValues).sort().forEach(value => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.textContent = value;
                        filterSelect.appendChild(option);
                    });
                    
                    // Enable apply button
                    applyFilterBtn.disabled = false;
                    clearFilterBtn.disabled = false;
                    
                    // Store filter type
                    currentFilter.type = 'select';
                } else {
                    // Default to text filter for other types or when many unique values
                    filterTextControl.classList.remove('d-none');
                    
                    // Enable apply button
                    applyFilterBtn.disabled = false;
                    clearFilterBtn.disabled = false;
                    
                    // Store filter type
                    currentFilter.type = 'text';
                }
            })
            .catch(error => {
                console.error('Error determining property type:', error);
                // Default to text filter on error
                filterTextControl.classList.remove('d-none');
                currentFilter.type = 'text';
            });
    }
    
    // Apply filter button click
    applyFilterBtn.addEventListener('click', function() {
        if (!currentFilter.layerId || !currentFilter.property || !currentFilter.type) {
            return;
        }
        
        // Get filter value based on filter type
        if (currentFilter.type === 'number') {
            currentFilter.min = parseFloat(document.getElementById('filter-min').value);
            currentFilter.max = parseFloat(document.getElementById('filter-max').value);
            
            if (isNaN(currentFilter.min) || isNaN(currentFilter.max)) {
                alert('Please enter valid numeric values for min and max.');
                return;
            }
        } else if (currentFilter.type === 'select') {
            currentFilter.value = document.getElementById('filter-select').value;
        } else {
            currentFilter.value = document.getElementById('filter-text').value;
        }
        
        // Apply the filter to the map
        applyMapFilter();
    });
    
    // Clear filter button click
    clearFilterBtn.addEventListener('click', function() {
        // Reset filter state
        currentFilter = {
            layerId: currentFilter.layerId,
            property: null,
            type: null,
            value: null,
            min: null,
            max: null
        };
        
        // Reset UI
        propertySelect.value = '';
        resetFilterControls();
        
        // Reset layer if filtered
        resetLayerFilter();
    });
    
    // Reset filter controls UI
    function resetFilterControls() {
        filterControls.classList.add('d-none');
        filterTextControl.classList.add('d-none');
        filterNumberControl.classList.add('d-none');
        filterSelectControl.classList.add('d-none');
        
        // Clear inputs
        document.getElementById('filter-text').value = '';
        document.getElementById('filter-min').value = '';
        document.getElementById('filter-max').value = '';
        document.getElementById('filter-select').value = '';
        
        // Disable apply/clear buttons
        applyFilterBtn.disabled = true;
        clearFilterBtn.disabled = true;
    }
    
    // Apply filter to map layer
    function applyMapFilter() {
        // Get map and layers from the global scope
        const map = window.homsMap;
        const layerControls = window.layerControls || {};
        
        if (!map || !layerControls[currentFilter.layerId]) {
            console.error('Map or layer not found');
            return;
        }
        
        // Fetch the GeoJSON data again to filter it
        fetch(`/api/geojson/${currentFilter.layerId}.geojson`)
            .then(response => response.json())
            .then(data => {
                // Store original layer if not already stored
                if (!originalLayers[currentFilter.layerId]) {
                    originalLayers[currentFilter.layerId] = JSON.parse(JSON.stringify(data));
                }
                
                // Filter the features
                const filteredFeatures = data.features.filter(feature => {
                    // Skip features without properties
                    if (!feature.properties || feature.properties[currentFilter.property] === undefined || feature.properties[currentFilter.property] === null) {
                        return false;
                    }
                    
                    const propValue = feature.properties[currentFilter.property];
                    
                    // Apply filter based on type
                    if (currentFilter.type === 'number') {
                        return propValue >= currentFilter.min && propValue <= currentFilter.max;
                    } else if (currentFilter.type === 'select') {
                        // If empty value, show all
                        if (!currentFilter.value) {
                            return true;
                        }
                        return propValue.toString() === currentFilter.value.toString();
                    } else {
                        // Text search
                        if (!currentFilter.value) {
                            return true;
                        }
                        return propValue.toString().toLowerCase().includes(currentFilter.value.toLowerCase());
                    }
                });
                
                // Create filtered GeoJSON
                const filteredGeoJSON = {
                    type: 'FeatureCollection',
                    features: filteredFeatures
                };
                
                // Remove existing layer
                map.removeLayer(layerControls[currentFilter.layerId]);
                
                // Create a new layer with filtered data
                const layerGroup = L.layerGroup();
                const geoJSONLayer = L.geoJSON(filteredGeoJSON, {
                    // Use the same style and options as in map.js
                    style: function(feature) {
                        return {
                            color: '#3388ff',
                            weight: 2,
                            opacity: 0.7,
                            fillOpacity: 0.5,
                            fillColor: '#3388ff'
                        };
                    },
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng, {
                            radius: 6,
                            fillColor: '#ff7800',
                            color: '#000',
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        });
                    },
                    onEachFeature: function(feature, layer) {
                        // Create popup content
                        if (feature.properties) {
                            let popupContent = '<div class="feature-popup">';
                            popupContent += '<h6>Feature Properties</h6>';
                            popupContent += '<ul class="feature-properties">';
                            
                            Object.keys(feature.properties).forEach(key => {
                                if (feature.properties[key] !== null && feature.properties[key] !== undefined) {
                                    popupContent += `<li><span class="property-name">${key}:</span> ${feature.properties[key]}</li>`;
                                }
                            });
                            
                            popupContent += '</ul>';
                            popupContent += '</div>';
                            
                            layer.bindPopup(popupContent);
                        }
                    }
                });
                
                // Add filtered layer to map
                layerGroup.addLayer(geoJSONLayer);
                layerGroup.addTo(map);
                
                // Update layer control
                layerControls[currentFilter.layerId] = layerGroup;
                
                // Show filter status
                const featureCount = filteredFeatures.length;
                const totalCount = data.features.length;
                
                alert(`Filter applied: Showing ${featureCount} of ${totalCount} features.`);
            })
            .catch(error => {
                console.error('Error applying filter:', error);
                alert('Error applying filter. Please try again.');
            });
    }
    
    // Reset layer to unfiltered state
    function resetLayerFilter() {
        // Get map and layers from the global scope
        const map = window.homsMap;
        const layerControls = window.layerControls || {};
        
        if (!map || !layerControls[currentFilter.layerId]) {
            console.error('Map or layer not found');
            return;
        }
        
        // Check if we have the original layer stored
        if (!originalLayers[currentFilter.layerId]) {
            // If no original layer stored, reload the layer from server
            const layerCheckbox = document.getElementById(`layer-${currentFilter.layerId}`);
            if (layerCheckbox) {
                layerCheckbox.click();  // Turn off
                layerCheckbox.click();  // Turn back on to reload
            }
            return;
        }
        
        // Remove existing filtered layer
        map.removeLayer(layerControls[currentFilter.layerId]);
        
        // Create a new layer with original data
        const layerGroup = L.layerGroup();
        const geoJSONLayer = L.geoJSON(originalLayers[currentFilter.layerId], {
            // Use the same style and options as in map.js
            style: function(feature) {
                return {
                    color: '#3388ff',
                    weight: 2,
                    opacity: 0.7,
                    fillOpacity: 0.5,
                    fillColor: '#3388ff'
                };
            },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: '#ff7800',
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function(feature, layer) {
                // Create popup content
                if (feature.properties) {
                    let popupContent = '<div class="feature-popup">';
                    popupContent += '<h6>Feature Properties</h6>';
                    popupContent += '<ul class="feature-properties">';
                    
                    Object.keys(feature.properties).forEach(key => {
                        if (feature.properties[key] !== null && feature.properties[key] !== undefined) {
                            popupContent += `<li><span class="property-name">${key}:</span> ${feature.properties[key]}</li>`;
                        }
                    });
                    
                    popupContent += '</ul>';
                    popupContent += '</div>';
                    
                    layer.bindPopup(popupContent);
                }
            }
        });
        
        // Add original layer to map
        layerGroup.addLayer(geoJSONLayer);
        layerGroup.addTo(map);
        
        // Update layer control
        layerControls[currentFilter.layerId] = layerGroup;
        
        // Show filter status
        alert('Filter cleared. Showing all features.');
    }
});
