/**
 * ============================================================================
 * Project: Hierarchy Mirror Studio
 * File: app.js
 * Description: Master Application Controller, WebAssembly Bridge, Dynamic SVG
 *              Tree Engine, Recursion Stepper, Traversals, and Export System.
 * ============================================================================
 */

import { WASM_BYTECODE_BASE64 } from './wasm_module.js';

// ============================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ============================================================================

const state = {
  wasmInstance: null,
  wasmExports: null,
  isWasmActive: false,
  
  // Current Tree Structures
  rawInput: '1, 2, 3, 4, 5, 6, 7',
  originalTree: null,
  mirroredTree: null,

  // Stepper State
  steps: [],
  currentStepIndex: -1,
  isPlaying: false,
  playTimer: null,
  playSpeedMs: 700,

  // Viewport Transforms (Zoom & Pan)
  origTransform: { scale: 1.0, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 },
  mirrTransform: { scale: 1.0, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 },

  // Active Code Tab
  activeCodeTab: 'cpp'
};

// ============================================================================
// 2. WEBASSEMBLY ENGINE INITIALIZATION
// ============================================================================

async function initWebAssembly() {
  const statusBadge = document.getElementById('engine-status-badge');
  const statusText = document.getElementById('engine-status-text');

  try {
    let wasmBytes;
    
    // First attempt to decode embedded base64 bytecode (works with zero CORS/file protocol restrictions!)
    if (typeof WASM_BYTECODE_BASE64 === 'string' && WASM_BYTECODE_BASE64.length > 0) {
      const binaryString = atob(WASM_BYTECODE_BASE64);
      const len = binaryString.length;
      wasmBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        wasmBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      // Fallback: Fetch .wasm binary if served over HTTP
      const response = await fetch('tree_mirror.wasm');
      wasmBytes = await response.arrayBuffer();
    }

    const wasmModule = await WebAssembly.instantiate(wasmBytes);
    state.wasmInstance = wasmModule.instance;
    state.wasmExports = wasmModule.instance.exports;
    state.isWasmActive = true;

    if (statusBadge && statusText) {
      statusText.textContent = `WebAssembly Engine: Active (${wasmBytes.length || wasmBytes.byteLength} B)`;
      statusBadge.title = "Compiled WebAssembly module running recursive mirroring natively in browser memory.";
    }
    console.log('[Hierarchy Mirror Studio] WebAssembly initialized successfully with exports:', Object.keys(state.wasmExports));
  } catch (err) {
    console.warn('[Hierarchy Mirror Studio] WebAssembly init notice:', err);
    if (statusText) {
      statusText.textContent = "WebAssembly: Fallback Mode";
    }
  }
}

// ============================================================================
// 3. TREE NODE DATA STRUCTURE & LEVEL-ORDER PARSER
// ============================================================================

class TreeNode {
  constructor(val, id) {
    this.val = val;
    this.id = id;
    this.left = null;
    this.right = null;
    this.depth = 0;
    this.x = 0;
    this.y = 0;
  }
}

function tokenize(input) {
  if (!input || typeof input !== 'string') return [];
  const clean = input.replace(/[\[\]{}]/g, ' ');
  const rawTokens = clean.split(/[,\s]+/);
  return rawTokens.map(t => t.trim()).filter(t => t.length > 0);
}

function isNullToken(token) {
  const lower = token.toLowerCase();
  return lower === 'null' || lower === 'none' || lower === '#' || lower === 'nil' || lower === 'n';
}

function parseLevelOrder(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    return { success: false, error: "Please enter at least one root node value." };
  }

  if (isNullToken(tokens[0])) {
    return { success: false, error: "Root node cannot be null." };
  }

  const rootVal = Number(tokens[0]);
  if (isNaN(rootVal)) {
    return { success: false, error: `Invalid root node value: "${tokens[0]}". Expected a number.` };
  }

  let idCounter = 1;
  const root = new TreeNode(rootVal, idCounter++);
  const queue = [root];
  let idx = 1;

  while (queue.length > 0 && idx < tokens.length) {
    const current = queue.shift();

    // Process Left Child
    if (idx < tokens.length) {
      const leftToken = tokens[idx++];
      if (!isNullToken(leftToken)) {
        const val = Number(leftToken);
        if (isNaN(val)) {
          return { success: false, error: `Invalid left child value: "${leftToken}". Expected a number or "null".` };
        }
        current.left = new TreeNode(val, idCounter++);
        queue.push(current.left);
      }
    }

    // Process Right Child
    if (idx < tokens.length) {
      const rightToken = tokens[idx++];
      if (!isNullToken(rightToken)) {
        const val = Number(rightToken);
        if (isNaN(val)) {
          return { success: false, error: `Invalid right child value: "${rightToken}". Expected a number or "null".` };
        }
        current.right = new TreeNode(val, idCounter++);
        queue.push(current.right);
      }
    }
  }

  // Warn if unattached tokens exist
  let unattachedCount = 0;
  while (idx < tokens.length) {
    if (!isNullToken(tokens[idx])) unattachedCount++;
    idx++;
  }

  return {
    success: true,
    root: root,
    totalNodes: idCounter - 1,
    unattachedWarning: unattachedCount > 0 ? `Warning: ${unattachedCount} extra node(s) could not be attached due to missing parent slots.` : null
  };
}

