# Hierarchy Mirror Studio — Interactive Binary Tree Visualizer

> **Course:** Data Structures and Algorithms (FA-2 Project)  
> **Problem Statement:** *Mirror a Binary Tree Using Recursion*  
> **Core Engine:** C++17 & WebAssembly (Linear Memory Runtime)  
> **Frontend:** HTML5, CSS3 Modern Design System, Vanilla ES6 JavaScript  

---

## 1. Project Overview & Practical Scenario

### The Problem
Given the root of a binary tree, recursively invert the tree so that the left and right subtrees of every node are swapped, producing an exact mirror reflection of the original hierarchy.

### The Practical Scenario
Modern diagramming and workflow software (such as Lucidchart, Miro, and Figma) frequently needs to **flip a hierarchical structure horizontally**:
1. **Localization for RTL Languages:** Converting Left-to-Right organizational charts, decision trees, and mind maps into Right-to-Left (e.g., for Arabic, Hebrew, Urdu locales).
2. **Compiler Abstract Syntax Trees (AST):** Reflecting symmetric binary expression trees during algebraic optimizations and commutative property verification.
3. **Balanced Visual Layouts:** Inverting branch flows in graphical layout engines to optimize canvas balance and node distribution.

---

## 2. Technology Stack & Architecture

| Component | Technology | Role & Functionality |
| :--- | :--- | :--- |
| **Structure** | HTML5 | Semantic dashboard layout, accessible SVG viewports, and modals. |
| **Styling** | CSS3 | Responsive design, CSS variables for Light/Dark themes, cubic Bezier curves, and keyframe animations. |
| **Visualizer & UI** | JavaScript (ES6) | Dynamic SVG layout engine, In-order coordinate mapper, zoom/pan controller, and call stack visualizer. |
| **Core Algorithm** | **C++17** (`tree_mirror.cpp`) | Production-grade binary tree data structure, recursive mirroring algorithm, level-order parser, and traversals. |
| **Browser Execution** | **WebAssembly** (`tree_mirror.wasm`) | Compiled bytecode executing the recursive pointer swap directly inside the browser's WebAssembly virtual machine. |

### WebAssembly & Emscripten Integration Details
- **Genuine In-Browser WebAssembly:** The binary tree nodes are instantiated inside the browser's 64 KB WebAssembly linear memory (`tree_mirror.wasm` / `wasm_module.js`). When "Mirror Tree" is invoked, the native WebAssembly function `$mirror` executes recursive pointer swaps on 32-bit linear memory offsets.
- **Native C++17 Standalone Executable:** `tree_mirror.cpp` is pre-compiled to `tree_mirror.exe` using MinGW GCC 6.3.0 (`-std=c++17 -O2`). It features an automated verification test suite and interactive CLI.
- **Emscripten Toolchain Support:** If Emscripten (`emcc`) is installed on your workstation, you can recompile `tree_mirror.cpp` to WebAssembly using `build_emscripten.bat` (Windows) or `build_emscripten.sh` (Linux/macOS).

---

## 3. The Core Recursive Mirror Algorithm

### Algorithm Logic
```cpp
/**
 * Recursively mirrors a binary tree.
 * Base case: If root is null, return null.
 * Recursive step: Invert left and right subtrees.
 * Pointer swap: Swap root->left and root->right.
 * Return: Swapped root.
 */
TreeNode* mirrorTreeRecursive(TreeNode* root) {
    // Base Case
    if (root == nullptr) {
        return nullptr;
    }

    // Step 1: Recursively mirror left subtree
    TreeNode* leftMirrored = mirrorTreeRecursive(root->left);

    // Step 2: Recursively mirror right subtree
    TreeNode* rightMirrored = mirrorTreeRecursive(root->right);

    // Step 3: Swap child pointers on the current node
    root->left = rightMirrored;
    root->right = leftMirrored;

    // Step 4: Return current node
    return root;
}
```

### Mathematical Induction Proof
1. **Base Step:** For an empty tree ($N=0$) or a leaf node ($N=1$ where `left=null` and `right=null`), swapping null pointers trivially produces the correct mirror reflection.
2. **Inductive Hypothesis:** Assume the algorithm correctly mirrors any subtree of height $< H$.
3. **Inductive Step:** For a tree of height $H$, the left subtree and right subtree have heights at most $H-1$. By the hypothesis, `mirror(root->left)` correctly mirrors the left subtree, and `mirror(root->right)` correctly mirrors the right subtree. Swapping these two subtrees and attaching them to `root` places all left descendants symmetrically on the right and all right descendants symmetrically on the left. Thus, by mathematical induction, the algorithm correctly inverts any binary tree.

