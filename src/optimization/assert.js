/**
 * Asserts that value is truthy.
 *
 * @param value - Value to check.
 * @param message - Optional error message to throw.
 */
function assert(value, message) {
  if (!value) {
    throw new Error(message ? message : 'unreachable');
  }
}

module.exports = { assert }