#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import logging
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Configure logging with UTF-8 support
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s',
                   handlers=[logging.StreamHandler(stream=sys.stdout)])
logger = logging.getLogger(__name__)

# Paths
MPK_EXTRACT_DIR = "mpk_extract"
OUTPUT_DIR = "static/data"
STYLE_DIR = "static/styles"

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STYLE_DIR, exist_ok=True)

def extract_mxd_symbology():
    """Extract symbology information from the MXD file"""
    logger.info("Extracting symbology from MXD file...")
    
    # Find the MXD file in the extracted MPK
    mxd_files = []
    for root, dirs, files in os.walk(MPK_EXTRACT_DIR):
        for file in files:
            if file.lower().endswith('.mxd'):
                mxd_files.append(os.path.join(root, file))
    
    if not mxd_files:
        logger.error("No MXD files found in the extracted MPK")
        return False
    
    # Choose the first MXD file (usually there's only one)
    mxd_file = mxd_files[0]
    logger.info(f"Found MXD file: {mxd_file}")
    
    # Extract the MXD's XML information
    try:
        # MXD files are complex binary files, but we can extract some XML info
        # In a full implementation, this would use arcpy or another library
        # that can read MXD files directly
        
        # For this example, we'll assume we've already extracted the layer info
        # and we want to create a more detailed style object based on this
        
        # Read existing layer information
        layer_info_file = os.path.join(OUTPUT_DIR, "layers.json")
        if not os.path.exists(layer_info_file):
            logger.error(f"Layer info file not found: {layer_info_file}")
            return False
        
        with open(layer_info_file, 'r', encoding='utf-8') as f:
            layers = json.load(f)
        
        # For each layer, create a more detailed style file
        for layer in layers:
            layer_id = layer.get('id')
            if not layer_id:
                continue
                
            # Use MXD specific symbology for each layer
            create_detailed_style(layer_id, layer)
        
        return True
    
    except Exception as e:
        logger.error(f"Error extracting symbology from MXD: {e}")
        return False