### Fundamental DSA Invariance Theorem
> **Theorem:** The in-order traversal of a mirrored binary tree is mathematically identical to the reverse of the original tree's in-order traversal:
> $$\text{InOrder}(\text{Mirror}(T)) = \text{Reverse}(\text{InOrder}(T))$$
*Hierarchy Mirror Studio automatically computes and proves this property in real time for any input tree!*

---

## 4. Complexity Analysis

| Metric | Complexity | Explanation |
| :--- | :--- | :--- |
| **Time Complexity** | $\mathcal{O}(N)$ | Every node in the tree is visited exactly once. At each node, pointer reassignment is an $\mathcal{O}(1)$ constant-time operation. Total time: $T(N) = 2T(N/2) + \mathcal{O}(1) \implies \mathcal{O}(N)$. |
| **Auxiliary Space Complexity** | $\mathcal{O}(H)$ | Space consumed by the recursion call stack is proportional to tree height $H$. For balanced trees, $H = \lceil \log_2(N+1) \rceil \implies \mathcal{O}(\log N)$. For skewed trees, $H = N \implies \mathcal{O}(N)$. |
| **Tree Traversal Time** | $\mathcal{O}(N)$ | Level-order (BFS) and in-order (DFS) traversals both visit each node once. |

---

## 5. Main Dashboard Features

1. **Dual Visualizer Studio:**
   - **Left Card:** Original Binary Tree rendered with blue/cyan gradient nodes and cubic Bezier connecting branches.
   - **Center Reflection Line:** Visual mirror axis indicating the horizontal reflection plane.
   - **Right Card:** Mirrored Binary Tree rendered with violet/pink gradient nodes.
2. **Interactive Recursion Stepper & Call Stack Visualizer:**
   - Auto Animate (Play/Pause) with configurable speeds (Slow, Normal, Fast).
   - Step Forward / Step Back controls.
   - Real-time Call Stack frame drawer displaying active recursion frames (e.g. `mirror(Node 2)`).
   - Node highlight states: Visiting (Gold Glow), Swapping (Pink Pulse), Completed (Green).
3. **Dynamic Non-Overlapping Layout Engine:**
   - Uses an in-order horizontal projection algorithm to mathematically guarantee zero node overlapping regardless of tree geometry.
4. **SVG Zoom & Pan System:**
   - Independent Zoom In (`+`), Zoom Out (`-`), 1:1 Reset, and Fit-to-View controls.
   - Interactive mouse drag-to-pan and mouse wheel zooming.
5. **Sample Tree Presets:**
   - Preset 1: **Balanced Tree** (`1, 2, 3, 4, 5, 6, 7`)
   - Preset 2: **Left-Skewed Tree** (`1, 2, null, 3, null, null, null, 4`)
   - Preset 3: **Right-Skewed Tree** (`1, null, 2, null, 3, null, 4`)
   - Preset 4: **Missing Children / Sparse** (`1, 2, 3, null, 4, 5, null`)
   - Preset 5: **Single-Node Tree** (`42`)
   - Preset 6: **Custom Input**
6. **Traversal & Metric Analytics:**
   - Level-by-level BFS badges for original and mirrored structures.
   - In-order comparison proving reversal invariance.
   - Telemetry card: Total Nodes, Tree Height, Leaf Count, and Tree Classification.
7. **Code & Architecture Studio:**
   - Interactive code viewer with syntax highlighting for C++17, WebAssembly (WAT), and JavaScript.
   - Direct download button for `tree_mirror.cpp`.
8. **Export & Themes:**
   - High-resolution PNG visualizer export.
   - Light and Dark mode toggle with persistent local storage.

---

## 6. How to Run the Project

### Option A: Open Directly in Any Browser (Zero Setup Required)
Because `wasm_module.js` embeds the pre-compiled WebAssembly bytecode in base64 format, you can simply:
1. Double-click `index.html` (or open it in Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari).
2. The WebAssembly engine will initialize and execute the recursive mirror algorithm.

