import os
import json
import logging
from flask import Flask, render_template, jsonify, request, send_from_directory, abort
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "homs-map-app-secret")

# Directories
GEOJSON_DIR = os.path.join(app.static_folder, 'data')
STYLE_DIR = os.path.join(app.static_folder, 'styles')
IMAGE_DIR = os.path.join(app.static_folder, 'images')

# Ensure directories exist
os.makedirs(GEOJSON_DIR, exist_ok=True)
os.makedirs(STYLE_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

# Load map info if available
MAP_INFO_PATH = os.path.join(GEOJSON_DIR, 'map_info.json')
MAP_INFO = {
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

if os.path.exists(MAP_INFO_PATH):
    try:
        with open(MAP_INFO_PATH, 'r', encoding='utf-8') as f:
            MAP_INFO = json.load(f)
    except Exception as e:
        logger.error(f"Error loading map info: {e}")

@app.route('/')
def index():
    """Render the main map page"""
    return render_template('index.html', map_info=MAP_INFO)

@app.route('/report')
def report():
    """Render the report template"""
    return render_template('report.html', map_info=MAP_INFO)

@app.route('/api/map-info')
def get_map_info():
    """Return map information"""
    return jsonify(MAP_INFO)

@app.route('/api/geojson-layers')
def get_geojson_layers():
    """Return a list of available GeoJSON layers"""
    # First check if we have a layers.json index file
    index_path = os.path.join(GEOJSON_DIR, 'layers.json')
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                layers = json.load(f)
                return jsonify(layers)
        except Exception as e:
            logger.error(f"Error reading layers index: {e}")
    
    # Fall back to scanning the directory
    layers = []
    
    # Get all GeoJSON files in the data directory
    for file_path in Path(GEOJSON_DIR).glob('*.geojson'):
        layer_id = file_path.stem
        
        # Check if we have style information for this layer
        style_path = os.path.join(STYLE_DIR, f"{layer_id}_style.json")
        has_style = os.path.exists(style_path)
        
        # Count features in the GeoJSON file
        feature_count = 0
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                feature_count = len(data.get('features', []))
        except Exception as e:
            logger.error(f"Error counting features in {file_path}: {e}")
        
        layers.append({
            'id': layer_id,
            'name': layer_id.replace('_', ' ').title(),
            'filename': file_path.name,
            'feature_count': feature_count,
            'has_style': has_style
        })
    
    return jsonify(layers)

@app.route('/api/geojson/<filename>')
def get_geojson(filename):
    """Serve a specific GeoJSON file"""
    try:
        # Ensure filename only contains valid characters and ends with .geojson
        if not filename.endswith('.geojson') or '..' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
            
        filepath = os.path.join(GEOJSON_DIR, filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error loading GeoJSON: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/layer-style/<layer_id>')
def get_layer_style(layer_id):
    """Return style information for a layer"""
    try:
        # Ensure layer_id doesn't contain directory traversal
        if '..' in layer_id:
            return jsonify({'error': 'Invalid layer ID'}), 400
            
        style_path = os.path.join(STYLE_DIR, f"{layer_id}_style.json")
        
        if not os.path.exists(style_path):
            # Return default styling if no specific style exists
            return jsonify({
                "type": "default",
                "default_style": {
                    "color": "#3388ff",
                    "weight": 2,
                    "opacity": 1,
                    "fillOpacity": 0.2
                }
            })
            
        with open(style_path, 'r', encoding='utf-8') as f:
            style_data = json.load(f)
            
        return jsonify(style_data)
    except Exception as e:
        logger.error(f"Error loading layer style: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/layer-properties/<filename>')
def get_layer_properties(filename):
    """Return unique property names from a GeoJSON file"""
    try:
        # Ensure filename only contains valid characters and ends with .geojson
        if not filename.endswith('.geojson') or '..' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
            
        filepath = os.path.join(GEOJSON_DIR, filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
            
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        properties = set()
        for feature in data.get('features', []):
            if feature.get('properties'):
                properties.update(feature['properties'].keys())
                
        return jsonify(list(properties))
    except Exception as e:
        logger.error(f"Error extracting properties: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """Generate a report based on selected features"""
    try:
        data = request.json
        layer_id = data.get('layerId')
        selected_features = data.get('features', [])
        
        if not layer_id or not selected_features:
            return jsonify({'error': 'Missing required data'}), 400
        
        # Get the layer name from the layers list if available
        layer_name = layer_id.replace('_', ' ').title()
        try:
            index_path = os.path.join(GEOJSON_DIR, 'layers.json')
            if os.path.exists(index_path):
                with open(index_path, 'r', encoding='utf-8') as f:
                    layers = json.load(f)
                    for layer in layers:
                        if layer.get('id') == layer_id and layer.get('name'):
                            layer_name = layer['name']
                            break
        except Exception as e:
            logger.error(f"Error getting layer name: {e}")
            
        # Process the features and generate report data
        report_data = {
            'layerName': layer_name,
            'featureCount': len(selected_features),
            'features': selected_features,
            'mapTitle': MAP_INFO.get('title', 'Homs Map'),
            'mapDescription': MAP_INFO.get('description', 'Map of Homs, Syria')
        }
        
        return jsonify(report_data)
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-mpk', methods=['POST'])
def api_extract_mpk():
    """API endpoint to trigger MPK extraction"""
    try:
        from extract_mpk import main as extract_main
        extract_main()
        return jsonify({"status": "success", "message": "MPK file extracted successfully"})
    except Exception as e:
        logger.error(f"Error extracting MPK: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
