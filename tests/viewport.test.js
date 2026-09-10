import test from "node:test";
import assert from "node:assert/strict";
import {
  CAR,
  SCENARIOS,
  WORLD,
  WORLD_MARGIN,
  carPolygon,
  rectPolygon,
  collides,
  step,
} from "../physics.js";
import { fitViewport } from "../viewport.js";

const sizes = [
  [1152, 720],
  [992, 540],
  [772, 720],
  [508, 840],
  [390, 350],
  [320, 350],
  [1632, 900],
  [1152, 440],
];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function overlayFor(width) {
  const [panelWidth, panelHeight, inset] =
    width <= 380
      ? [96, 119, 10]
      : width <= 550
        ? [120, 135, 10]
        : width <= 850
          ? [166, 230, 12]
          : [220, 320, 18];
  return {
    x: width - inset - panelWidth,
    y: inset,
    width: panelWidth,
    height: panelHeight,
  };
}
function screenPoints(points, view) {
  return points.map((p) => ({
    x: p.x * view.scale + view.offsetX,
    y: p.y * view.scale + view.offsetY,
  }));
}
function inside(points, width, height) {
  for (const p of points) {
    assert.ok(p.x >= 0 && p.x <= width, `x outside canvas: ${p.x}/${width}`);
    assert.ok(p.y >= 0 && p.y <= height, `y outside canvas: ${p.y}/${height}`);
  }
}

test("map uses a larger uniform scale without the former inset margins", () => {
  for (const [width, height] of sizes) {
    const view = fitViewport(width, height, SCENARIOS.reverse.spawn);
    const oldScale = Math.min(
      (width - 24) / WORLD.width,
      (height - 70) / WORLD.height,
    );
    assert.ok(view.scale > oldScale);
    assert.equal(view.scale, Math.min(width / 24.9, height / 20.9));
    close((view.world.x + WORLD_MARGIN) * view.scale + view.offsetX, 0);
    close((view.world.y + WORLD_MARGIN) * view.scale + view.offsetY, 0);
    close(
      (view.world.x + view.world.width - WORLD_MARGIN) * view.scale +
        view.offsetX,
      width,
    );
    close(
      (view.world.y + view.world.height - WORLD_MARGIN) * view.scale +
        view.offsetY,
      height,
    );
  }
});

test("spawned cars and targets stay visible without overlapping the floating wheel panel", () => {
  for (const [width, height] of sizes) {
    const overlay = overlayFor(width);
    for (const scenario of Object.values(SCENARIOS)) {
      const view = fitViewport(width, height, scenario.spawn, overlay);
      const body = screenPoints(carPolygon(scenario.spawn), view);
      inside(body, width, height);
      if (scenario.target)
        inside(screenPoints(rectPolygon(scenario.target), view), width, height);
      const overlaps =
        Math.max(...body.map((p) => p.x)) > overlay.x &&
        Math.min(...body.map((p) => p.x)) < overlay.x + overlay.width &&
        Math.max(...body.map((p) => p.y)) > overlay.y &&
        Math.min(...body.map((p) => p.y)) < overlay.y + overlay.height;
      assert.equal(overlaps, false, `${width}x${height}: ${scenario.name}`);
      assert.equal(
        collides(scenario.spawn, scenario.obstacles, view.world),
        false,
      );
    }
  }
});

test("resizing keeps a car near any previous edge visible without moving its physical position", () => {
  for (const state of [
    { ...SCENARIOS.free.spawn, x: -2 },
    { ...SCENARIOS.free.spawn, x: 28 },
    { ...SCENARIOS.free.spawn, y: -1 },
    { ...SCENARIOS.free.spawn, y: 25 },
  ]) {
    const before = { ...state };
    const view = fitViewport(320, 350, state, overlayFor(320));
    inside(screenPoints(carPolygon(state), view), 320, 350);
    assert.deepEqual(state, before);
    assert.equal(collides(state, [], view.world), false);
  }
});

test("newly exposed road is drivable instead of being blocked by the old rectangle", () => {
  const view = fitViewport(1152, 720, SCENARIOS.free.spawn);
  const state = {
    ...SCENARIOS.free.spawn,
    x: 25.5,
    heading: Math.PI / 2,
    speed: 0.5,
  };
  assert.equal(collides(state, []), true);
  assert.equal(collides(state, [], view.world), false);
  const next = step(state, { throttle: 1 }, 0.1, [], view.world);
  assert.equal(next.collision, false);
  assert.ok(next.x > state.x);
  const obstacle = { x: 28, y: state.y, width: 1, length: 2 };
  assert.equal(collides(state, [obstacle], view.world), true);
});

test("collision checks still stop all body corners at the expanded canvas edges", () => {
  const view = fitViewport(1152, 720, SCENARIOS.free.spawn);
  const state = {
    ...SCENARIOS.free.spawn,
    x: view.world.x + WORLD_MARGIN + CAR.width / 2 + 0.01,
  };
  assert.equal(collides(state, [], view.world), false);
  assert.equal(collides({ ...state, x: state.x - 0.02 }, [], view.world), true);
});
