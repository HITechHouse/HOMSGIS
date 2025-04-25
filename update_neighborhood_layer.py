#!/usr/bin/env python
"""
Update neighborhood layer with data from test.json to ensure all the required columns are present.
"""
import json
import os

def convert_esri_to_geojson(input_file, output_file):
    """
    Convert ESRI JSON to GeoJSON format, preserving all properties.
    """
    print(f"Converting {input_file} to GeoJSON format...")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            esri_json = json.load(f)
            
        # Create GeoJSON structure
        geojson = {
            "type": "FeatureCollection",
            "features": []
        }
        
        if "features" not in esri_json:
            print("Error: Input file doesn't have features array")
            return False
            
        # Process each feature
        for feature in esri_json["features"]:
            if "attributes" not in feature or "geometry" not in feature:
                continue
                
            geojson_feature = {
                "type": "Feature",
                "properties": feature["attributes"],
                "geometry": convert_esri_geometry(feature["geometry"])
            }
            
            # Add display properties for the map
            if "ADM4_NAME_" in feature["attributes"]:
                geojson_feature["properties"]["arabic_label"] = feature["attributes"]["ADM4_NAME_"]
            if "ADM4_NAME" in feature["attributes"]:
                geojson_feature["properties"]["neighborhood"] = feature["attributes"]["ADM4_NAME"]
            if "OverAllIndicator" in feature["attributes"]:
                geojson_feature["properties"]["OverAllIndicator"] = feature["attributes"]["OverAllIndicator"]
                
            geojson["features"].append(geojson_feature)
            
        # Write GeoJSON to file
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, ensure_ascii=False)
            
        print(f"Successfully converted to GeoJSON. Saved to {output_file}")
        return True
        
    except Exception as e:
        print(f"Error converting file: {e}")
        return False
        
def convert_esri_geometry(esri_geometry):
    """
    Convert ESRI geometry to GeoJSON geometry.
    """
    geojson_geometry = {}
    
    if "rings" in esri_geometry:
        # Polygon or MultiPolygon
        rings = esri_geometry["rings"]
        
        if len(rings) == 1:
            geojson_geometry = {
                "type": "Polygon",
                "coordinates": rings
            }
        else:
            geojson_geometry = {
                "type": "MultiPolygon",
                "coordinates": [rings]
            }
    elif "paths" in esri_geometry:
        # LineString or MultiLineString
        paths = esri_geometry["paths"]
        
        if len(paths) == 1:
            geojson_geometry = {
                "type": "LineString",
                "coordinates": paths[0]
            }
        else:
            geojson_geometry = {
                "type": "MultiLineString",
                "coordinates": paths
            }
    elif "points" in esri_geometry:
        # MultiPoint
        geojson_geometry = {
            "type": "MultiPoint",
            "coordinates": esri_geometry["points"]
        }
    elif "x" in esri_geometry and "y" in esri_geometry:
        # Point
        geojson_geometry = {
            "type": "Point",
            "coordinates": [esri_geometry["x"], esri_geometry["y"]]
        }
    
    return geojson_geometry

def main():
    input_file = "attached_assets/test.json"
    output_file = "static/data/neighborhood.geojson"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} does not exist.")
        return
        
    if convert_esri_to_geojson(input_file, output_file):
        print("Neighborhood layer updated successfully.")
    else:
        print("Failed to update neighborhood layer.")

if __name__ == "__main__":
    main()