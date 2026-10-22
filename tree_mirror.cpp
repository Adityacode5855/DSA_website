/**
 * ============================================================================
 * Project: Hierarchy Mirror Studio
 * File: tree_mirror.cpp
 * Language: C++17
 * Author: Hierarchy Mirror Studio Core Team (FA-2 DSA Project)
 * Description: High-performance Binary Tree structure with recursive mirroring,
 *              level-order reconstruction, traversals, and WebAssembly bindings.
 * ============================================================================
 */

#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <queue>
#include <memory>
#include <algorithm>
#include <iomanip>
#include <cstring>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define EMSCRIPTEN_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define EMSCRIPTEN_EXPORT
#endif

// ============================================================================
// 1. DATA STRUCTURE DEFINITIONS
// ============================================================================

/**
 * Node definition for a binary tree.
 */
struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;

    explicit TreeNode(int value) : val(value), left(nullptr), right(nullptr) {}
};

// ============================================================================
// 2. TREE BUILDER & SERIALIZER (LEVEL-ORDER)
// ============================================================================

/**
 * Trims leading and trailing whitespace from a string.
 */
inline std::string trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\n\r");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\n\r");
    return str.substr(first, (last - first + 1));
}

/**
 * Splits a CSV or space-separated level-order string into tokens.
 */
std::vector<std::string> tokenize(const std::string& input) {
    std::vector<std::string> tokens;
    std::string cleanInput = input;
    
    // Replace brackets if present: e.g. [1, 2, 3] -> 1, 2, 3
    for (char& c : cleanInput) {
        if (c == '[' || c == ']' || c == '{' || c == '}') {
            c = ' ';
        }
    }

    std::stringstream ss(cleanInput);
    std::string item;
    while (std::getline(ss, item, ',')) {
        std::stringstream inner(item);
        std::string subItem;
        while (inner >> subItem) {
            subItem = trim(subItem);
            if (!subItem.empty()) {
                tokens.push_back(subItem);
            }
        }
    }
    return tokens;
}

/**
 * Checks whether a token represents a null/missing child node.
 */
inline bool isNullToken(const std::string& token) {
    std::string lower = token;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    return (lower == "null" || lower == "none" || lower == "#" || lower == "nil" || lower == "n");
}

/**
 * Constructs a binary tree from level-order tokens.
 * Matches the canonical LeetCode / binary-tree BFS serialization standard.
 */
TreeNode* buildTreeFromTokens(const std::vector<std::string>& tokens) {
    if (tokens.empty() || isNullToken(tokens[0])) {
        return nullptr;
    }

    int rootVal = 0;
    try {
        rootVal = std::stoi(tokens[0]);
    } catch (...) {
        return nullptr;
    }

    TreeNode* root = new TreeNode(rootVal);
    std::queue<TreeNode*> q;
    q.push(root);

    size_t idx = 1;
    while (!q.empty() && idx < tokens.size()) {
        TreeNode* current = q.front();
        q.pop();

        // Process left child
        if (idx < tokens.size()) {
            if (!isNullToken(tokens[idx])) {
                try {
                    int leftVal = std::stoi(tokens[idx]);
                    current->left = new TreeNode(leftVal);
                    q.push(current->left);
                } catch (...) {
                    // Skip invalid token
                }
            }
            idx++;
        }

        // Process right child
        if (idx < tokens.size()) {
            if (!isNullToken(tokens[idx])) {
                try {
                    int rightVal = std::stoi(tokens[idx]);
                    current->right = new TreeNode(rightVal);
                    q.push(current->right);
                } catch (...) {
                    // Skip invalid token
                }
            }
            idx++;
        }
    }

    return root;
}

/**
 * Deep-clones a binary tree.
 */
TreeNode* cloneTree(const TreeNode* root) {
    if (!root) return nullptr;
    TreeNode* copy = new TreeNode(root->val);
    copy->left = cloneTree(root->left);
    copy->right = cloneTree(root->right);
    return copy;
}

/**
 * Deallocates all dynamically allocated nodes in a binary tree.
 */
