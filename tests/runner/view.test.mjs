import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerView} from '../../dist/runner/view.js';

test('runner drawing resolution adapts only to sustained slow gameplay frames', () => {
  const view = Object.create(RunnerView.prototype);
  view.frameSamples = view.slowFrames = 0;
  let ratio = 1.5;
  view.renderer = {getPixelRatio: () => ratio, setPixelRatio: value => { ratio = value; }};
  const sample = (milliseconds, count, playing = true) => {
    for (let i = 0; i < count; i++) view.adaptResolution(milliseconds, playing);
  };

  sample(60, 35);
  sample(16, 1, false);
  sample(16, 36);
  assert.equal(ratio, 1.5);
  sample(40, 36);
  assert.equal(ratio, 1.25);
  sample(40, 180);
  assert.equal(ratio, .75);
});