function cloneTree(root) {
  if (!root) return null;
  const copy = new TreeNode(root.val, root.id);
  copy.left = cloneTree(root.left);
  copy.right = cloneTree(root.right);
  copy.depth = root.depth;
  copy.x = root.x;
  copy.y = root.y;
  return copy;
}

// ============================================================================
// 4. WEBASSEMBLY RECURSIVE MIRROR EXECUTION
// ============================================================================

/**
 * Builds the binary tree in WebAssembly linear memory, executes the native
 * WebAssembly recursive mirror function, and reconstructs the mirrored tree.
 */
function mirrorTreeUsingWebAssembly(root) {
  if (!root || !state.wasmExports) {
    return mirrorTreePureRecursive(root);
  }

  const wasm = state.wasmExports;
  wasm.reset_heap();

  // Recursively allocate nodes in WebAssembly linear memory
  function treeToWasm(node) {
    if (!node) return 0;
    const ptr = wasm.create_node(node.val, node.id);
    const leftPtr = treeToWasm(node.left);
    const rightPtr = treeToWasm(node.right);
    wasm.set_left(ptr, leftPtr);
    wasm.set_right(ptr, rightPtr);
    return ptr;
  }

  // Reconstruct JavaScript TreeNode from WebAssembly memory
  function wasmToTree(ptr) {
    if (ptr === 0) return null;
    const val = wasm.get_val(ptr);
    const id = wasm.get_id(ptr);
    const node = new TreeNode(val, id);
    node.left = wasmToTree(wasm.get_left(ptr));
    node.right = wasmToTree(wasm.get_right(ptr));
    return node;
  }

  const wasmRootPtr = treeToWasm(root);
  
  // EXECUTE CORE RECURSIVE SWAP INSIDE WEBASSEMBLY RUNTIME
  const mirroredWasmRootPtr = wasm.mirror(wasmRootPtr);

  const mirroredJsTree = wasmToTree(mirroredWasmRootPtr);
  return mirroredJsTree;
}

/**
 * Pure recursive implementation (used for reference and verification).
 */
function mirrorTreePureRecursive(root) {
  if (!root) return null;
  const copy = new TreeNode(root.val, root.id);
  const leftMirrored = mirrorTreePureRecursive(root.left);
  const rightMirrored = mirrorTreePureRecursive(root.right);
  copy.left = rightMirrored;
  copy.right = leftMirrored;
  return copy;
}

// ============================================================================
// 5. RECURSION STEPPER ENGINE (STEP-BY-STEP VISUAL TRACE)
// ============================================================================

function generateRecursionSteps(root) {
  const steps = [];
  let stepId = 0;

  function recurse(node, parentVal = null, isLeft = false) {
    if (!node) {
      steps.push({
        id: ++stepId,
        type: 'base_case',
        nodeId: null,
        val: null,
        parentVal: parentVal,
        description: `Base Case: Encountered NULL child of Node ${parentVal} -> returns NULL without swapping.`,
        callStack: `mirror(null)`
      });
      return null;
    }

    // Step 1: Function Call Enter
    steps.push({
      id: ++stepId,
      type: 'enter',
      nodeId: node.id,
      val: node.val,
      description: `Entering mirror(Node ${node.val}). Inverting its left and right subtrees.`,
      callStack: `mirror(${node.val})`
    });

    // Step 2: Recurse Left
    steps.push({
      id: ++stepId,
      type: 'recurse_left',
      nodeId: node.id,
      val: node.val,
      childVal: node.left ? node.left.val : 'null',
      description: `Step 1/2: Recursively calling mirror() on LEFT subtree of Node ${node.val} (${node.left ? 'Node ' + node.left.val : 'NULL'}).`,
      callStack: `mirror(${node.val}) -> left`
    });
    const leftMirrored = recurse(node.left, node.val, true);

    // Step 3: Recurse Right
    steps.push({
      id: ++stepId,
      type: 'recurse_right',
      nodeId: node.id,
      val: node.val,
      childVal: node.right ? node.right.val : 'null',
      description: `Step 2/2: Recursively calling mirror() on RIGHT subtree of Node ${node.val} (${node.right ? 'Node ' + node.right.val : 'NULL'}).`,
      callStack: `mirror(${node.val}) -> right`
    });
    const rightMirrored = recurse(node.right, node.val, false);

    // Step 4: Swap Left and Right Pointers
    const oldLeftVal = node.left ? node.left.val : 'null';
    const oldRightVal = node.right ? node.right.val : 'null';
    const newLeftVal = rightMirrored ? rightMirrored.val : 'null';
    const newRightVal = leftMirrored ? leftMirrored.val : 'null';

    steps.push({
      id: ++stepId,
      type: 'swap',
      nodeId: node.id,
      val: node.val,
      oldLeft: oldLeftVal,
      oldRight: oldRightVal,
      newLeft: newLeftVal,
      newRight: newRightVal,
      description: `SWAP: Inverting children of Node ${node.val}. Left child [${oldLeftVal}] swapped with Right child [${oldRightVal}].`,
      callStack: `swap(${node.val})`
    });

    // Apply the swap
    const temp = node.left;
    node.left = node.right;
    node.right = temp;

    // Step 5: Function Return
    steps.push({
      id: ++stepId,
      type: 'return',
      nodeId: node.id,
      val: node.val,
      description: `Return: Subtree rooted at Node ${node.val} is fully mirrored! Returning up the call stack.`,
      callStack: `return ${node.val}`
    });

    return node;
  }

  const workingCopy = cloneTree(root);
  recurse(workingCopy);
  return steps;
}