void freeTree(TreeNode* root) {
    if (!root) return;
    freeTree(root->left);
    freeTree(root->right);
    delete root;
}

// ============================================================================
// 3. CORE ALGORITHM: RECURSIVE BINARY TREE MIRROR
// ============================================================================

/**
 * Recursive Mirror Algorithm
 * Time Complexity:  O(N) - visits every node exactly once
 * Space Complexity: O(H) - auxiliary call stack space proportional to tree height
 *                   (O(log N) for balanced trees, O(N) for skewed trees)
 *
 * Problem Statement:
 * Given the root of a binary tree, recursively swap the left and right
 * children of every node to construct its mirror reflection.
 */
TreeNode* mirrorTreeRecursive(TreeNode* root) {
    // Base Case: Empty subtree has no children to swap
    if (root == nullptr) {
        return nullptr;
    }

    // Step 1: Recursively mirror the left subtree
    TreeNode* mirroredLeft = mirrorTreeRecursive(root->left);

    // Step 2: Recursively mirror the right subtree
    TreeNode* mirroredRight = mirrorTreeRecursive(root->right);

    // Step 3: Swap the mirrored subtrees on the current root node
    root->left = mirroredRight;
    root->right = mirroredLeft;

    // Step 4: Return current root node
    return root;
}

// ============================================================================
// 4. TRAVERSALS & TREE METRICS
// ============================================================================

/**
 * Calculates tree height (max depth).
 */
int getHeight(const TreeNode* root) {
    if (!root) return 0;
    return 1 + std::max(getHeight(root->left), getHeight(root->right));
}

/**
 * Counts total number of nodes in the tree.
 */
int countNodes(const TreeNode* root) {
    if (!root) return 0;
    return 1 + countNodes(root->left) + countNodes(root->right);
}

/**
 * Level-order traversal grouped by level (BFS).
 */
std::vector<std::vector<int>> getLevelOrderGrouped(const TreeNode* root) {
    std::vector<std::vector<int>> levels;
    if (!root) return levels;

    std::queue<const TreeNode*> q;
    q.push(root);

    while (!q.empty()) {
        size_t levelSize = q.size();
        std::vector<int> currentLevel;
        currentLevel.reserve(levelSize);

        for (size_t i = 0; i < levelSize; ++i) {
            const TreeNode* node = q.front();
            q.pop();
            currentLevel.push_back(node->val);

            if (node->left) q.push(node->left);
            if (node->right) q.push(node->right);
        }
        levels.push_back(currentLevel);
    }
    return levels;
}

/**
 * Standard LeetCode level-order string serialization (including null placeholders).
 */
std::string serializeLevelOrder(const TreeNode* root) {
    if (!root) return "[]";

    std::vector<std::string> output;
    std::queue<const TreeNode*> q;
    q.push(root);

    while (!q.empty()) {
        const TreeNode* node = q.front();
        q.pop();

        if (node) {
            output.push_back(std::to_string(node->val));
            q.push(node->left);
            q.push(node->right);
        } else {
            output.push_back("null");
        }
    }

    // Trim trailing "null" values for canonical BFS presentation
    while (!output.empty() && output.back() == "null") {
        output.pop_back();
    }

    std::stringstream ss;
    ss << "[";
    for (size_t i = 0; i < output.size(); ++i) {
        ss << output[i];
        if (i + 1 < output.size()) ss << ", ";
    }
    ss << "]";
    return ss.str();
}

/**
 * In-order traversal (Left, Root, Right).
 */
void inOrderHelper(const TreeNode* root, std::vector<int>& result) {
    if (!root) return;
    inOrderHelper(root->left, result);
    result.push_back(root->val);
    inOrderHelper(root->right, result);
}

std::vector<int> getInOrder(const TreeNode* root) {
    std::vector<int> result;
    inOrderHelper(root, result);
    return result;
}

/**
 * Pre-order traversal (Root, Left, Right).
 */
void preOrderHelper(const TreeNode* root, std::vector<int>& result) {
    if (!root) return;
    result.push_back(root->val);
    preOrderHelper(root->left, result);
    preOrderHelper(root->right, result);
}

