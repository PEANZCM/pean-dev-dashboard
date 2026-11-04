const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const CHANGELOG = require('../src/js/changelog.js');

test('更新记录第一条就是当前版本', () => {
  assert.equal(CHANGELOG[0].v, pkg.version);
});

test('每条更新记录都完整，版本不重复', () => {
  assert.equal(new Set(CHANGELOG.map((x) => x.v)).size, CHANGELOG.length);
  CHANGELOG.forEach((x) => {
    assert.match(x.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(x.title && x.items.length, x.v);
  });
});
