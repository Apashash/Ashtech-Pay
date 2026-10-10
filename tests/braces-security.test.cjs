const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const braces = require('../vendor/braces');

const nested = (n, open = '{', close = '}') => open.repeat(n) + 'a,b' + close.repeat(n);
const isDepthError = error => error instanceof SyntaxError && /maximum depth/.test(error.message);

test('ordinary patterns retain upstream behavior', () => {
  assert.deepEqual(braces('a/{b,c}/d'), ['a/(b|c)/d']);
  assert.deepEqual(braces.expand('a/{b,c}/d'), ['a/b/d', 'a/c/d']);
  assert.deepEqual(braces.expand('{1..3}'), ['1', '2', '3']);
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
  assert.deepEqual(braces.expand('\\{a,b\\}'), ['{a,b}']);
  assert.deepEqual(braces.expand('{a,b'), ['{a,b']);
  assert.throws(() => braces.expand('{1..10000}'), RangeError);
});

test('all public string entry points reject deep braces, parentheses and mixed nesting', () => {
  const patterns = [nested(4000), nested(4000, '(', ')'), nested(2000, '{(', ')}'), '{'.repeat(9000)];
  for (const pattern of patterns) {
    for (const fn of [braces, braces.create, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => fn(pattern, { maxDepth: Infinity }), isDepthError);
    }
  }
});

test('the fixed depth boundary supports 64 levels and rejects 65', () => {
  assert.doesNotThrow(() => braces.compile(nested(64)));
  assert.doesNotThrow(() => braces.expand(nested(64, '(', ')')));
  assert.throws(() => braces.parse(nested(65)), isDepthError);
  assert.throws(() => braces.parse(nested(65, '(', ')')), isDepthError);
  // Escaped or quoted braces are literal characters, not nesting.
  assert.doesNotThrow(() => braces.compile('\\{'.repeat(100)));
  assert.doesNotThrow(() => braces.compile('"' + '{'.repeat(100) + '"'));
});

test('direct AST APIs reject deep and cyclic child graphs without stack overflow', () => {
  let ast = { type: 'text', value: 'a' };
  for (let i = 0; i < 10000; i++) ast = { type: 'root', nodes: [ast] };
  const cyclic = { type: 'root', nodes: [] };
  cyclic.nodes.push(cyclic);
  for (const fn of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => fn(ast), isDepthError);
    assert.throws(() => fn(cyclic), isDepthError);
  }
});

test('transitive consumers resolve the patched package', () => {
  for (const manifest of ['../package.json', '../artifacts/mockup-sandbox/package.json']) {
    const fromProject = createRequire(path.resolve(__dirname, manifest));
    const fromMicromatch = createRequire(fromProject.resolve('micromatch'));
    const installed = fromMicromatch('braces');
    assert.equal(fromMicromatch('braces/package.json').name, '@ashtech/braces');
    assert.throws(() => installed.compile(nested(4000)), isDepthError);
    assert.deepEqual(fromProject('micromatch')(['a.js', 'b.ts'], '*.{js,ts}'), ['a.js', 'b.ts']);
  }
  const fromChokidar = createRequire(require.resolve('chokidar'));
  assert.equal(fromChokidar('braces/package.json').name, '@ashtech/braces');
  assert.throws(() => fromChokidar('braces').expand(nested(4000)), isDepthError);
});
