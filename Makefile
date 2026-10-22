# ===========================================================================
# Hierarchy Mirror Studio — Makefile
# Targets:
#   all: Builds native C++ executable
#   native: Builds tree_mirror.exe using g++
#   wasm: Builds tree_mirror.wasm using Node.js/wabt
#   emscripten: Compiles tree_mirror.cpp using emcc (if installed)
#   test: Runs native C++ verification test suite
#   clean: Cleans build artifacts
# ===========================================================================

CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2

.PHONY: all native wasm emscripten test clean

all: native wasm

native: tree_mirror.exe

tree_mirror.exe: tree_mirror.cpp
	$(CXX) $(CXXFLAGS) tree_mirror.cpp -o tree_mirror.exe

test: native
	./tree_mirror.exe

wasm:
	node build_wasm.js

emscripten:
	emcc tree_mirror.cpp -std=c++17 -O3 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
		-s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" \
		-s EXPORTED_FUNCTIONS="['_cpp_mirror_tree','_cpp_free_buffer','_malloc','_free']" \
		-o tree_mirror_emscripten.js

clean:
	rm -f tree_mirror.exe tree_mirror_emscripten.js tree_mirror_emscripten.wasm
