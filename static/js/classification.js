/**
 * Classification definitions and utility functions for infrastructure columns
 */
 
// Store the classification definitions
const classifications = {
    // Overall infrastructure indicator
    OverAllIndicator: {
        name: {
            en: "Overall Infrastructure Indicator",
            ar: "مؤشر البنية التحتية الكلي"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    },
    
    // Sewage system
    swage: {
        name: {
            en: "Sewage System",
            ar: "شبكة الصرف الصحي"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    },
    
    // Telecommunications
    telecom: {
        name: {
            en: "Telecommunications",
            ar: "شبكة الاتصالات"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    },
    
    // Housing
    housing: {
        name: {
            en: "Housing",
            ar: "المساكن"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    },
    
    // Water Supply
    waterSupply: {
        name: {
            en: "Water Supply",
            ar: "إمدادات المياه"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    },
    
    // Solid Waste Management
    SMW: {
        name: {
            en: "Solid Waste Management",
            ar: "إدارة النفايات الصلبة"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    },
    
    // Power
    power: {
        name: {
            en: "Power",
            ar: "الكهرباء"
        },
        ranges: true, // Using range-based classification
        categories: [
            { min: 0, max: 20, label: { en: "No Damage", ar: "لا يوجد ضرر" }, color: "#1a9641" },
            { min: 20, max: 40, label: { en: "Simple Damage", ar: "ضرر بسيط" }, color: "#a6d96a" },
            { min: 40, max: 60, label: { en: "Damaged", ar: "متضرر" }, color: "#ffffbf" },
            { min: 60, max: 80, label: { en: "Severe Damage", ar: "ضرر شديد" }, color: "#fdae61" },
            { min: 80, max: 100, label: { en: "Destroyed", ar: "مدمر" }, color: "#d7191c" }
        ]
    }
};

/**
 * Get classification details for a value in a specific field
 * @param {string} field - Field name (e.g., 'power', 'swage', etc.)
 * @param {number|string} value - Value to classify
 * @returns {Object} Classification object with label and color
 */
function getClassification(field, value) {
    // Default classification
    const defaultClassification = { 
        label: { en: "Unknown", ar: "غير معروف" }, 
        color: "#999999" 
    };
    
    try {
        // Check if field exists in classifications
        if (!field || !classifications[field]) {
            console.warn(`Field not found in classifications: ${field}`);
            return defaultClassification;
        }
        
        // Handle null or undefined values
        if (value === null || value === undefined) {
            console.warn(`Null or undefined value for field: ${field}`);
            return defaultClassification;
        }
        
        // Convert value to number and handle NaN
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            console.warn(`Invalid numeric value for field ${field}: ${value}`);
            return defaultClassification;
        }
        
        // Check if we're using ranges or exact values
        if (classifications[field].ranges) {
            // Range-based classification - find which range the value falls into
            const category = classifications[field].categories.find(cat => 
                numValue >= cat.min && numValue <= cat.max
            );
            
            if (!category) {
                console.warn(`No range category found for value ${numValue} in field ${field}`);
                return defaultClassification;
            }
            
            // Log successful classification
            console.log(`Classified ${field}=${numValue} as ${category.label.ar} (${category.color}) [Range: ${category.min}-${category.max}]`);
            return category;
        } else {
            // Exact value classification (legacy)
            const category = classifications[field].categories.find(cat => cat.value === numValue);
            
            if (!category) {
                console.warn(`No exact category found for value ${numValue} in field ${field}`);
                return defaultClassification;
            }
            
            // Log successful classification
            console.log(`Classified ${field}=${numValue} as ${category.label.ar} (${category.color})`);
            return category;
        }
    } catch (error) {
        console.error('Error in getClassification:', error);
        return defaultClassification;
    }
}

/**
 * Get color for a value in a specific field
 * @param {string} field - Field name (e.g., 'power', 'swage', etc.)
 * @param {number} value - Value to classify
 * @returns {string} Color hex code
 */
function getClassificationColor(field, value) {
    const classification = getClassification(field, value);
    return classification.color;
}

/**
 * Generate HTML for classification legend
 * @param {string} field - Field name to generate legend for
 * @returns {string} HTML content for legend
 */
function generateClassificationLegend(field) {
    if (!classifications[field]) {
        return '<div class="alert alert-warning">Field not found in classification system</div>';
    }
    
    const fieldInfo = classifications[field];
    
    let html = `
        <div class="classification-legend">
            <h6 class="arabic-text text-center fw-bold">${fieldInfo.name.ar}</h6>
            <hr>
            <div class="classification-items">
    `;
    
    // Add each category to the legend
    fieldInfo.categories.forEach(category => {
        // Handle range-based or value-based classification
        let rangeText = '';
        if (fieldInfo.ranges) {
            rangeText = `${category.min}-${category.max}%`;
        } else {
            rangeText = `(${category.value})`;
        }
        
        html += `
            <div class="classification-item d-flex align-items-center mb-1">
                <span class="legend-color me-2" style="background-color: ${category.color}"></span>
                <span class="arabic-text">${category.label.ar}</span>
                <span class="ms-1 text-muted small">${rangeText}</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

/**
 * Apply classification styling to a feature
 * @param {Object} feature - GeoJSON feature
 * @param {string} field - Field to base classification on
 * @param {Object} defaultStyle - Default style to extend
 * @returns {Object} Style object for the feature
 */
function applyClassificationStyle(feature, field, defaultStyle = {}) {
    // Create a new style object with default values
    const style = {
        weight: 1,
        opacity: 1,
        color: '#333',
        fillOpacity: 0.7,
        // Include any properties from defaultStyle
        ...defaultStyle
    };
    
    // Check if feature has properties and the specified field
    if (feature && feature.properties && feature.properties[field] !== undefined && feature.properties[field] !== null) {
        const value = feature.properties[field];
        const classification = getClassification(field, value);
        
        // Apply classification color - forcefully override
        style.fillColor = classification.color;
        // Keep border color dark for visibility
        style.color = '#333'; 
        style.fillOpacity = 0.7;
        style.weight = 1;
        
        // Log to debug
        console.log(`Applied style for ${field}=${value}: ${classification.color}`);
    } else {
        // Default style if field is missing
        style.fillColor = '#cccccc';
        console.log(`Field ${field} not found in feature`);
    }
    
    return style;
}

/**
 * Get all available classification fields
 * @returns {Array} Array of classification field definitions
 */
function getClassificationFields() {
    return Object.keys(classifications).map(fieldId => ({
        id: fieldId,
        name: classifications[fieldId].name
    }));
}