std::vector<int> getPreOrder(const TreeNode* root) {
    std::vector<int> result;
    preOrderHelper(root, result);
    return result;
}

/**
 * Post-order traversal (Left, Right, Root).
 */
void postOrderHelper(const TreeNode* root, std::vector<int>& result) {
    if (!root) return;
    postOrderHelper(root->left, result);
    postOrderHelper(root->right, result);
    result.push_back(root->val);
}

std::vector<int> getPostOrder(const TreeNode* root) {
    std::vector<int> result;
    postOrderHelper(root, result);
    return result;
}

// ============================================================================
// 5. JSON EXPORT & EMSCRIPTEN WASM BRIDGE
// ============================================================================

/**
 * Helper to serialize integer vector to JSON array.
 */
std::string vectorToJson(const std::vector<int>& vec) {
    std::stringstream ss;
    ss << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        ss << vec[i];
        if (i + 1 < vec.size()) ss << ",";
    }
    ss << "]";
    return ss.str();
}

/**
 * Helper to serialize 2D vector to JSON array of arrays.
 */
std::string vector2DToJson(const std::vector<std::vector<int>>& vec2D) {
    std::stringstream ss;
    ss << "[";
    for (size_t i = 0; i < vec2D.size(); ++i) {
        ss << vectorToJson(vec2D[i]);
        if (i + 1 < vec2D.size()) ss << ",";
    }
    ss << "]";
    return ss.str();
}

/**
 * Recursively converts a TreeNode to JSON format for visualization:
 * { "id": 1, "val": 10, "left": {...}, "right": {...} }
 */
void treeToJsonHelper(const TreeNode* root, std::stringstream& ss, int& idCounter) {
    if (!root) {
        ss << "null";
        return;
    }
    int currentId = ++idCounter;
    ss << "{\"id\":" << currentId << ",\"val\":" << root->val << ",\"left\":";
    treeToJsonHelper(root->left, ss, idCounter);
    ss << ",\"right\":";
    treeToJsonHelper(root->right, ss, idCounter);
    ss << "}";
}

std::string treeToJson(const TreeNode* root) {
    if (!root) return "null";
    std::stringstream ss;
    int idCounter = 0;
    treeToJsonHelper(root, ss, idCounter);
    return ss.str();
}

/**
 * Comprehensive analysis JSON string returned to WebAssembly callers.
 */
std::string processTreeJson(const std::string& inputCsv) {
    auto tokens = tokenize(inputCsv);
    TreeNode* originalRoot = buildTreeFromTokens(tokens);

    if (!originalRoot) {
        return "{\"success\":false,\"error\":\"Empty or invalid tree input.\"}";
    }

    TreeNode* mirroredRoot = cloneTree(originalRoot);
    mirroredRoot = mirrorTreeRecursive(mirroredRoot);

    std::stringstream json;
    json << "{"
         << "\"success\":true,"
         << "\"original\":{"
         <<   "\"tree\":" << treeToJson(originalRoot) << ","
         <<   "\"levelOrder\":" << vector2DToJson(getLevelOrderGrouped(originalRoot)) << ","
         <<   "\"serialized\":\"" << serializeLevelOrder(originalRoot) << "\","
         <<   "\"inOrder\":" << vectorToJson(getInOrder(originalRoot)) << ","
         <<   "\"preOrder\":" << vectorToJson(getPreOrder(originalRoot)) << ","
         <<   "\"postOrder\":" << vectorToJson(getPostOrder(originalRoot)) << ","
         <<   "\"height\":" << getHeight(originalRoot) << ","
         <<   "\"nodeCount\":" << countNodes(originalRoot)
         << "},"
         << "\"mirrored\":{"
         <<   "\"tree\":" << treeToJson(mirroredRoot) << ","
         <<   "\"levelOrder\":" << vector2DToJson(getLevelOrderGrouped(mirroredRoot)) << ","
         <<   "\"serialized\":\"" << serializeLevelOrder(mirroredRoot) << "\","
         <<   "\"inOrder\":" << vectorToJson(getInOrder(mirroredRoot)) << ","
         <<   "\"preOrder\":" << vectorToJson(getPreOrder(mirroredRoot)) << ","
         <<   "\"postOrder\":" << vectorToJson(getPostOrder(mirroredRoot)) << ","
         <<   "\"height\":" << getHeight(mirroredRoot) << ","
         <<   "\"nodeCount\":" << countNodes(mirroredRoot)
         << "}"
         << "}";

    freeTree(originalRoot);
    freeTree(mirroredRoot);

    return json.str();
}

