#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import logging
import subprocess
import sys
import glob
import colorsys
from pathlib import Path

# Configure logging with UTF-8 support
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s',
                   handlers=[logging.StreamHandler(stream=sys.stdout)])
logger = logging.getLogger(__name__)

# Paths
GDB_PATH = "additional_gdb/HomsPub.gdb"
OUTPUT_DIR = "static/data"
STYLE_DIR = "static/styles"
LABELS_DIR = "static/labels"

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STYLE_DIR, exist_ok=True)
os.makedirs(LABELS_DIR, exist_ok=True)

# Layer name mappings and colors
LAYER_COLORS = {
    'routes': '#FF7F00',           # Orange for roads/routes
    'classification': '#FFBF00',    # Amber for classification
    'waste_water': '#6A5ACD',      # Slate blue for waste water
    'telecom': '#9932CC',          # Dark orchid for telecom
    'housing': '#A8A8A8',          # Gray for housing
    'clean_water': '#1E90FF',      # Dodger blue for clean water
    'swm': '#228B22',              # Forest green for solid waste management
    'electricity': '#FFD700',      # Gold for electricity
    'neighborhood': '#B9CF96',     # Light green for neighborhoods
}

# Arabic labels
ARABIC_LABELS = {
    'routes': 'الطرق',
    'classification': 'التصنيف',
    'waste_water': 'الصرف الصحي',
    'telecom': 'الاتصالات',
    'housing': 'المساكن',
    'clean_water': 'مياه الشرب',
    'swm': 'إدارة النفايات الصلبة',
    'electricity': 'الكهرباء',
    'neighborhood': 'الأحياء',
}

def list_gdb_layers():
    """List all layers in the geodatabase"""
    try:
        import fiona
        layers = fiona.listlayers(GDB_PATH)
        logger.info(f"Found {len(layers)} layers in geodatabase: {', '.join(layers)}")
        return layers
    except Exception as e:
        logger.error(f"Error listing layers: {e}")
        return []

def extract_layer(layer_name):
    """Extract a layer from the geodatabase and convert to GeoJSON"""
    try:
        import fiona
        import geopandas as gpd
        from shapely.geometry import mapping
        
        logger.info(f"Processing layer: {layer_name}")
        
        # Read the layer with GeoPandas
        gdf = gpd.read_file(GDB_PATH, layer=layer_name)
        
        if len(gdf) == 0:
            logger.warning(f"Layer {layer_name} is empty, skipping")
            return None
        
        # Generate a clean layer ID
        layer_id = layer_name.replace(' ', '_').lower()
        
        # Add the Arabic label as a property to all features
        if layer_id in ARABIC_LABELS:
            gdf['arabic_label'] = ARABIC_LABELS.get(layer_id, layer_name)
        
        # Convert to GeoJSON
        geojson_path = os.path.join(OUTPUT_DIR, f"{layer_id}.geojson")
        
        # Try to extract styling information
        style_info = extract_style_info(layer_name, gdf)
        
        # Save style information if available
        if style_info:
            style_path = os.path.join(STYLE_DIR, f"{layer_id}_style.json")
            with open(style_path, "w", encoding="utf-8") as f:
                json.dump(style_info, f, indent=2, ensure_ascii=False)
        
        # Save as GeoJSON
        gdf.to_file(geojson_path, driver="GeoJSON")
        
        # Add layer to the list
        layer_info = {
            "id": layer_id,
            "name": ARABIC_LABELS.get(layer_id, layer_name),
            "filename": f"{layer_id}.geojson",
            "feature_count": len(gdf),
            "has_style": bool(style_info),
            "geometry_type": gdf.geometry.iloc[0].geom_type if not gdf.empty else None,
            "properties": list(gdf.columns)
        }
        
        logger.info(f"Converted layer {layer_name} to GeoJSON with {len(gdf)} features")
        return layer_info
    except Exception as e:
        logger.error(f"Error processing layer {layer_name}: {e}")
        return None

