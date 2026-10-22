#!/usr/bin/env bash
# ===========================================================================
# Hierarchy Mirror Studio — Emscripten WebAssembly Build Script (Unix/macOS)
# ===========================================================================

set -e

echo "[Hierarchy Mirror Studio] Checking for Emscripten (emcc)..."

if ! command -v emcc &> /dev/null; then
    echo "[ERROR] Emscripten compiler (emcc) not found in system PATH."
    echo "To install Emscripten:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk && ./emsdk install latest && ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    echo ""
    echo "NOTE: Hierarchy Mirror Studio ALREADY includes a compiled WebAssembly binary"
    echo "(tree_mirror.wasm) and pre-built module (wasm_module.js)."
    exit 1
fi

echo "[Hierarchy Mirror Studio] Compiling tree_mirror.cpp to WebAssembly..."
emcc tree_mirror.cpp \
    -std=c++17 \
    -O3 \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" \
    -s EXPORTED_FUNCTIONS="['_cpp_mirror_tree','_cpp_free_buffer','_malloc','_free']" \
    -o tree_mirror_emscripten.js

echo "[SUCCESS] Successfully generated tree_mirror_emscripten.js and tree_mirror_emscripten.wasm!"