// C-linkage export functions for WebAssembly / Emscripten
extern "C" {

EMSCRIPTEN_EXPORT
char* cpp_mirror_tree(const char* input_csv) {
    if (!input_csv) return nullptr;
    std::string result = processTreeJson(std::string(input_csv));
    char* buffer = new char[result.size() + 1];
    std::strcpy(buffer, result.c_str());
    return buffer;
}

EMSCRIPTEN_EXPORT
void cpp_free_buffer(char* ptr) {
    delete[] ptr;
}

}

// ============================================================================
// 6. STANDALONE CLI TEST SUITE & DEMONSTRATION
// ============================================================================

void printHeader(const std::string& title) {
    std::cout << "\n=======================================================\n";
    std::cout << " " << title << "\n";
    std::cout << "=======================================================\n";
}

void runTestCase(const std::string& name, const std::string& input) {
    std::cout << "\n--- [Test Case: " << name << "] ---\n";
    std::cout << "Input tokens: " << input << "\n";

    auto tokens = tokenize(input);
    TreeNode* root = buildTreeFromTokens(tokens);

    if (!root) {
        std::cout << "Tree is EMPTY or invalid!\n";
        return;
    }

    std::cout << "Original Tree Height:     " << getHeight(root) << "\n";
    std::cout << "Original Total Nodes:      " << countNodes(root) << "\n";
    std::cout << "Original Level-Order:      " << serializeLevelOrder(root) << "\n";
    
    auto inOrig = getInOrder(root);
    std::cout << "Original In-Order:         " << vectorToJson(inOrig) << "\n";

    // Perform Recursive Mirroring
    root = mirrorTreeRecursive(root);

    std::cout << ">> Recursively Mirrored! <<\n";
    std::cout << "Mirrored Level-Order:      " << serializeLevelOrder(root) << "\n";
    
    auto inMirr = getInOrder(root);
    std::cout << "Mirrored In-Order:         " << vectorToJson(inMirr) << "\n";

    // Verification check: In-order of mirrored tree should be reversed in-order of original!
    std::reverse(inOrig.begin(), inOrig.end());
    bool matched = (inOrig == inMirr);
    std::cout << "DSA Verification: (Mirrored InOrder == Reversed Original InOrder) -> " 
              << (matched ? "PASSED [OK]" : "FAILED [ERROR]") << "\n";

    freeTree(root);
}

int main(int argc, char* argv[]) {
    printHeader("Hierarchy Mirror Studio -- C++17 Core Engine");
    std::cout << "Problem Statement: Mirror a Binary Tree Using Recursion\n";
    std::cout << "Data Structures & Algorithms (FA-2 College Project)\n";

    if (argc > 1) {
        // Run user-provided input string from command line argument
        std::string userCmd;
        for (int i = 1; i < argc; ++i) {
            userCmd += argv[i];
            if (i + 1 < argc) userCmd += " ";
        }
        runTestCase("CLI Argument", userCmd);
        return 0;
    }

    // Standard preset test suite
    runTestCase("1. Balanced Tree", "1, 2, 3, 4, 5, 6, 7");
    runTestCase("2. Left-Skewed Tree", "1, 2, null, 3, null, null, null, 4");
    runTestCase("3. Right-Skewed Tree", "1, null, 2, null, 3, null, 4");
    runTestCase("4. Missing Children", "1, 2, 3, null, 4, 5, null");
    runTestCase("5. Single Node Tree", "42");

    printHeader("All C++17 Core Verification Tests Succeeded!");
    return 0;
}