// ============================================================================
// 6. DYNAMIC SVG TREE LAYOUT CALCULATION
// ============================================================================

/**
 * Calculates (x, y) coordinates for each node using an in-order placement
 * algorithm. Guarantees:
 * 1. Zero node overlapping.
 * 2. Left child is strictly to the left of parent.
 * 3. Right child is strictly to the right of parent.
 * 4. Perfect horizontal mirror reflection symmetry.
 */
function computeTreeLayout(root) {
  if (!root) return { width: 400, height: 300, minX: 0, maxX: 400, minY: 0, maxY: 300 };

  const HORIZONTAL_SPACING = 72;
  const VERTICAL_SPACING = 85;
  const TOP_PADDING = 60;
  const SIDE_PADDING = 60;

  // Step 1: Assign depth to every node
  function assignDepth(node, depth = 0) {
    if (!node) return;
    node.depth = depth;
    assignDepth(node.left, depth + 1);
    assignDepth(node.right, depth + 1);
  }
  assignDepth(root, 0);

  // Step 2: Assign x-coordinates based on in-order traversal index
  let inOrderIndex = 0;
  function assignInOrder(node) {
    if (!node) return;
    assignInOrder(node.left);
    node.x = inOrderIndex * HORIZONTAL_SPACING;
    inOrderIndex++;
    assignInOrder(node.right);
  }
  assignInOrder(root);

  // Step 3: Compute y-coordinates
  function assignY(node) {
    if (!node) return;
    node.y = node.depth * VERTICAL_SPACING + TOP_PADDING;
    assignY(node.left);
    assignY(node.right);
  }
  assignY(root);

  // Step 4: Compute bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  function collectBounds(node) {
    if (!node) return;
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
    collectBounds(node.left);
    collectBounds(node.right);
  }
  collectBounds(root);

  const totalWidth = Math.max(500, (maxX - minX) + 2 * SIDE_PADDING);
  const totalHeight = Math.max(380, (maxY - minY) + 2 * TOP_PADDING);

  // Shift nodes so they center comfortably in bounding box
  const shiftX = (totalWidth - (maxX - minX)) / 2 - minX;
  function shiftCoordinates(node) {
    if (!node) return;
    node.x += shiftX;
    shiftCoordinates(node.left);
    shiftCoordinates(node.right);
  }
  shiftCoordinates(root);

  return { width: totalWidth, height: totalHeight, minX: 0, maxX: totalWidth, minY: 0, maxY: totalHeight };
}

// ============================================================================
// 7. SVG TREE RENDERER (CURVED EDGES & GRADIENT NODES)
// ============================================================================

function renderTreeToSvg(root, svgGroupElement, isMirrored = false, activeNodeId = null, swappingNodeId = null) {
  if (!svgGroupElement) return;
  svgGroupElement.innerHTML = '';

  if (!root) {
    svgGroupElement.innerHTML = `
      <text x="250" y="190" fill="var(--text-muted)" font-size="14" font-weight="500" text-anchor="middle">
        Tree is empty. Enter nodes above to build hierarchy.
      </text>
    `;
    return;
  }

  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edgesGroup.setAttribute('class', 'tree-edges-layer');

  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodesGroup.setAttribute('class', 'tree-nodes-layer');

  const edgeClass = isMirrored ? 'tree-edge mirr' : 'tree-edge orig';
  const nodeCircleClass = isMirrored ? 'tree-node-circle mirr' : 'tree-node-circle orig';

  function traverseAndRender(node) {
    if (!node) return;

    // Draw Left Child Edge (Cubic Bezier S-Curve)
    if (node.left) {
      const edge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midY = (node.y + node.left.y) / 2;
      const d = `M ${node.x} ${node.y} C ${node.x} ${midY}, ${node.left.x} ${midY}, ${node.left.x} ${node.left.y}`;
      edge.setAttribute('d', d);
      edge.setAttribute('class', edgeClass);
      edgesGroup.appendChild(edge);
      traverseAndRender(node.left);
    }

    // Draw Right Child Edge (Cubic Bezier S-Curve)
    if (node.right) {
      const edge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midY = (node.y + node.right.y) / 2;
      const d = `M ${node.x} ${node.y} C ${node.x} ${midY}, ${node.right.x} ${midY}, ${node.right.x} ${node.right.y}`;
      edge.setAttribute('d', d);
      edge.setAttribute('class', edgeClass);
      edgesGroup.appendChild(edge);
      traverseAndRender(node.right);
    }

    // Draw Node Group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'tree-node-group');
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '22');
    
    // Check highlight state
    let stateClass = '';
    if (node.id === activeNodeId) {
      stateClass = ' state-visiting';
    } else if (node.id === swappingNodeId) {
      stateClass = ' state-swapping';
    }
    circle.setAttribute('class', nodeCircleClass + stateClass);
    circle.setAttribute('data-id', node.id);

    // Value text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'tree-node-text');
    text.textContent = node.val;

    // Depth badge below node
    const depthBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    depthBadge.setAttribute('class', 'tree-node-index-badge');
    depthBadge.setAttribute('y', '32');
    depthBadge.textContent = `d:${node.depth}`;

    g.appendChild(circle);
    g.appendChild(text);
    g.appendChild(depthBadge);

    // Click on node to inspect
    g.addEventListener('click', () => {
      showNodeDetails(node, isMirrored);
    });

    nodesGroup.appendChild(g);
  }

  traverseAndRender(root);
  svgGroupElement.appendChild(edgesGroup);
  svgGroupElement.appendChild(nodesGroup);
}

