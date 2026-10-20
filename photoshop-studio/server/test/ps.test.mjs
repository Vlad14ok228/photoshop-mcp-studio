import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPopupError } from '../ps.mjs';

test('a bare "General Photoshop error" is treated as a hint popup', () => {
  assert.equal(
    isPopupError('General Photoshop error occurred. This functionality may not be available in this version of Photoshop.\n- '),
    true,
  );
});

test('a real script error is not retried as a popup', () => {
  assert.equal(
    isPopupError('General Photoshop error occurred. This functionality may not be available in this version of Photoshop.\n- Error 2: JSON is undefined.\rLine: 8'),
    false,
  );
  assert.equal(isPopupError('Cannot find the object\nLine: 3'), false);
});

test('unrelated failures are not popups', () => {
  assert.equal(isPopupError('Cannot create object Photoshop.Application'), false);
});
