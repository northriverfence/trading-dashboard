#!/bin/bash
# build.sh - Manual build script for hnswlib-bun

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PLATFORM=$(uname -s)
ARCH=$(uname -m)
OUTPUT_DIR="$SCRIPT_DIR/build"
HNSWLIB_DIR="$SCRIPT_DIR/hnswlib"

echo "Building hnswlib-bun..."
echo "Platform: $PLATFORM"
echo "Architecture: $ARCH"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Download hnswlib if not exists
if [ ! -d "$HNSWLIB_DIR" ]; then
    echo "Downloading hnswlib..."
    git clone --depth 1 https://github.com/nmslib/hnswlib.git "$HNSWLIB_DIR"
fi

SOURCE_FILE="$SCRIPT_DIR/cpp/hnswlib_wrapper.cpp"

if [ "$PLATFORM" = "Linux" ]; then
    OUTPUT_FILE="$OUTPUT_DIR/libhnswlib-${ARCH}.so"
    echo "Building for Linux..."
    echo "Output: $OUTPUT_FILE"

    g++ -shared -fPIC -O3 -std=c++17 \
        -I/usr/include/eigen3 \
        -I./hnswlib \
        -o "$OUTPUT_FILE" \
        "$SOURCE_FILE"

    echo "✓ Built $OUTPUT_FILE"

elif [ "$PLATFORM" = "Darwin" ]; then
    OUTPUT_FILE="$OUTPUT_DIR/libhnswlib-${ARCH}.dylib"
    echo "Building for macOS..."
    echo "Output: $OUTPUT_FILE"

    clang++ -dynamiclib -fPIC -O3 -std=c++17 \
        -I/opt/homebrew/include/eigen3 \
        -I/usr/local/include/eigen3 \
        -I./hnswlib \
        -o "$OUTPUT_FILE" \
        "$SOURCE_FILE"

    echo "✓ Built $OUTPUT_FILE"
else
    echo "Unsupported platform: $PLATFORM"
    exit 1
fi

echo ""
echo "✓ Build complete!"
echo "Library: $OUTPUT_FILE"