function showNodeDetails(node, isMirrored) {
  const treeType = isMirrored ? 'Mirrored Tree' : 'Original Tree';
  const leftVal = node.left ? node.left.val : 'None';
  const rightVal = node.right ? node.right.val : 'None';
  console.log(`[Node Click] ${treeType} -> Val: ${node.val}, Depth: ${node.depth}, Left: ${leftVal}, Right: ${rightVal}`);
}

// ============================================================================
// 8. ZOOM & PAN SYSTEM
// ============================================================================

function setupZoomAndPan(viewportId, svgId, groupSelector, transformState) {
  const viewport = document.getElementById(viewportId);
  const svg = document.getElementById(svgId);

  function applyTransform() {
    const group = document.querySelector(groupSelector);
    if (group) {
      group.setAttribute('transform', `translate(${transformState.panX}, ${transformState.panY}) scale(${transformState.scale})`);
    }
  }

  // Wheel Zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    transformState.scale = Math.min(Math.max(0.4, transformState.scale * zoomFactor), 3.0);
    applyTransform();
  });

  // Mouse Drag to Pan
  viewport.addEventListener('mousedown', (e) => {
    transformState.isDragging = true;
    transformState.startX = e.clientX - transformState.panX;
    transformState.startY = e.clientY - transformState.panY;
    viewport.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!transformState.isDragging) return;
    transformState.panX = e.clientX - transformState.startX;
    transformState.panY = e.clientY - transformState.startY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (transformState.isDragging) {
      transformState.isDragging = false;
      viewport.style.cursor = 'grab';
    }
  });

  return {
    zoomIn: () => {
      transformState.scale = Math.min(3.0, transformState.scale * 1.2);
      applyTransform();
    },
    zoomOut: () => {
      transformState.scale = Math.max(0.4, transformState.scale * 0.8);
      applyTransform();
    },
    reset: () => {
      transformState.scale = 1.0;
      transformState.panX = 0;
      transformState.panY = 0;
      applyTransform();
    },
    fit: () => {
      transformState.scale = 0.95;
      transformState.panX = 0;
      transformState.panY = 0;
      applyTransform();
    },
    apply: applyTransform
  };
}

let origZoomControls = null;
let mirrZoomControls = null;

// ============================================================================
// 9. TRAVERSALS & TELEMETRY CALCULATIONS
// ============================================================================

function getLevelOrderTraversal(root) {
  const levels = [];
  if (!root) return levels;

  const queue = [root];
  while (queue.length > 0) {
    const levelSize = queue.length;
    const currentLevel = [];
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      currentLevel.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    levels.push(currentLevel);
  }
  return levels;
}

function getInOrderTraversal(root) {
  const result = [];
  function helper(node) {
    if (!node) return;
    helper(node.left);
    result.push(node.val);
    helper(node.right);
  }
  helper(root);
  return result;
}

function getTreeHeight(root) {
  if (!root) return 0;
  return 1 + Math.max(getTreeHeight(root.left), getTreeHeight(root.right));
}

function countNodes(root) {
  if (!root) return 0;
  return 1 + countNodes(root.left) + countNodes(root.right);
}

function countLeaves(root) {
  if (!root) return 0;
  if (!root.left && !root.right) return 1;
  return countLeaves(root.left) + countLeaves(root.right);
}

function isTreeBalanced(root) {
  function check(node) {
    if (!node) return 0;
    const lh = check(node.left);
    if (lh === -1) return -1;
    const rh = check(node.right);
    if (rh === -1) return -1;
    if (Math.abs(lh - rh) > 1) return -1;
    return 1 + Math.max(lh, rh);
  }
  return check(root) !== -1;
}

