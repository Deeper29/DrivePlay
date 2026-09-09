import test from "node:test";
import assert from "node:assert/strict";
import {
  CAR,
  SCENARIOS,
  advance,
  collides,
  isParked,
  step,
} from "../physics.js";

test("parallel parking is achievable with two reverse arcs and a forward adjustment", () => {
  const scenario = SCENARIOS.parallel;
  let state = { ...scenario.spawn };
  const radius = CAR.wheelbase / Math.tan(CAR.maxSteer);
  const angle = Math.acos(1 - (scenario.target.x - state.x) / (2 * radius));
  for (const steer of [CAR.maxSteer, -CAR.maxSteer]) {
    state.steer = steer;
    for (let i = 0; i < 500; i++) {
      state = advance(state, (-radius * angle) / 500);
      assert.equal(collides(state, scenario.obstacles), false);
    }
  }
  state.steer = 0;
  const correction = state.y - (scenario.target.y + CAR.wheelbase / 2);
  for (let i = 0; i < 200; i++) {
    state = advance(state, correction / 200);
    assert.equal(collides(state, scenario.obstacles), false);
  }
  assert.equal(isParked(state, scenario.target), true);
});

test("substepping preserves real-time movement at low rendering frame rates", () => {
  function simulate(frameDuration) {
    let state = { ...SCENARIOS.free.spawn, steer: 0.3 };
    for (let frame = 0; frame < Math.round(3 / frameDuration); frame++) {
      const steps = Math.ceil(frameDuration / (1 / 120));
      for (let i = 0; i < steps; i++)
        state = step(state, { throttle: 1, slow: true }, frameDuration / steps);
    }
    return state;
  }
  const fast = simulate(1 / 60),
    slow = simulate(1 / 4);
  assert.ok(Math.hypot(fast.x - slow.x, fast.y - slow.y) < 1e-8);
  assert.ok(Math.abs(fast.heading - slow.heading) < 1e-8);
});
