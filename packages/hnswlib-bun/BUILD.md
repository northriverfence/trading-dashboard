# Building hnswlib-bun

## Prerequisites

Install build tools and Eigen3:

```bash
# Ubuntu/Debian
sudo apt-get install build-essential libeigen3-dev git

# macOS
brew install eigen git

# Fedora/RHEL
sudo dnf install gcc-c++ eigen3-devel git
```

## Build Steps

### Option 1: Using the build script
```bash
cd /opt/dev/trading-dashboard/packages/hnswlib-bun
bun run build
```

### Option 2: Manual build

1. Download hnswlib headers:
```bash
git clone --depth 1 https://github.com/nmslib/hnswlib.git
```

2. Compile the wrapper:
```bash
# Linux
g++ -shared -fPIC -O3 -std=c++17 \
  -I/usr/include/eigen3 \
  -I./hnswlib \
  -o build/libhnswlib-x64.so \
  cpp/hnswlib_wrapper.cpp

# macOS
clang++ -dynamiclib -fPIC -O3 -std=c++17 \
  -I/opt/homebrew/include/eigen3 \
  -I/usr/local/include/eigen3 \
  -I./hnswlib \
  -o build/libhnswlib-arm64.dylib \
  cpp/hnswlib_wrapper.cpp
```

## Test

```bash
bun test
```

## Troubleshooting

**Error: eigen3 not found**
- Ubuntu: `sudo apt-get install libeigen3-dev`
- macOS: `brew install eigen`

**Error: hnswlib headers not found**
- Make sure you cloned the hnswlib repo in the package directory

**Build succeeds but tests fail**
- Check that the library file exists in `build/` directory
- Ensure the platform/arch matches (check filename)
