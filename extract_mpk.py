import os
import json
import logging
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
import colorsys
import glob

import fiona
import geopandas as gpd
from arcgis2geojson import arcgis2geojson
from shapely.geometry import mapping

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
MPK_FILE = "attached_assets/homs.mpk"
EXTRACT_DIR = "mpk_extract"
DATA_DIR = "static/data"
STYLE_DIR = "static/styles"
LABELS_DIR = "static/labels"
# Use the v105 version which has more complete data
GDB_PATH = os.path.join(EXTRACT_DIR, "v105/homspub.gdb") 
MXD_PATH = os.path.join(EXTRACT_DIR, "v105/homs.mxd")
THUMBNAIL_PATH = os.path.join(EXTRACT_DIR, "esriinfo/thumbnail/thumbnail.png")
MAP_INFO_PATH = os.path.join(EXTRACT_DIR, "esriinfo/iteminfo.xml")

# Ensure directories exist
os.makedirs(EXTRACT_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(STYLE_DIR, exist_ok=True)
os.makedirs("static/images", exist_ok=True)

def check_extracted_files():
    """Check if the MPK file was already extracted"""
    if os.path.exists(GDB_PATH) and os.path.exists(MXD_PATH):
        logger.info("MPK files already extracted")
        return True
    return False

def extract_mpk():
    """Extract the MPK file using 7z"""
    if check_extracted_files():
        return True
        
    logger.info(f"Extracting {MPK_FILE} using 7z...")
    
    try:
        result = subprocess.run(["7z", "x", MPK_FILE, "-o" + EXTRACT_DIR], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            logger.info("Extraction successful!")
            
            # Copy thumbnail for later use if it exists
            if os.path.exists(THUMBNAIL_PATH):
                os.makedirs("static/images", exist_ok=True)
                subprocess.run(["cp", THUMBNAIL_PATH, "static/images/homs_thumbnail.png"])
                logger.info("Thumbnail copied to static/images/")
                
            return True
        else:
            logger.error(f"Extraction failed: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Extraction failed with exception: {e}")
        return False

def get_map_info():
    """Extract map information from the metadata"""
    map_info = {
        "title": "Homs Map",
        "description": "Map of Homs, Syria",
        "extent": {
            "xmin": 36.5880878006287,
            "ymin": 34.6799548134312,
            "xmax": 36.7711339108812,
            "ymax": 34.7896548639074
        },
        "spatialReference": "GCS_WGS_1984"
    }
    
    try:
        if os.path.exists(MAP_INFO_PATH):
            tree = ET.parse(MAP_INFO_PATH)
            root = tree.getroot()
            
            # Extract basic information
            if root.find('title') is not None:
                map_info["title"] = root.find('title').text
            if root.find('description') is not None:
                map_info["description"] = root.find('description').text
            if root.find('spatialreference') is not None:
                map_info["spatialReference"] = root.find('spatialreference').text
                
            # Extract extent information
            extent_elem = root.find('extent')
            if extent_elem is not None:
                try:
                    map_info["extent"] = {
                        "xmin": float(extent_elem.find('xmin').text),
                        "ymin": float(extent_elem.find('ymin').text),
                        "xmax": float(extent_elem.find('xmax').text),
                        "ymax": float(extent_elem.find('ymax').text)
                    }
                except (AttributeError, ValueError) as e:
                    logger.warning(f"Could not parse extent properly: {e}")
            
            logger.info(f"Map info extracted: {map_info['title']}")
    except Exception as e:
        logger.error(f"Error extracting map info: {e}")
    
    # Save map info for frontend
    with open(os.path.join(DATA_DIR, "map_info.json"), "w", encoding="utf-8") as f:
        json.dump(map_info, f, indent=2)
        
    return map_info

def find_all_geodatabases():
    """Find all geodatabases in the extracted MPK file"""
    gdbs = []
    
    # Look for .gdb directories in both v10 and v105 folders
    for version_dir in ['v10', 'v105']:
        base_dir = os.path.join(EXTRACT_DIR, version_dir)
        if os.path.exists(base_dir):
            for item in os.listdir(base_dir):
                item_path = os.path.join(base_dir, item)
                if os.path.isdir(item_path) and item.endswith('.gdb'):
                    gdbs.append(item_path)
    
    return gdbs

def extract_layers_from_gdb():
    """Extract layers from the geodatabase and convert to GeoJSON"""
    all_layers = []
    
    # Try to find all geodatabases
    gdbs = find_all_geodatabases()
    if not gdbs:
        logger.error("No geodatabases found in the extracted MPK file")
        return []
    
    # First try the default GDB_PATH specified at the top
    if os.path.exists(GDB_PATH):
        gdbs.insert(0, GDB_PATH)  # Make sure it's processed first
    
    # Process each geodatabase
    for gdb_path in gdbs:
        logger.info(f"Extracting layers from geodatabase: {gdb_path}")
        
        try:
            # List all layers in the geodatabase
            layer_names = fiona.listlayers(gdb_path)
            logger.info(f"Found {len(layer_names)} layers in geodatabase: {', '.join(layer_names)}")
            
            # Process each layer
            for layer_name in layer_names:
                try:
                    # Skip system tables which often start with 'a0'
                    if layer_name.startswith('a0'):
                        continue
                        
                    logger.info(f"Processing layer: {layer_name}")
                    
                    # Read the layer with GeoPandas
                    gdf = gpd.read_file(gdb_path, layer=layer_name)
                    
                    if len(gdf) == 0:
                        logger.warning(f"Layer {layer_name} is empty, skipping")
                        continue
                    
                    # Generate a clean layer ID
                    layer_id = layer_name.replace(' ', '_').lower()
                    
                    # Convert to GeoJSON
                    geojson_path = os.path.join(DATA_DIR, f"{layer_id}.geojson")
                    
                    # Try to extract styling information
                    style_info = extract_style_info(layer_name, gdf)
                    
                    # Try to extract label information if it's a point or polygon layer
                    geometry_type = None
                    if not gdf.empty:
                        geometry_type = gdf.geometry.iloc[0].geom_type
                    
                    # Save style information if available
                    if style_info:
                        style_path = os.path.join(STYLE_DIR, f"{layer_id}_style.json")
                        with open(style_path, "w", encoding="utf-8") as f:
                            json.dump(style_info, f, indent=2)
                    
                    # Save as GeoJSON
                    gdf.to_file(geojson_path, driver="GeoJSON")
                    
                    # Add layer to the list
                    layers_entry = {
                        "id": layer_id,
                        "name": layer_name,
                        "filename": f"{layer_id}.geojson",
                        "feature_count": len(gdf),
                        "has_style": bool(style_info),
                        "geometry_type": geometry_type,
                        "properties": list(gdf.columns)
                    }
                    
                    # If this layer ID already exists in the all_layers list,
                    # keep the one with more features
                    existing_layer = next((l for l in all_layers if l["id"] == layer_id), None)
                    if existing_layer:
                        if len(gdf) > existing_layer["feature_count"]:
                            # Replace the existing entry
                            all_layers.remove(existing_layer)
                            all_layers.append(layers_entry)
                    else:
                        all_layers.append(layers_entry)
                    
                    logger.info(f"Converted layer {layer_name} to GeoJSON with {len(gdf)} features")
                except Exception as e:
                    logger.error(f"Error processing layer {layer_name}: {e}")
        except Exception as e:
            logger.error(f"Error listing layers in geodatabase {gdb_path}: {e}")
    
    return all_layers

def extract_style_info(layer_name, gdf):
    """Extract styling information from the layer"""
    # Check geometry type to set appropriate defaults
    geometry_type = None
    if not gdf.empty:
        geometry_type = gdf.geometry.iloc[0].geom_type
    
    # Determine layer-specific styling
    layer_specific_colors = {
        # Layer name to color mapping - manually determined from original MPK
        'nieghborhood': '#B9CF96',  # Light green for neighborhoods
        'neighborhoood': '#B9CF96',  # Alternative spelling
        'neighborhood': '#B9CF96',   # Another alternative spelling
        'routes': '#FF7F00',         # Orange for roads/routes
        'routeswgs': '#FF7F00',      # Alternative name
        'road': '#FF7F00',           # Alternative name
        'roads': '#FF7F00',          # Alternative name
        'building': '#A8A8A8',       # Gray for buildings
        'buildings': '#A8A8A8',      # Alternative name
        'landmark': '#E63A24',       # Red for landmarks
        'landmarks': '#E63A24',      # Alternative name  
        'poi': '#E63A24',            # Alternative name (Points of Interest)
        'landuse': '#2BAB45',        # Green for land use
        'land_use': '#2BAB45',       # Alternative name
        'water': '#3B7AB8',          # Blue for water features
        'waterbody': '#3B7AB8',      # Alternative name
    }
    
    # Set default styles based on geometry type
    default_style = {
        "weight": 2,
        "opacity": 1,
        "fillOpacity": 0.5
    }
    
    # Determine color based on layer name
    layer_name_lower = layer_name.lower()
    layer_color = None
    
    for name_part, color in layer_specific_colors.items():
        if name_part in layer_name_lower:
            layer_color = color
            break
    
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
        "layer_name": layer_name
    }
    
    # Add feature labeling information based on geometry type
    label_fields = []
    
    # Check for common label fields in the layer
    potential_label_fields = ['name', 'label', 'title', 'id', 'type', 'class', 'number', 'street', 'address']
    for field in potential_label_fields:
        for col in gdf.columns:
            if field.lower() in col.lower():
                label_fields.append(col)
                break
    
    if label_fields:
        style_info["labels"] = {
            "fields": label_fields,
            "font": "12px Arial",
            "color": "#333333",
            "haloColor": "#ffffff",
            "haloWidth": 2
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
            if col.lower() not in ['geometry', 'shape', 'objectid', 'fid', 'id']:
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
                        'landuse': ['#2BAB45', '#66C266', '#B3E3B3', '#78AB46', '#ADFA96'],
                        'water': ['#3B7AB8', '#6BAED6', '#9ECAE1', '#C6DBEF', '#2171B5'],
                        'landmark': ['#E63A24', '#FC4E2A', '#FD8D3C', '#FDBB84', '#E6550D']
                    }
                    
                    # Determine which color scheme to use
                    color_scheme = None
                    for key, scheme in preset_colors.items():
                        if key in layer_name.lower():
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

def create_layer_index(layers):
    """Create a layer index file listing all available GeoJSON files"""
    if not layers:
        logger.warning("No layers were extracted. Layer index not generated.")
        return
    
    logger.info("Creating layer index file...")
    
    index_file = os.path.join(DATA_DIR, "layers.json")
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(layers, f, indent=2)
    
    logger.info(f"Layer index created with {len(layers)} layers")

def main():
    """Main function to extract and convert MPK file"""
    logger.info("=== MPK Extraction and Conversion Tool ===")
    
    # Extract the MPK file
    if not extract_mpk():
        return
    
    # Get map information
    map_info = get_map_info()
    
    # Extract layers from geodatabase
    layers = extract_layers_from_gdb()
    
    if not layers:
        logger.warning("No layers were extracted from the geodatabase")
        
        # Try to find any JSON files as a fallback
        logger.info("Looking for alternative JSON files...")
        # This is where we'd use the old approach
        # But for now, we'll just log it
        logger.info("No alternative JSON files process implemented yet")
    
    # Create layer index
    create_layer_index(layers)
    
    logger.info("Processing complete!")

if __name__ == "__main__":
    main()