def extract_style_info(layer_name, gdf):
    """Extract styling information from the layer"""
    # Check geometry type to set appropriate defaults
    geometry_type = None
    if not gdf.empty:
        geometry_type = gdf.geometry.iloc[0].geom_type
    
    # Clean layer name for mapping
    layer_id = layer_name.replace(' ', '_').lower()
    
    # Set default styles based on geometry type
    default_style = {
        "weight": 2,
        "opacity": 1,
        "fillOpacity": 0.5
    }
    
    # Determine color based on layer name
    layer_color = LAYER_COLORS.get(layer_id, None)
    
    if not layer_color:
        # Default colors if layer name not recognized
        if geometry_type == 'Polygon' or geometry_type == 'MultiPolygon':
            layer_color = '#3388ff'  # Blue for polygons
        elif geometry_type == 'LineString' or geometry_type == 'MultiLineString':
            layer_color = '#ff7800'  # Orange for lines
        elif geometry_type == 'Point' or geometry_type == 'MultiPoint':
            layer_color = '#e41a1c'  # Red for points
        else:
            layer_color = '#808080'  # Gray for unknown types
    
    # Adjust defaults based on geometry type
    if geometry_type == 'Polygon' or geometry_type == 'MultiPolygon':
        default_style["fillColor"] = layer_color
        default_style["color"] = "#000000"
        default_style["weight"] = 1
        default_style["fillOpacity"] = 0.7
    elif geometry_type == 'LineString' or geometry_type == 'MultiLineString':
        default_style["color"] = layer_color
        default_style["weight"] = 3 
    elif geometry_type == 'Point' or geometry_type == 'MultiPoint':
        default_style["radius"] = 6
        default_style["fillColor"] = layer_color
        default_style["color"] = "#000000"
        default_style["weight"] = 1
        default_style["fillOpacity"] = 0.8
    
    style_info = {
        "type": "default",
        "geometry_type": geometry_type,
        "property_styles": {},
        "default_style": default_style,
        "layer_name": ARABIC_LABELS.get(layer_id, layer_name),
        "original_name": layer_name
    }
    
    # Add feature labeling information
    label_fields = ['arabic_label', 'name', 'label', 'NAME', 'LABEL', 'NAME_AR', 'ARABIC']
    
    style_info["labels"] = {
        "fields": label_fields,
        "font": "14px Arial",
        "color": "#333333",
        "haloColor": "#ffffff",
        "haloWidth": 2,
        "default_field": "arabic_label"
    }
    
    # Check for styling attributes in the dataframe
    style_columns = []
    
    # Common style-related column names
    style_attrs = [
        'COLOR', 'SYMBOL', 'WIDTH', 'STYLE', 'FILL', 'STROKE', 'OUTLINE', 
        'TYPE', 'CATEGORY', 'CLASS', 'CODE', 'STATUS', 'KIND', 'FUNCTION', 
        'USE', 'LEVEL', 'IMPORTANCE'
    ]
    
    # Find columns that might contain style info (more lenient matching)
    for col in gdf.columns:
        col_upper = col.upper()
        if any(attr in col_upper for attr in style_attrs):
            style_columns.append(col)
    
    # If no style columns found, try to use columns with few unique values
    if not style_columns:
        for col in gdf.columns:
            if col.lower() not in ['geometry', 'shape', 'objectid', 'fid', 'id', 'arabic_label']:
                try:
                    unique_count = gdf[col].nunique()
                    if 1 < unique_count <= min(10, len(gdf) / 5):
                        style_columns.append(col)
                except:
                    continue
    
    # If we found potential style columns, analyze them
    if style_columns:
        for col in style_columns:
            try:
                # Get unique values and their counts
                value_counts = gdf[col].value_counts()
                
                # Only use for styling if there's more than one value 
                # and less than 30% of the total features
                if 1 < len(value_counts) <= min(20, len(gdf) * 0.3):
                    unique_values = value_counts.index.tolist()
                    
                    # Create a style entry for this property
                    style_info["property_styles"][col] = {
                        "type": "categorical",
                        "field": col,
                        "values": {}
                    }
                    
                    # Predefined color schemes for specific feature types
                    preset_colors = {
                        'road': ['#999999', '#666666', '#333333', '#FF7F00', '#E31A1C'],
                        'building': ['#A8A8A8', '#CCCCCC', '#666666', '#333333', '#DFDFDF'],
                        'water': ['#3B7AB8', '#6BAED6', '#9ECAE1', '#C6DBEF', '#2171B5'],
                        'electricity': ['#FFD700', '#FFC125', '#DAA520', '#B8860B', '#8B6914'],
                        'waste': ['#6A5ACD', '#483D8B', '#7B68EE', '#9370DB', '#8A2BE2'],
                        'telecom': ['#9932CC', '#BF3EFF', '#9F79EE', '#8B7B8B', '#8968CD'],
                    }
                    
                    # Determine which color scheme to use
                    color_scheme = None
                    for key, scheme in preset_colors.items():
                        if key in layer_id:
                            color_scheme = scheme
                            break
                    
                    # Generate or select colors for each unique value
                    for i, val in enumerate(unique_values):
                        if val is not None:
                            # Determine color
                            if color_scheme and i < len(color_scheme):
                                color = color_scheme[i]
                            else:
                                # Generate a color using golden ratio method for visual distinction
                                hue = (i * 137.508) % 360
                                r, g, b = colorsys.hsv_to_rgb(hue / 360, 0.7, 0.9)
                                color = f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"
                            
                            # Create a style for this value
                            value_style = {}
                            
                            if geometry_type == 'Polygon' or geometry_type == 'MultiPolygon':
                                value_style["fillColor"] = color
                                value_style["color"] = "#000000"
                                value_style["weight"] = 1
                                value_style["fillOpacity"] = 0.7
                            elif geometry_type == 'LineString' or geometry_type == 'MultiLineString':
                                value_style["color"] = color
                                # Adjust line width based on importance if possible
                                if 'type' in col.lower() or 'class' in col.lower() or 'importance' in col.lower():
                                    try:
                                        # Try to convert value to number for width
                                        if isinstance(val, (int, float)):
                                            width = min(max(val, 1), 8)  # Constrain between 1-8
                                            value_style["weight"] = width
                                        # For text categories, use position in the list
                                        else:
                                            normalized_pos = (i / len(unique_values)) * 5 + 1
                                            value_style["weight"] = normalized_pos
                                    except:
                                        pass
                            elif geometry_type == 'Point' or geometry_type == 'MultiPoint':
                                value_style["fillColor"] = color
                                value_style["radius"] = 6 + i % 4  # Vary radius slightly
                            
                            style_info["property_styles"][col]["values"][str(val)] = value_style
            except Exception as e:
                logger.warning(f"Error processing style column {col}: {e}")
    
    return style_info

def update_layer_index(layers):
    """Update the layer index file with new layers"""
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
    for layer in layers:
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
    """Main function to extract all requested layers"""
    logger.info("=== Additional Layers Extraction Tool ===")
    
    # List all available layers in the geodatabase
    available_layers = list_gdb_layers()
    
    # Define the layers we want to extract
    target_layers = [
        "routes", "classification", "waste_water", "telecom", 
        "housing", "clean_water", "swm", "electricity", "nieghborhood"
    ]
    
    # Extract each requested layer if available
    extracted_layers = []
    for layer_name in available_layers:
        # Check if this is one of our target layers
        clean_name = layer_name.replace(' ', '_').lower()
        for target in target_layers:
            if target in clean_name or clean_name in target:
                layer_info = extract_layer(layer_name)
                if layer_info:
                    extracted_layers.append(layer_info)
                break
    
    # Update layer index with new layers
    if extracted_layers:
        update_layer_index(extracted_layers)
    else:
        logger.warning("No layers were extracted!")
    
    logger.info("Processing complete!")

if __name__ == "__main__":
    main()