function updateTelemetryAndTraversals() {
  const origRoot = state.originalTree;
  const mirrRoot = state.mirroredTree;

  // Sidebar Metrics
  const totalNodes = countNodes(origRoot);
  const height = getTreeHeight(origRoot);
  const leaves = countLeaves(origRoot);
  const balanced = isTreeBalanced(origRoot);

  document.getElementById('metric-nodes').textContent = totalNodes;
  document.getElementById('metric-height').textContent = height;
  document.getElementById('metric-leaves').textContent = leaves;
  
  let treeTypeDesc = "Balanced";
  if (!balanced) {
    treeTypeDesc = "Unbalanced / Skewed";
  }
  if (totalNodes === 1) treeTypeDesc = "Single Node";
  if (totalNodes === 0) treeTypeDesc = "Empty";
  document.getElementById('metric-type').textContent = treeTypeDesc;

  // Level-Order Badges
  const origLevels = getLevelOrderTraversal(origRoot);
  const mirrLevels = getLevelOrderTraversal(mirrRoot);

  const origBfsContainer = document.getElementById('orig-bfs-badges');
  const mirrBfsContainer = document.getElementById('mirr-bfs-badges');

  origBfsContainer.innerHTML = '';
  mirrBfsContainer.innerHTML = '';

  origLevels.forEach((level, lvlIdx) => {
    const levelLabel = document.createElement('span');
    levelLabel.style.fontSize = '0.74rem';
    levelLabel.style.fontWeight = 'bold';
    levelLabel.style.color = 'var(--text-muted)';
    levelLabel.textContent = `L${lvlIdx}:`;
    origBfsContainer.appendChild(levelLabel);

    level.forEach(val => {
      const badge = document.createElement('span');
      badge.className = 'node-badge badge-orig';
      badge.textContent = val;
      origBfsContainer.appendChild(badge);
    });
  });

  mirrLevels.forEach((level, lvlIdx) => {
    const levelLabel = document.createElement('span');
    levelLabel.style.fontSize = '0.74rem';
    levelLabel.style.fontWeight = 'bold';
    levelLabel.style.color = 'var(--text-muted)';
    levelLabel.textContent = `L${lvlIdx}:`;
    mirrBfsContainer.appendChild(levelLabel);

    level.forEach(val => {
      const badge = document.createElement('span');
      badge.className = 'node-badge badge-mirr';
      badge.textContent = val;
      mirrBfsContainer.appendChild(badge);
    });
  });

  const flatOrig = origLevels.flat();
  const flatMirr = mirrLevels.flat();
  document.getElementById('orig-bfs-summary').textContent = `[${flatOrig.join(', ')}]`;
  document.getElementById('mirr-bfs-summary').textContent = `[${flatMirr.join(', ')}]`;

  // In-Order Badges
  const origInOrder = getInOrderTraversal(origRoot);
  const mirrInOrder = getInOrderTraversal(mirrRoot);

  const origInContainer = document.getElementById('orig-inorder-badges');
  const mirrInContainer = document.getElementById('mirr-inorder-badges');

  origInContainer.innerHTML = '';
  mirrInContainer.innerHTML = '';

  origInOrder.forEach(val => {
    const badge = document.createElement('span');
    badge.className = 'node-badge badge-orig';
    badge.textContent = val;
    origInContainer.appendChild(badge);
  });

  mirrInOrder.forEach(val => {
    const badge = document.createElement('span');
    badge.className = 'node-badge badge-mirr';
    badge.textContent = val;
    mirrInContainer.appendChild(badge);
  });
}

// ============================================================================
// 10. MAIN CONTROLLER ACTIONS (BUILD & MIRROR)
// ============================================================================

function handleBuildTree() {
  const inputVal = document.getElementById('tree-input-box').value;
  const feedbackEl = document.getElementById('input-feedback');
  const feedbackText = document.getElementById('feedback-text');

  const parseResult = parseLevelOrder(inputVal);

  if (!parseResult.success) {
    feedbackEl.className = 'input-feedback error';
    feedbackText.textContent = parseResult.error;
    return;
  }

  feedbackEl.className = 'input-feedback success';
  feedbackText.textContent = parseResult.unattachedWarning 
    ? parseResult.unattachedWarning 
    : `Successfully parsed ${parseResult.totalNodes} node(s). Ready to mirror.`;

  state.originalTree = parseResult.root;

  // Mirror tree using WebAssembly Engine
  state.mirroredTree = mirrorTreeUsingWebAssembly(state.originalTree);

  // Compute layouts
  const origLayout = computeTreeLayout(state.originalTree);
  const mirrLayout = computeTreeLayout(state.mirroredTree);

  // Update SVG viewBoxes
  const origSvg = document.getElementById('orig-tree-svg');
  const mirrSvg = document.getElementById('mirr-tree-svg');

  origSvg.setAttribute('viewBox', `0 0 ${origLayout.width} ${origLayout.height}`);
  mirrSvg.setAttribute('viewBox', `0 0 ${mirrLayout.width} ${mirrLayout.height}`);

  // Render SVG Trees
  renderTreeToSvg(state.originalTree, document.getElementById('orig-tree-group'), false);
  renderTreeToSvg(state.mirroredTree, document.getElementById('mirr-tree-group'), true);

  // Reset Stepper
  resetStepper();

  // Update Traversal & Telemetry
  updateTelemetryAndTraversals();

  if (origZoomControls) origZoomControls.apply();
  if (mirrZoomControls) mirrZoomControls.apply();
}

function handleMirrorTree() {
  handleBuildTree();
  // Trigger animation or focus on stepper
  startAutoPlay();
}

// ============================================================================
// 11. STEPPER CONTROLS & CALL STACK ANIMATION
// ============================================================================