### Option B: Run via Local HTTP Server
If preferred, you can run a local server:
```bash
# Using Node.js
npx serve .

# Or using Python 3
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### Option C: Run Native C++17 Executable & Test Suite
To run the native C++ CLI test suite directly on Windows:
```powershell
.\tree_mirror.exe
```
Or pass a custom tree via CLI argument:
```powershell
.\tree_mirror.exe "1, 2, 3, 4, 5, 6, 7"
```

To recompile the C++ source using MinGW GCC:
```powershell
g++ -std=c++17 -Wall -Wextra -O2 tree_mirror.cpp -o tree_mirror.exe
```

---

## 7. Automated Test Suite Results (from `tree_mirror.exe`)

```
=======================================================
 Hierarchy Mirror Studio -- C++17 Core Engine
=======================================================
Problem Statement: Mirror a Binary Tree Using Recursion
Data Structures & Algorithms (FA-2 College Project)

--- [Test Case: 1. Balanced Tree] ---
Input tokens: 1, 2, 3, 4, 5, 6, 7
Original Tree Height:     3
Original Total Nodes:      7
Original Level-Order:      [1, 2, 3, 4, 5, 6, 7]
Original In-Order:         [4,2,5,1,6,3,7]
>> Recursively Mirrored! <<
Mirrored Level-Order:      [1, 3, 2, 7, 6, 5, 4]
Mirrored In-Order:         [7,3,6,1,5,2,4]
DSA Verification: (Mirrored InOrder == Reversed Original InOrder) -> PASSED [OK]

--- [Test Case: 2. Left-Skewed Tree] ---
Input tokens: 1, 2, null, 3, null, null, null, 4
Original Tree Height:     3
Original Total Nodes:      3
Original Level-Order:      [1, 2, null, 3]
Original In-Order:         [3,2,1]
>> Recursively Mirrored! <<
Mirrored Level-Order:      [1, null, 2, null, 3]
Mirrored In-Order:         [1,2,3]
DSA Verification: (Mirrored InOrder == Reversed Original InOrder) -> PASSED [OK]

--- [Test Case: 3. Right-Skewed Tree] ---
Input tokens: 1, null, 2, null, 3, null, 4
Original Tree Height:     4
Original Total Nodes:      4
Original Level-Order:      [1, null, 2, null, 3, null, 4]
Original In-Order:         [1,2,3,4]
>> Recursively Mirrored! <<
Mirrored Level-Order:      [1, 2, null, 3, null, 4]
Mirrored In-Order:         [4,3,2,1]
DSA Verification: (Mirrored InOrder == Reversed Original InOrder) -> PASSED [OK]

--- [Test Case: 4. Missing Children] ---
Input tokens: 1, 2, 3, null, 4, 5, null
Original Tree Height:     3
Original Total Nodes:      5
Original Level-Order:      [1, 2, 3, null, 4, 5]
Original In-Order:         [2,4,1,5,3]
>> Recursively Mirrored! <<
Mirrored Level-Order:      [1, 3, 2, null, 5, 4]
Mirrored In-Order:         [3,5,1,4,2]
DSA Verification: (Mirrored InOrder == Reversed Original InOrder) -> PASSED [OK]

--- [Test Case: 5. Single Node Tree] ---
Input tokens: 42
Original Tree Height:     1
Original Total Nodes:      1
Original Level-Order:      [42]
Original In-Order:         [42]
>> Recursively Mirrored! <<
Mirrored Level-Order:      [42]
Mirrored In-Order:         [42]
DSA Verification: (Mirrored InOrder == Reversed Original InOrder) -> PASSED [OK]

=======================================================
 All C++17 Core Verification Tests Succeeded!
=======================================================
```

---

## 8. Summary of Project Files

- `index.html`: Main visual dashboard application.
- `styles.css`: CSS3 stylesheet with light/dark themes, responsive layout, and SVG styling.
- `app.js`: JavaScript controller, WebAssembly execution bridge, SVG layout engine, stepper, and export logic.
- `wasm_module.js`: Base64-encoded WebAssembly module for instant, offline, zero-CORS browser execution.
- `tree_mirror.wasm`: Compiled standalone WebAssembly binary module (854 bytes).
- `tree_mirror.wat`: WebAssembly text source with recursive mirroring and linear memory allocation.
- `build_wasm.js`: Node.js script to compile `tree_mirror.wat` to `tree_mirror.wasm` using WABT.
- `tree_mirror.cpp`: Production C++17 source code with CLI tests and Emscripten export declarations.
- `tree_mirror.exe`: Native Windows executable compiled with MinGW GCC 6.3.0.
- `build_emscripten.bat` / `build_emscripten.sh`: Emscripten compilation scripts.
- `Makefile`: Build targets for native C++ and WebAssembly.
- `README.md`: Complete academic project documentation.
