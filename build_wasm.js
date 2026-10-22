const fs = require('fs');
const path = require('path');
const wabtPromise = require('wabt')();

async function build() {
    const wabt = await wabtPromise;
    
    // WebAssembly Text format for Binary Tree Recursive Mirror & Memory Management
    const watSource = `
(module
  ;; 1 page of memory = 64KB
  (memory (export "memory") 2 10)

  ;; Heap pointer starts at byte 1024
  (global $heap_ptr (mut i32) (i32.const 1024))
  
  ;; Node layout (16 bytes):
  ;; offset 0: val (i32)
  ;; offset 4: left pointer (i32)
  ;; offset 8: right pointer (i32)
  ;; offset 12: node_id (i32)

  ;; Reset memory / heap allocation
  (func $reset_heap (export "reset_heap")
    (global.set $heap_ptr (i32.const 1024))
  )

  ;; Allocate a new tree node
  (func $create_node (export "create_node") (param $val i32) (param $id i32) (result i32)
    (local $ptr i32)
    (local.set $ptr (global.get $heap_ptr))
    (global.set $heap_ptr (i32.add (local.get $ptr) (i32.const 16)))
    (i32.store offset=0 (local.get $ptr) (local.get $val))
    (i32.store offset=4 (local.get $ptr) (i32.const 0))
    (i32.store offset=8 (local.get $ptr) (i32.const 0))
    (i32.store offset=12 (local.get $ptr) (local.get $id))
    (return (local.get $ptr))
  )

  ;; Connect left child
  (func $set_left (export "set_left") (param $parent i32) (param $child i32)
    (if (i32.ne (local.get $parent) (i32.const 0))
      (then
        (i32.store offset=4 (local.get $parent) (local.get $child))
      )
    )
  )

  ;; Connect right child
  (func $set_right (export "set_right") (param $parent i32) (param $child i32)
    (if (i32.ne (local.get $parent) (i32.const 0))
      (then
        (i32.store offset=8 (local.get $parent) (local.get $child))
      )
    )
  )

  ;; Node getters
  (func $get_val (export "get_val") (param $node i32) (result i32)
    (i32.load offset=0 (local.get $node))
  )

  (func $get_left (export "get_left") (param $node i32) (result i32)
    (i32.load offset=4 (local.get $node))
  )

  (func $get_right (export "get_right") (param $node i32) (result i32)
    (i32.load offset=8 (local.get $node))
  )

  (func $get_id (export "get_id") (param $node i32) (result i32)
    (i32.load offset=12 (local.get $node))
  )

  ;; =========================================================================
  ;; CORE RECURSIVE MIRROR ALGORITHM IN WEBASSEMBLY
  ;; =========================================================================
  ;; Base Case: If node is NULL (0), return 0.
  ;; Recursive Step:
  ;;   leftMirrored  = mirror(node->left);
  ;;   rightMirrored = mirror(node->right);
  ;; Pointer Swap:
  ;;   node->left  = rightMirrored;
  ;;   node->right = leftMirrored;
  ;; Return swapped node.
  (func $mirror (export "mirror") (param $node i32) (result i32)
    (local $mirrored_left i32)
    (local $mirrored_right i32)
    
    ;; Base case: if (node == 0) return 0;
    (if (i32.eqz (local.get $node))
      (then (return (i32.const 0)))
    )

    ;; Recurse left subtree
    (local.set $mirrored_left
      (call $mirror (i32.load offset=4 (local.get $node)))
    )

    ;; Recurse right subtree
    (local.set $mirrored_right
      (call $mirror (i32.load offset=8 (local.get $node)))
    )

    ;; Swap child pointers on current node
    (i32.store offset=4 (local.get $node) (local.get $mirrored_right))
    (i32.store offset=8 (local.get $node) (local.get $mirrored_left))

    ;; Return mirrored root
    (return (local.get $node))
  )

  ;; Deep clone tree in WebAssembly memory
  (func $clone_tree (export "clone_tree") (param $node i32) (result i32)
    (local $new_node i32)
    (if (i32.eqz (local.get $node))
      (then (return (i32.const 0)))
    )
    (local.set $new_node 
      (call $create_node 
        (i32.load offset=0 (local.get $node)) 
        (i32.load offset=12 (local.get $node))
      )
    )
    (i32.store offset=4 
      (local.get $new_node) 
      (call $clone_tree (i32.load offset=4 (local.get $node)))
    )
    (i32.store offset=8 
      (local.get $new_node) 
      (call $clone_tree (i32.load offset=8 (local.get $node)))
    )
    (return (local.get $new_node))
  )

  ;; Calculate tree height recursively
  (func $get_height (export "get_height") (param $node i32) (result i32)
    (local $hl i32)
    (local $hr i32)
    (if (i32.eqz (local.get $node))
      (then (return (i32.const 0)))
    )
    (local.set $hl (call $get_height (i32.load offset=4 (local.get $node))))
    (local.set $hr (call $get_height (i32.load offset=8 (local.get $node))))
    (if (i32.gt_s (local.get $hl) (local.get $hr))
      (then (return (i32.add (local.get $hl) (i32.const 1))))
      (else (return (i32.add (local.get $hr) (i32.const 1))))
    )
    (i32.const 0)
  )

  ;; Count total nodes recursively
  (func $count_nodes (export "count_nodes") (param $node i32) (result i32)
    (if (i32.eqz (local.get $node))
      (then (return (i32.const 0)))
    )
    (return
      (i32.add
        (i32.const 1)
        (i32.add
          (call $count_nodes (i32.load offset=4 (local.get $node)))
          (call $count_nodes (i32.load offset=8 (local.get $node)))
        )
      )
    )
  )
)
`;

    const module = wabt.parseWat('tree_mirror.wat', watSource);
    const { buffer } = module.toBinary({ log: true, write_debug_names: true });
    
    fs.writeFileSync(path.join(__dirname, 'tree_mirror.wasm'), Buffer.from(buffer));
    const base64Wasm = Buffer.from(buffer).toString('base64');
    
    // Save base64 wasm module as a JS export file so browser works with zero CORS/file protocol restrictions!
    const wasmJsContent = `// Auto-generated WebAssembly module bytecode for Hierarchy Mirror Studio
export const WASM_BYTECODE_BASE64 = "${base64Wasm}";
`;
    fs.writeFileSync(path.join(__dirname, 'wasm_module.js'), wasmJsContent);
    fs.writeFileSync(path.join(__dirname, 'tree_mirror.wat'), watSource.trim());

    console.log('Successfully built tree_mirror.wasm (' + buffer.length + ' bytes)!');
    console.log('Successfully generated wasm_module.js with embedded Base64 WebAssembly payload!');

    // Test the compiled WebAssembly in Node.js
    const wasmInstance = await WebAssembly.instantiate(buffer);
    const wasm = wasmInstance.instance.exports;

    wasm.reset_heap();
    // Build tree: 1 -> left: 2, right: 3
    const n1 = wasm.create_node(1, 1);
    const n2 = wasm.create_node(2, 2);
    const n3 = wasm.create_node(3, 3);
    wasm.set_left(n1, n2);
    wasm.set_right(n1, n3);

    console.log('Initial Tree - Root:', wasm.get_val(n1), 'Left:', wasm.get_val(wasm.get_left(n1)), 'Right:', wasm.get_val(wasm.get_right(n1)));
    console.log('Height:', wasm.get_height(n1), 'Nodes:', wasm.count_nodes(n1));

    // Mirror the tree in WebAssembly
    const mirroredRoot = wasm.mirror(n1);
    console.log('Mirrored Tree - Root:', wasm.get_val(mirroredRoot), 'Left:', wasm.get_val(wasm.get_left(mirroredRoot)), 'Right:', wasm.get_val(wasm.get_right(mirroredRoot)));
    console.log('Verification: Left is now 3, Right is now 2 ->', (wasm.get_val(wasm.get_left(mirroredRoot)) === 3 && wasm.get_val(wasm.get_right(mirroredRoot)) === 2) ? 'VERIFIED PASSED!' : 'FAILED!');
}

build().catch(err => {
    console.error('Build error:', err);
    process.exit(1);
});
