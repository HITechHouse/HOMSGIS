// Report generation functionality
document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    const generateReportBtn = document.getElementById('generate-report-btn');
    const createReportBtn = document.getElementById('create-report-btn');
    
    // Update selected features count in the report modal
    function updateSelectedCount() {
        const selectedFeatures = window.selectedFeatures || [];
        const selectedCount = document.getElementById('selected-count');
        
        if (selectedCount) {
            selectedCount.textContent = selectedFeatures.length;
        }
    }
    
    // Generate a feature table for the report
    function generateFeatureTable() {
        const selectedFeatures = window.selectedFeatures || [];
        const tableBody = document.getElementById('selected-features-table').querySelector('tbody');
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        if (selectedFeatures.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted">No features selected</td>
                </tr>
            `;
            return;
        }
        
        // Add a row for each selected feature
        selectedFeatures.forEach((feature, index) => {
            const row = document.createElement('tr');
            
            // Feature ID or index
            const idCell = document.createElement('td');
            idCell.textContent = index + 1;
            row.appendChild(idCell);
            
            // Layer name
            const layerCell = document.createElement('td');
            if (feature.layerId) {
                const layerLabel = document.querySelector(`label[for="layer-${feature.layerId}"]`);
                layerCell.textContent = layerLabel ? layerLabel.textContent.trim() : feature.layerId;
            } else {
                layerCell.textContent = 'Unknown layer';
            }
            row.appendChild(layerCell);
            
            // Properties preview
            const propsCell = document.createElement('td');
            if (feature.properties && Object.keys(feature.properties).length > 0) {
                // Show first few properties as preview
                const props = Object.entries(feature.properties).slice(0, 3);
                const propsList = props.map(([key, value]) => `${key}: ${value}`).join(', ');
                propsCell.textContent = propsList + (Object.keys(feature.properties).length > 3 ? '...' : '');
            } else {
                propsCell.textContent = 'No properties';
            }
            row.appendChild(propsCell);
            
            tableBody.appendChild(row);
        });
    }
    
    // Initialize report modal when opened
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', function() {
            updateSelectedCount();
            generateFeatureTable();
            
            // Enable/disable create report button based on selection
            const selectedFeatures = window.selectedFeatures || [];
            if (createReportBtn) {
                createReportBtn.disabled = selectedFeatures.length === 0;
            }
        });
    }
    
    // Handle report creation
    if (createReportBtn) {
        createReportBtn.addEventListener('click', function() {
            const selectedFeatures = window.selectedFeatures || [];
            
            if (selectedFeatures.length === 0) {
                alert('Please select at least one feature on the map to include in the report.');
                return;
            }
            
            // Get report options
            const title = document.getElementById('report-title').value || 'Homs Map Report';
            const description = document.getElementById('report-description').value || '';
            const includeMap = document.getElementById('include-map').checked;
            
            // Get the map screenshot if needed
            let mapImage = null;
            if (includeMap && window.homsMap) {
                try {
                    // Try to get map element for screenshot
                    const mapContainer = window.homsMap.getContainer();
                    
                    // Use html2canvas if available, otherwise skip
                    if (typeof html2canvas === 'function') {
                        html2canvas(mapContainer).then(canvas => {
                            mapImage = canvas.toDataURL('image/png');
                            generateReport(title, description, mapImage, selectedFeatures);
                        });
                    } else {
                        console.warn('html2canvas not available, skipping map screenshot');
                        generateReport(title, description, null, selectedFeatures);
                    }
                } catch (e) {
                    console.error('Error capturing map:', e);
                    generateReport(title, description, null, selectedFeatures);
                }
            } else {
                generateReport(title, description, null, selectedFeatures);
            }
        });
    }
    
    // Generate the report with data
    function generateReport(title, description, mapImage, features) {
        try {
            // Get the layer name from the first feature
            let layerName = 'Unknown Layer';
            if (features[0] && features[0].layerId) {
                const layerElement = document.querySelector(`label[for="layer-${features[0].layerId}"]`);
                if (layerElement) {
                    layerName = layerElement.textContent.trim();
                }
            }
            
            // Build report data
            const reportData = {
                title: title,
                description: description,
                mapImage: mapImage,
                layerName: layerName,
                featureCount: features.length,
                selectionType: 'Manual Selection',
                features: features.map(feature => ({
                    id: feature.id || 'Feature ID not available',
                    properties: feature.properties || {}
                }))
            };
            
            // Encode the data to pass via URL
            const encodedData = encodeURIComponent(JSON.stringify(reportData));
            
            // Open the report in a new window
            window.open(`/report?data=${encodedData}`, '_blank');
            
            // Close the modal
            const reportModal = bootstrap.Modal.getInstance(document.getElementById('report-modal'));
            if (reportModal) {
                reportModal.hide();
            }
        } catch (e) {
            console.error('Error generating report:', e);
            alert('An error occurred while generating the report. Please try again.');
        }
    }
    
    // Handle print report on the report page
    const printReportBtn = document.getElementById('print-report');
    if (printReportBtn) {
        printReportBtn.addEventListener('click', function() {
            window.print();
        });
    }
});
