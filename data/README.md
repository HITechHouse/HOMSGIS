# GeoJSON Data Directory

This directory contains GeoJSON data files for the Homs, Syria mapping application.

## Available Layers

1. **buildings.geojson** - Buildings and structures in Homs
2. **roads.geojson** - Road network of the city
3. **landmarks.geojson** - Points of interest and landmarks 
4. **land_use.geojson** - Land use zones and areas
5. **districts.geojson** - Administrative districts of Homs

## Data Structure

Each GeoJSON file follows the standard GeoJSON format with a FeatureCollection containing multiple features. Each feature has properties specific to its layer type.

## Map Package Extraction

The original map data came from an ESRI Map Package (MPK) file. The `extract_mpk.py` script in the root directory can be used to attempt extraction of additional data from the MPK file.

## Credits

This data is representative of the city of Homs, Syria, created for demonstration purposes in this web mapping application.