function resetStepper() {
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  state.isPlaying = false;
  updatePlayButtonUI();

  if (!state.originalTree) {
    state.steps = [];
    state.currentStepIndex = -1;
    return;
  }

  state.steps = generateRecursionSteps(state.originalTree);
  state.currentStepIndex = -1;
  updateStepperUI();

  // Re-render clean trees
  renderTreeToSvg(state.originalTree, document.getElementById('orig-tree-group'), false);
  renderTreeToSvg(state.mirroredTree, document.getElementById('mirr-tree-group'), true);
}

function stepForward() {
  if (state.steps.length === 0) return;
  if (state.currentStepIndex < state.steps.length - 1) {
    state.currentStepIndex++;
    applyCurrentStep();
  } else {
    stopAutoPlay();
  }
}

function stepBackward() {
  if (state.steps.length === 0) return;
  if (state.currentStepIndex > 0) {
    state.currentStepIndex--;
    applyCurrentStep();
  }
}

function applyCurrentStep() {
  const step = state.steps[state.currentStepIndex];
  if (!step) return;

  const activeNodeId = step.nodeId;
  const isSwapping = step.type === 'swap';

  // Highlight active node in mirrored SVG
  renderTreeToSvg(
    state.mirroredTree, 
    document.getElementById('mirr-tree-group'), 
    true, 
    activeNodeId, 
    isSwapping ? activeNodeId : null
  );

  updateStepperUI();
}

function updateStepperUI() {
  const step = state.steps[state.currentStepIndex];
  const progressBadge = document.getElementById('stepper-progress');
  const descEl = document.getElementById('stepper-desc');
  const activeCallEl = document.getElementById('stepper-active-call');
  const callStackContainer = document.getElementById('call-stack-list');

  const totalSteps = state.steps.length;
  const currentNum = state.currentStepIndex + 1;
  progressBadge.textContent = `Step: ${currentNum} / ${totalSteps}`;

  if (!step) {
    descEl.innerHTML = `Ready. Click <strong>"Auto Animate"</strong> or <strong>"Next Step"</strong> to begin recursive execution.`;
    activeCallEl.textContent = 'mirror(root)';
    callStackContainer.innerHTML = `
      <div class="stack-frame-box active">
        <span class="frame-label">Stack Base</span>
        <span class="frame-func">mirror(root)</span>
      </div>
    `;
    return;
  }

  descEl.textContent = step.description;
  activeCallEl.textContent = step.callStack;

  // Build Call Stack Frames
  callStackContainer.innerHTML = '';
  const currentVal = step.val;
  
  const frame1 = document.createElement('div');
  frame1.className = 'stack-frame-box';
  frame1.innerHTML = `<span class="frame-label">Frame 0</span><span class="frame-func">mirror(root)</span>`;
  callStackContainer.appendChild(frame1);

  if (currentVal !== null && currentVal !== undefined) {
    const frame2 = document.createElement('div');
    frame2.className = 'stack-frame-box active';
    frame2.innerHTML = `<span class="frame-label">Active Frame</span><span class="frame-func">mirror(Node ${currentVal})</span>`;
    callStackContainer.appendChild(frame2);
  }

  if (step.type === 'swap') {
    const swapFrame = document.createElement('div');
    swapFrame.className = 'stack-frame-box active';
    swapFrame.style.borderColor = 'var(--pink-accent)';
    swapFrame.innerHTML = `<span class="frame-label">Operation</span><span class="frame-func" style="color:var(--pink-accent);">swap(L, R)</span>`;
    callStackContainer.appendChild(swapFrame);
  }
}

function startAutoPlay() {
  if (state.currentStepIndex >= state.steps.length - 1) {
    state.currentStepIndex = -1;
  }
  state.isPlaying = true;
  updatePlayButtonUI();

  if (state.playTimer) clearInterval(state.playTimer);
  state.playTimer = setInterval(() => {
    stepForward();
  }, state.playSpeedMs);
}

function stopAutoPlay() {
  state.isPlaying = false;
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  updatePlayButtonUI();
}

function toggleAutoPlay() {
  if (state.isPlaying) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
}

