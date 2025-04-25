#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import logging
import sys
import colorsys
from pathlib import Path

# Configure logging with UTF-8 support
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s',
                   handlers=[logging.StreamHandler(stream=sys.stdout)])
logger = logging.getLogger(__name__)

# Paths
INPUT_GEOJSON = "static/data/nieghborhood.geojson"
OUTPUT_DIR = "static/data"
STYLE_DIR = "static/styles"

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STYLE_DIR, exist_ok=True)

# Define the thematic layers we want to create
THEMATIC_LAYERS = {
    'electricity': {
        'property': 'power',
        'arabic_name': 'الكهرباء',
        'color_scale': ['#FFFFB2', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#B10026'],
        'cost_property': 'powerCost'
    },
    'swm': {
        'property': 'SMW',
        'arabic_name': 'إدارة النفايات الصلبة',
        'color_scale': ['#EFEDF5', '#DADAEB', '#BCBDDC', '#9E9AC8', '#807DBA', '#6A51A3', '#4A1486'],
        'cost_property': 'SMWCost'
    },
    'clean_water': {
        'property': 'waterSupply',
        'arabic_name': 'مياه الشرب',
        'color_scale': ['#EFF3FF', '#C6DBEF', '#9ECAE1', '#6BAED6', '#4292C6', '#2171B5', '#084594'],
        'cost_property': 'waterCost'
    },
    'housing': {
        'property': 'housing',
        'arabic_name': 'المساكن',
        'color_scale': ['#F7F7F7', '#D9D9D9', '#BDBDBD', '#969696', '#737373', '#525252', '#252525'],
        'cost_property': 'housingCost'
    },
    'telecom': {
        'property': 'telecom',
        'arabic_name': 'الاتصالات',
        'color_scale': ['#F2F0F7', '#DADAEB', '#BCBDDC', '#9E9AC8', '#807DBA', '#6A51A3', '#4A1486'],
        'cost_property': 'telecomCost'
    },
    'waste_water': {
        'property': 'swage',
        'arabic_name': 'الصرف الصحي',
        'color_scale': ['#F1EEF6', '#D4B9DA', '#C994C7', '#DF65B0', '#E7298A', '#CE1256', '#91003F'],
        'cost_property': 'swageCost'
    },
    'neighborhood': {
        'property': 'OverAllIndicator',
        'arabic_name': 'الأحياء',
        'color_scale': ['#B9CF96', '#A8DB94', '#96E8A0', '#78C498', '#56A08C', '#357E7F', '#1E5C70'],
        'label_property': 'ADM4_NAME_'
    }
}

def create_thematic_layer(layer_id, layer_config):
    """Create a thematic layer based on the neighborhood data"""
    try:
        # Read the input GeoJSON file
        with open(INPUT_GEOJSON, 'r', encoding='utf-8') as f:
            neighborhoods = json.load(f)
        
        if 'features' not in neighborhoods:
            logger.error("Invalid GeoJSON: no features found")
            return None
        
        # Create a new GeoJSON with the same features but include thematic property
        thematic_geojson = {
            "type": "FeatureCollection",
            "features": []
        }
        
        property_name = layer_config['property']
        arabic_name = layer_config['arabic_name']
        cost_property = layer_config.get('cost_property', None)
        label_property = layer_config.get('label_property', 'ADM4_NAME_')
        
        # Create bins for classification
        values = []
        for feature in neighborhoods['features']:
            value = feature['properties'].get(property_name)
            if value is not None:
                values.append(float(value))
        
        if not values:
            logger.error(f"No values found for property {property_name}")
            return None
        
        min_value = min(values)
        max_value = max(values)
        range_value = max_value - min_value
        
        # Create bins
        num_bins = len(layer_config['color_scale'])
        bins = []
        for i in range(num_bins):
            bin_min = min_value + (range_value * i / num_bins)
            bin_max = min_value + (range_value * (i + 1) / num_bins)
            bins.append((bin_min, bin_max, layer_config['color_scale'][i]))
        
        # Process each feature
        for feature in neighborhoods['features']:
            # Create a copy of the feature
            new_feature = {
                "type": "Feature",
                "properties": {},
                "geometry": feature['geometry']
            }
            
            # Add Arabic label
            arabic_label = feature['properties'].get(label_property, '')
            new_feature['properties']['arabic_label'] = arabic_label
            
            # Add neighborhood name
            new_feature['properties']['neighborhood'] = feature['properties'].get('ADM4_NAME', '')
            
            # Add the thematic property
            value = feature['properties'].get(property_name)
            if value is not None:
                new_feature['properties'][property_name] = value
                
                # Add bin and color
                for bin_min, bin_max, color in bins:
                    if bin_min <= float(value) <= bin_max:
                        new_feature['properties']['bin'] = f"{bin_min:.1f}-{bin_max:.1f}"
                        new_feature['properties']['color'] = color
                        break
            
            # Add cost if available
            if cost_property and cost_property in feature['properties']:
                new_feature['properties']['cost'] = feature['properties'][cost_property]
            
            thematic_geojson['features'].append(new_feature)
        
        # Save the thematic GeoJSON
        output_file = os.path.join(OUTPUT_DIR, f"{layer_id}.geojson")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(thematic_geojson, f, ensure_ascii=False)
        
        # Create style information
        style_info = create_style_info(layer_id, layer_config, bins)
        
        # Save style information
        style_file = os.path.join(STYLE_DIR, f"{layer_id}_style.json")
        with open(style_file, 'w', encoding='utf-8') as f:
            json.dump(style_info, f, ensure_ascii=False, indent=2)
        
        # Return layer information
        return {
            "id": layer_id,
            "name": arabic_name,
            "filename": f"{layer_id}.geojson",
            "feature_count": len(thematic_geojson['features']),
            "has_style": True,
            "geometry_type": "MultiPolygon",
            "properties": ["arabic_label", "neighborhood", property_name, "bin", "color"] + (["cost"] if cost_property else [])
        }
    
    except Exception as e:
        logger.error(f"Error creating thematic layer {layer_id}: {e}")
        return None

def create_style_info(layer_id, layer_config, bins):
    """Create style information for the thematic layer"""
    arabic_name = layer_config['arabic_name']
    property_name = layer_config['property']
    
    # Default style
    default_style = {
        "fillColor": "#CCCCCC",
        "color": "#000000",
        "weight": 1,
        "opacity": 1,
        "fillOpacity": 0.7
    }
    
    # Create property styles based on bins
    property_styles = {
        "color": {
            "type": "categorical",
            "field": "color",
            "values": {}
        }
    }
    
    # Add styles for each bin
    for bin_min, bin_max, color in bins:
        property_styles["color"]["values"][color] = {
            "fillColor": color,
            "color": "#000000",
            "weight": 1,
            "opacity": 1,
            "fillOpacity": 0.7
        }
    
    # Create style info
    style_info = {
        "type": "thematic",
        "geometry_type": "MultiPolygon",
        "property_styles": property_styles,
        "default_style": default_style,
        "layer_name": arabic_name,
        "property": property_name,
        "labels": {
            "fields": ["arabic_label"],
            "font": "14px Arial",
            "color": "#333333",
            "haloColor": "#ffffff",
            "haloWidth": 2
        }
    }
    
    return style_info

def update_layer_index(new_layers):
    """Update the layer index file with the new thematic layers"""
    index_file = os.path.join(OUTPUT_DIR, "layers.json")
    
    # Read existing layers
    existing_layers = []
    if os.path.exists(index_file):
        try:
            with open(index_file, 'r', encoding='utf-8') as f:
                existing_layers = json.load(f)
        except:
            pass
    
    # Update with new layers
    for layer in new_layers:
        # Check if layer already exists
        existing_idx = next((i for i, l in enumerate(existing_layers) 
                            if l.get("id") == layer.get("id")), None)
        
        if existing_idx is not None:
            # Replace the existing layer
            existing_layers[existing_idx] = layer
        else:
            # Add the new layer
            existing_layers.append(layer)
    
    # Save updated index
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(existing_layers, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Layer index updated with {len(existing_layers)} layers")

def main():
    """Create thematic layers based on neighborhood data"""
    logger.info("=== Creating Thematic Layers ===")
    
    # Check if input file exists
    if not os.path.exists(INPUT_GEOJSON):
        logger.error(f"Input file not found: {INPUT_GEOJSON}")
        return
    
    # Create each thematic layer
    created_layers = []
    for layer_id, layer_config in THEMATIC_LAYERS.items():
        logger.info(f"Creating thematic layer: {layer_id}")
        layer_info = create_thematic_layer(layer_id, layer_config)
        if layer_info:
            created_layers.append(layer_info)
            logger.info(f"Created thematic layer: {layer_id} with {layer_info['feature_count']} features")
        else:
            logger.error(f"Failed to create thematic layer: {layer_id}")
    
    # Update layer index
    if created_layers:
        update_layer_index(created_layers)
    
    logger.info("Processing complete!")

if __name__ == "__main__":
    main()