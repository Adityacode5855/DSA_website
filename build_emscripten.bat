@echo off
REM ===========================================================================
REM Hierarchy Mirror Studio — Emscripten WebAssembly Build Script (Windows)
REM ===========================================================================

echo [Hierarchy Mirror Studio] Checking for Emscripten (emcc)...

where emcc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Emscripten compiler (emcc) not found in system PATH.
    echo To build using Emscripten:
    echo   1. Install emsdk from https://github.com/emscripten-core/emsdk
    echo   2. Run: emsdk install latest ^&^& emsdk activate latest
    echo   3. Run: emsdk_env.bat
    echo.
    echo NOTE: Hierarchy Mirror Studio ALREADY includes a compiled WebAssembly binary
    echo (tree_mirror.wasm) and standalone native C++ executable (tree_mirror.exe).
    echo You can run the application directly!
    pause
    exit /b 1
)

echo [Hierarchy Mirror Studio] Compiling tree_mirror.cpp to WebAssembly...
emcc tree_mirror.cpp ^
    -std=c++17 ^
    -O3 ^
    -s WASM=1 ^
    -s ALLOW_MEMORY_GROWTH=1 ^
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" ^
    -s EXPORTED_FUNCTIONS="['_cpp_mirror_tree','_cpp_free_buffer','_malloc','_free']" ^
    -o tree_mirror_emscripten.js

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Successfully compiled tree_mirror_emscripten.js and tree_mirror_emscripten.wasm!
) else (
    echo [ERROR] Emscripten compilation failed.
)

pause