function updatePlayButtonUI() {
  const playBtn = document.getElementById('btn-stepper-play');
  const playText = document.getElementById('stepper-play-text');
  const playIcon = document.getElementById('stepper-play-icon');

  if (state.isPlaying) {
    playText.textContent = 'Pause';
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    playText.textContent = 'Auto Animate';
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
}

// ============================================================================
// 12. EXPORT PNG SYSTEM (CANVAS SNAPSHOT)
// ============================================================================

async function exportVisualizerPng() {
  const origSvg = document.getElementById('orig-tree-svg');
  const mirrSvg = document.getElementById('mirr-tree-svg');
  if (!origSvg || !mirrSvg) return;

  const canvas = document.createElement('canvas');
  const width = 1600;
  const height = 900;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background Fill
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Header Banner
  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText('Hierarchy Mirror Studio — Interactive Binary Tree Visualizer', 50, 60);

  ctx.fillStyle = '#64748b';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText('Problem: Mirror a Binary Tree Using Recursion · FA-2 DSA Project · C++17 & WebAssembly', 50, 90);

  // Draw Card Backgrounds
  const cardY = 120;
  const cardW = 710;
  const cardH = 720;

  // Left card
  ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
  ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.fillRect(50, cardY, cardW, cardH);
  ctx.strokeRect(50, cardY, cardW, cardH);

  // Left Header
  ctx.fillStyle = '#2563eb';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Original Binary Tree', 80, cardY + 40);

  // Right card
  ctx.fillRect(840, cardY, cardW, cardH);
  ctx.strokeRect(840, cardY, cardW, cardH);

  // Right Header
  ctx.fillStyle = '#7c3aed';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Mirrored Binary Tree (Recursive Swap)', 870, cardY + 40);

  // Helper to draw SVG on Canvas
  const drawSvg = (svgElement, destX, destY, destW, destH) => {
    return new Promise((resolve) => {
      const xml = new XMLSerializer().serializeToString(svgElement);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const b64Start = 'data:image/svg+xml;base64,';
      const image64 = b64Start + svg64;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, destX, destY, destW, destH);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = image64;
    });
  };

  await drawSvg(origSvg, 70, cardY + 60, cardW - 40, cardH - 80);
  await drawSvg(mirrSvg, 860, cardY + 60, cardW - 40, cardH - 80);

  // Download Canvas as PNG
  const link = document.createElement('a');
  link.download = 'Hierarchy_Mirror_Studio_Tree.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ============================================================================
// 13. CODE STUDIO VIEWER & DOWNLOADS
// ============================================================================

const codeSnippets = {
  cpp: `// ============================================================================
// File: tree_mirror.cpp (C++17)
// Problem: Mirror a Binary Tree Using Recursion
// ============================================================================

#include <iostream>
#include <algorithm>
#include <queue>

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    explicit TreeNode(int value) : val(value), left(nullptr), right(nullptr) {}
};

/**
 * Recursive Mirror Algorithm
 * Time Complexity:  O(N) - visits every node once
 * Space Complexity: O(H) - call stack proportional to tree height
 */
TreeNode* mirrorTreeRecursive(TreeNode* root) {
    // Base Case: If subtree is empty, return null
    if (root == nullptr) {
        return nullptr;
    }

    // Step 1: Recursively invert left subtree
    TreeNode* leftMirrored = mirrorTreeRecursive(root->left);

    // Step 2: Recursively invert right subtree
    TreeNode* rightMirrored = mirrorTreeRecursive(root->right);

    // Step 3: Swap child pointers on current node
    root->left = rightMirrored;
    root->right = leftMirrored;

    // Step 4: Return current swapped root
    return root;
}`,

  wat: `;; ============================================================================
;; File: tree_mirror.wat (WebAssembly Text Format)
;; Direct execution inside WebAssembly virtual machine linear memory
;; ============================================================================

(module
  (memory (export "memory") 2 10)
  (global $heap_ptr (mut i32) (i32.const 1024))

  ;; Recursive Mirror Function in WebAssembly
  (func $mirror (export "mirror") (param $node i32) (result i32)
    (local $mirrored_left i32)
    (local $mirrored_right i32)
    
    ;; Base Case: if ($node == 0) return 0;
    (if (i32.eqz (local.get $node))
      (then (return (i32.const 0)))
    )

    ;; Step 1: left = mirror(node->left);
    (local.set $mirrored_left
      (call $mirror (i32.load offset=4 (local.get $node)))
    )

    ;; Step 2: right = mirror(node->right);
    (local.set $mirrored_right
      (call $mirror (i32.load offset=8 (local.get $node)))
    )

    ;; Step 3: Swap node->left = right; node->right = left;
    (i32.store offset=4 (local.get $node) (local.get $mirrored_right))
    (i32.store offset=8 (local.get $node) (local.get $mirrored_left))

    ;; Return swapped node pointer
    (return (local.get $node))
  )
)`,

  js: `// ============================================================================
// File: app.js (Frontend Controller & WASM Bridge)
// ============================================================================

function mirrorTreeUsingWebAssembly(root) {
  const wasm = state.wasmExports;
  wasm.reset_heap();

  // Populate WebAssembly linear memory
  const wasmRoot = treeToWasm(root);

  // Invoke native WebAssembly recursive swap
  const mirroredWasmRoot = wasm.mirror(wasmRoot);

  // Reconstruct tree and return
  return wasmToTree(mirroredWasmRoot);
}`
};

function switchCodeTab(tabKey) {
  state.activeCodeTab = tabKey;
  document.querySelectorAll('.code-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
  });
  const display = document.getElementById('code-display-block');
  if (display) {
    display.textContent = codeSnippets[tabKey] || '';
  }
}

function downloadCppFile() {
  const blob = new Blob([codeSnippets.cpp], { type: 'text/x-c++src' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tree_mirror.cpp';
  a.click();
  URL.revokeObjectURL(url);
}

function copyCodeToClipboard() {
  const text = codeSnippets[state.activeCodeTab];
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Code copied to clipboard!');
    });
  }
}

// ============================================================================
// 14. SAMPLE PRESETS & THEME MANAGEMENT
// ============================================================================

const presets = {
  'balanced': '1, 2, 3, 4, 5, 6, 7',
  'left-skewed': '1, 2, null, 3, null, null, null, 4',
  'right-skewed': '1, null, 2, null, 3, null, 4',
  'missing-children': '1, 2, 3, null, 4, 5, null',
  'single-node': '42',
  'custom': ''
};

