'use strict';

const MAX_DEPTH = 64;
const fail = () => {
  throw new SyntaxError(`Brace pattern nesting exceeds maximum depth (${MAX_DEPTH})`);
};

// Follow only child nodes, not the parser's parent/prev back-references.
// An explicit stack avoids recursing on untrusted caller-provided ASTs.
const assertDepth = ast => {
  const active = new Set();
  const stack = [{ node: ast, depth: 0, leave: false }];
  while (stack.length) {
    const { node, depth, leave } = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (leave) {
      active.delete(node);
      continue;
    }
    if (depth > MAX_DEPTH + 1 || active.has(node)) fail();
    active.add(node);
    stack.push({ node, depth, leave: true });
    if (Array.isArray(node.nodes)) {
      for (let i = node.nodes.length - 1; i >= 0; i--) {
        stack.push({ node: node.nodes[i], depth: depth + 1, leave: false });
      }
    }
  }
};

module.exports = { MAX_DEPTH, fail, assertDepth };