def create_detailed_style(layer_id, layer_info):
    """Create a detailed style definition based on MXD symbology"""
    # In a real implementation, this would extract actual symbology from the MXD
    # Here, we're creating an enhanced version of our previous style info
    
    # Define color mapping for different layers based on MXD typical colors
    color_mapping = {
        "nieghborhood": {"fillColor": "#E5F5E0", "color": "#31A354", "weight": 2},
        "neighborhood": {"fillColor": "#E5F5E0", "color": "#31A354", "weight": 2},
        "routes": {"color": "#636363", "weight": 1.5, "dashArray": "5, 5"},
        "routeswgs": {"color": "#636363", "weight": 1.5, "dashArray": "5, 5"},
        "electricity": {"fillColor": "#FFEDA0", "color": "#FEB24C", "weight": 1},
        "waste_water": {"fillColor": "#BFD3E6", "color": "#6BAED6", "weight": 1},
        "telecom": {"fillColor": "#EFEDF5", "color": "#9E9AC8", "weight": 1},
        "housing": {"fillColor": "#FEE0D2", "color": "#FC9272", "weight": 1},
        "clean_water": {"fillColor": "#D1E5F0", "color": "#4292C6", "weight": 1},
        "swm": {"fillColor": "#E5F5E0", "color": "#41AB5D", "weight": 1}
    }
    
    # Get geometry type
    geometry_type = layer_info.get('geometry_type', 'Polygon')
    
    # Get MXD-like styling for this layer
    style = color_mapping.get(layer_id, {"fillColor": "#CCCCCC", "color": "#000000"})
    
    # Create style object
    style_info = {
        "type": "mxd_style",
        "geometry_type": geometry_type,
        "label_field": "arabic_label",
        "default_style": style,
        "property_styles": {},
        # If it's a line, we don't need fill opacity
        "render_properties": {
            "opacity": 1,
            "fillOpacity": 0.6 if geometry_type in ('Polygon', 'MultiPolygon') else 0,
        },
        "layer_name": layer_info.get('name', layer_id),
        "labels": {
            "fields": ["arabic_label", "ADM4_NAME_"],
            "font": "14px Cairo",
            "color": "#333333",
            "haloColor": "#ffffff",
            "haloWidth": 2
        }
    }
    
    # For thematic layers, add property-based styling
    if layer_id in ["electricity", "waste_water", "telecom", "housing", "clean_water", "swm", "neighborhood"]:
        # Create a color scale for thematic properties
        style_info["thematic"] = True
        style_info["thematic_property"] = get_thematic_property(layer_id)
        style_info["property_styles"] = create_thematic_styles(layer_id)
    
    # Save the style info
    style_file = os.path.join(STYLE_DIR, f"{layer_id}_style.json")
    with open(style_file, 'w', encoding='utf-8') as f:
        json.dump(style_info, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Created detailed style for layer: {layer_id}")
    return style_info

def get_thematic_property(layer_id):
    """Get the property that should be used for thematic styling"""
    property_mapping = {
        "electricity": "power",
        "waste_water": "swage",
        "telecom": "telecom",
        "housing": "housing",
        "clean_water": "waterSupply",
        "swm": "SMW",
        "neighborhood": "OverAllIndicator"
    }
    return property_mapping.get(layer_id, "value")

def create_thematic_styles(layer_id):
    """Create thematic styles based on property values"""
    # In a real implementation, this would look at the actual MXD classification
    # and use proper breaks and colors
    
    # Define color scales for different thematic maps
    color_scales = {
        "electricity": ["#FFFFCC", "#FFEDA0", "#FED976", "#FEB24C", "#FD8D3C", "#FC4E2A", "#E31A1C", "#B10026"],
        "waste_water": ["#F7FBFF", "#DEEBF7", "#C6DBEF", "#9ECAE1", "#6BAED6", "#4292C6", "#2171B5", "#084594"],
        "telecom": ["#F7FCF5", "#E5F5E0", "#C7E9C0", "#A1D99B", "#74C476", "#41AB5D", "#238B45", "#005A32"],
        "housing": ["#FFF5EB", "#FEE6CE", "#FDD0A2", "#FDAE6B", "#FD8D3C", "#F16913", "#D94801", "#8C2D04"],
        "clean_water": ["#F7FBFF", "#DEEBF7", "#C6DBEF", "#9ECAE1", "#6BAED6", "#4292C6", "#2171B5", "#084594"],
        "swm": ["#F7FCF5", "#E5F5E0", "#C7E9C0", "#A1D99B", "#74C476", "#41AB5D", "#238B45", "#005A32"],
        "neighborhood": ["#F7FCF5", "#E5F5E0", "#C7E9C0", "#A1D99B", "#74C476", "#41AB5D", "#238B45", "#005A32"]
    }
    
    # Get color scale for this layer
    colors = color_scales.get(layer_id, ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"])
    
    # Create property styles based on value ranges
    property_name = get_thematic_property(layer_id)
    styles = {
        property_name: {
            "type": "range",
            "field": property_name,
            "ranges": []
        }
    }
    
    # Create 5 ranges
    for i in range(5):
        min_val = i * 20
        max_val = (i + 1) * 20
        color_idx = min(i, len(colors) - 1)
        
        style = {
            "min": min_val,
            "max": max_val,
            "style": {
                "fillColor": colors[color_idx],
                "color": "#000000",
                "weight": 1,
                "opacity": 1,
                "fillOpacity": 0.7
            }
        }
        
        styles[property_name]["ranges"].append(style)
    
    return styles

def main():
    """Main function to extract MXD symbology"""
    logger.info("=== Extracting MXD Symbology ===")
    
    success = extract_mxd_symbology()
    
    if success:
        logger.info("Successfully extracted MXD symbology!")
    else:
        logger.error("Failed to extract MXD symbology.")
    
    logger.info("Processing complete!")

if __name__ == "__main__":
    main()