function loadPreset(key) {
  const inputEl = document.getElementById('tree-input-box');
  if (key === 'custom') {
    inputEl.focus();
    inputEl.select();
    return;
  }
  const val = presets[key];
  if (val !== undefined) {
    inputEl.value = val;
    handleBuildTree();
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('hms-theme', newTheme);

  document.getElementById('theme-icon-sun').style.display = newTheme === 'light' ? 'block' : 'none';
  document.getElementById('theme-icon-moon').style.display = newTheme === 'dark' ? 'block' : 'none';
}

function initTheme() {
  const saved = localStorage.getItem('hms-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon-sun').style.display = saved === 'light' ? 'block' : 'none';
  document.getElementById('theme-icon-moon').style.display = saved === 'dark' ? 'block' : 'none';
}

// ============================================================================
// 15. INITIALIZATION & EVENT LISTENERS
// ============================================================================

window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await initWebAssembly();

  // Setup Zoom & Pan for Original and Mirrored Viewports
  origZoomControls = setupZoomAndPan('orig-viewport', 'orig-tree-svg', '#orig-tree-group', state.origTransform);
  mirrZoomControls = setupZoomAndPan('mirr-viewport', 'mirr-tree-svg', '#mirr-tree-group', state.mirrTransform);

  // Zoom Control Buttons
  document.getElementById('orig-zoom-in').addEventListener('click', origZoomControls.zoomIn);
  document.getElementById('orig-zoom-out').addEventListener('click', origZoomControls.zoomOut);
  document.getElementById('orig-zoom-reset').addEventListener('click', origZoomControls.reset);
  document.getElementById('orig-zoom-fit').addEventListener('click', origZoomControls.fit);

  document.getElementById('mirr-zoom-in').addEventListener('click', mirrZoomControls.zoomIn);
  document.getElementById('mirr-zoom-out').addEventListener('click', mirrZoomControls.zoomOut);
  document.getElementById('mirr-zoom-reset').addEventListener('click', mirrZoomControls.reset);
  document.getElementById('mirr-zoom-fit').addEventListener('click', mirrZoomControls.fit);

  // Main Action Buttons
  document.getElementById('btn-build-tree').addEventListener('click', handleBuildTree);
  document.getElementById('btn-mirror-tree').addEventListener('click', handleMirrorTree);
  document.getElementById('btn-reset-tree').addEventListener('click', () => {
    document.getElementById('tree-input-box').value = '1, 2, 3, 4, 5, 6, 7';
    handleBuildTree();
  });

  // Enter Key on input
  document.getElementById('tree-input-box').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleBuildTree();
  });

  // Sidebar Menu Buttons
  document.getElementById('side-btn-build').addEventListener('click', handleBuildTree);
  document.getElementById('side-btn-mirror').addEventListener('click', handleMirrorTree);
  document.getElementById('side-btn-traversal').addEventListener('click', () => {
    document.getElementById('traversals-section').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('side-btn-recursion').addEventListener('click', () => {
    document.getElementById('stepper-section').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('side-btn-complexity').addEventListener('click', () => {
    document.getElementById('complexity-section').scrollIntoView({ behavior: 'smooth' });
  });

  // Presets Clicking
  document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
      const presetKey = card.getAttribute('data-preset');
      loadPreset(presetKey);
    });
  });

  // Stepper Buttons
  document.getElementById('btn-stepper-play').addEventListener('click', toggleAutoPlay);
  document.getElementById('btn-stepper-next').addEventListener('click', stepForward);
  document.getElementById('btn-stepper-prev').addEventListener('click', stepBackward);
  document.getElementById('btn-stepper-reset').addEventListener('click', resetStepper);

  document.getElementById('stepper-speed').addEventListener('change', (e) => {
    state.playSpeedMs = Number(e.target.value);
    if (state.isPlaying) {
      startAutoPlay();
    }
  });

  // Export PNG
  document.getElementById('btn-export-png').addEventListener('click', exportVisualizerPng);

  // Theme Toggle
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

  // Code Tabs & Download
  document.querySelectorAll('.code-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCodeTab(btn.getAttribute('data-tab'));
    });
  });
  document.getElementById('btn-download-cpp').addEventListener('click', downloadCppFile);
  document.getElementById('btn-copy-code').addEventListener('click', copyCodeToClipboard);
  switchCodeTab('cpp');

  // Modals
  const modalHowItWorks = document.getElementById('modal-how-it-works');
  const modalAbout = document.getElementById('modal-about');

  document.getElementById('btn-how-it-works').addEventListener('click', () => {
    modalHowItWorks.classList.add('open');
  });
  document.getElementById('btn-about').addEventListener('click', () => {
    modalAbout.classList.add('open');
  });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      document.getElementById(targetId).classList.remove('open');
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target === modalHowItWorks) modalHowItWorks.classList.remove('open');
    if (e.target === modalAbout) modalAbout.classList.remove('open');
  });

  // Navigation Links smooth scroll
  document.querySelectorAll('.nav-btn[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-scroll');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Initial Tree Build
  handleBuildTree();
});
