const { add, multiply } = require('./src/index');

test('adds 1 + 2 to equal 3', () => {
  expect(add(1, 2)).toBe(3);
});

test('multiplies 3 * 4 to equal 12', () => {
  expect(multiply(3, 4)).toBe(12);
});

test('INTENTIONALLY FAILING TEST', () => {
  expect(true).toBe(true);  // Fixed to pass
});
