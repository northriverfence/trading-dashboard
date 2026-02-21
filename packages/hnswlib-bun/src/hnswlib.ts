// src/hnswlib.ts
// Low-level FFI bindings to hnswlib C++ library

import { dlopen, FFIType, ptr, CString } from "bun:ffi";
import { join } from "path";

// Determine library path based on platform
function getLibraryPath(): string {
  const platform = process.platform;
  const arch = process.arch;

  const buildDir = join(import.meta.dir, "..", "build");

  switch (platform) {
    case "linux":
      return join(buildDir, `libhnswlib-${arch}.so`);
    case "darwin":
      return join(buildDir, `libhnswlib-${arch}.dylib`);
    case "win32":
      return join(buildDir, `hnswlib-${arch}.dll`);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Load the shared library
const libPath = getLibraryPath();

const lib = dlopen(libPath, {
  // Index creation
  createIndex: {
    args: [FFIType.cstring, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.u32, FFIType.u32],
    returns: FFIType.ptr,
  },

  // Index destruction
  freeIndex: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },

  // Add vector
  addVector: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.u32],
    returns: FFIType.void,
  },

  // Search KNN
  searchKnn: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.ptr],
    returns: FFIType.void,
  },

  // Mark delete
  markDelete: {
    args: [FFIType.ptr, FFIType.u32],
    returns: FFIType.void,
  },

  // Resize index
  resizeIndex: {
    args: [FFIType.ptr, FFIType.u32],
    returns: FFIType.void,
  },

  // Get current count
  getCurrentCount: {
    args: [FFIType.ptr],
    returns: FFIType.u32,
  },

  // Save/Load
  saveIndex: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.void,
  },

  loadIndex: {
    args: [FFIType.ptr, FFIType.cstring],
    returns: FFIType.void,
  },

  // Set ef parameter
  setEf: {
    args: [FFIType.ptr, FFIType.u32],
    returns: FFIType.void,
  },

  // Get last error
  getLastError: {
    args: [],
    returns: FFIType.cstring,
  },
});

export { lib };

// Helper function to convert space type to C string
export function spaceToCString(space: 'l2' | 'ip' | 'cosine'): string {
  switch (space) {
    case 'l2': return "l2";
    case 'ip': return "ip";
    case 'cosine': return "cosine";
  }
}

// Helper to check for errors
export function checkError(): void {
  const errorPtr = lib.symbols.getLastError();
  if (errorPtr) {
    const error = new CString(errorPtr);
    if (error.length > 0) {
      throw new Error(`hnswlib error: ${error}`);
    }
  }
}
