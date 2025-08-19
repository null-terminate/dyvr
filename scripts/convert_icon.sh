#!/bin/bash

# Script to convert PNG icon to ICNS format for Mac App Store
# Usage: ./convert_icon.sh path/to/icon.png

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 path/to/icon.png"
    exit 1
fi

# Check if input file exists
if [ ! -f "$1" ]; then
    echo "Error: File $1 does not exist"
    exit 1
fi

# Get the filename without extension
FILENAME=$(basename -- "$1")
FILENAME="${FILENAME%.*}"

# Create temporary iconset directory
ICONSET="$FILENAME.iconset"
mkdir -p "$ICONSET"

# Generate different icon sizes
sips -z 16 16     "$1" --out "$ICONSET/icon_16x16.png"
sips -z 32 32     "$1" --out "$ICONSET/icon_16x16@2x.png"
sips -z 32 32     "$1" --out "$ICONSET/icon_32x32.png"
sips -z 64 64     "$1" --out "$ICONSET/icon_32x32@2x.png"
sips -z 128 128   "$1" --out "$ICONSET/icon_128x128.png"
sips -z 256 256   "$1" --out "$ICONSET/icon_128x128@2x.png"
sips -z 256 256   "$1" --out "$ICONSET/icon_256x256.png"
sips -z 512 512   "$1" --out "$ICONSET/icon_256x256@2x.png"
sips -z 512 512   "$1" --out "$ICONSET/icon_512x512.png"
sips -z 1024 1024 "$1" --out "$ICONSET/icon_512x512@2x.png"

# Convert iconset to icns
iconutil -c icns "$ICONSET"

# Clean up
rm -rf "$ICONSET"

echo "Icon successfully converted to $FILENAME.icns"
echo "Place this file in the appropriate location and update your references"
