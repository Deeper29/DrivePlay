import test from "node:test";
import assert from "node:assert/strict";
import {
  CAR,
  SCENARIOS,
  advance,
  step,
  wheelAngles,
  turningCenter,
  carPolygon,
  rectPolygon,
  polygonsOverlap,
  collides,
  isParked,
  localToWorld,
} from "../physics.js";

const close = (actual, expected, epsilon = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const initial = { x: 13, y: 13, heading: 0, steer: 0, speed: 0 };

test("straight movement follows vehicle heading in both directions", () => {
  let s = advance(initial, 2);
  close(s.x, 13);
  close(s.y, 11);
  close(s.heading, 0);
  s = advance({ ...initial, heading: Math.PI / 2 }, -2);
  close(s.x, 11);
  close(s.y, 13);
});

test("right turn in reverse sends rear right and turns nose left", () => {
  const s = advance({ ...initial, steer: CAR.maxSteer }, -1);
  assert.ok(s.x > initial.x);
  assert.ok(s.y > initial.y);
  assert.ok(s.heading < 0);
  const frontBefore = localToWorld(initial, 0, CAR.wheelbase);
  const frontAfter = localToWorld(s, 0, CAR.wheelbase);
  assert.ok(frontAfter.x < frontBefore.x);
});

test("left/right steering are mirror symmetric", () => {
  for (const distance of [-2, 2]) {
    const right = advance({ ...initial, steer: 0.4 }, distance);
    const left = advance({ ...initial, steer: -0.4 }, distance);
    close(right.x - 13, 13 - left.x);
    close(right.y, left.y);
    close(right.heading, -left.heading);
  }
});

test("exact arcs retrace in reverse and preserve turning center", () => {
  const s = { ...initial, steer: 0.45, heading: 0.2 };
  const next = advance(s, 5);
  const back = advance(next, -5);
  close(back.x, s.x);
  close(back.y, s.y);
  close(back.heading, s.heading);
  const a = turningCenter(s),
    b = turningCenter(next);
  close(a.x, b.x);
  close(a.y, b.y);
});

test("inner wheel has larger Ackermann angle and shares instantaneous center", () => {
  for (const steer of [-CAR.maxSteer, -0.1, 0.1, CAR.maxSteer]) {
    const { left, right } = wheelAngles(steer);
    if (steer > 0) assert.ok(right > left);
    else assert.ok(Math.abs(left) > Math.abs(right));
    const r = CAR.wheelbase / Math.tan(steer);
    close(CAR.wheelbase / Math.tan(left) - CAR.track / 2, r);
    close(CAR.wheelbase / Math.tan(right) + CAR.track / 2, r);
  }
  assert.deepEqual(wheelAngles(0), { left: 0, right: 0 });
});

test("front wheel tracks have a larger radius than same-side rear wheels", () => {
  const s = { ...initial, steer: 0.5 },
    c = turningCenter(s);
  for (const side of [-CAR.track / 2, CAR.track / 2]) {
    const front = localToWorld(s, side, CAR.wheelbase),
      rear = localToWorld(s, side, 0);
    assert.ok(
      Math.hypot(front.x - c.x, front.y - c.y) >
        Math.hypot(rear.x - c.x, rear.y - c.y),
    );
  }
});

test("steering is retained on release and centering does not rotate a stopped car", () => {
  const s = { ...initial, steer: 0.4 };
  close(step(s, {}, 0.1).steer, 0.4);
  const centered = step(s, { center: true }, 1);
  close(centered.steer, 0);
  close(centered.heading, s.heading);
  close(centered.x, s.x);
  close(centered.y, s.y);
});

test("speed and steering limits hold at fixed timesteps", () => {
  let s = { ...initial };
  for (let i = 0; i < 180; i++)
    s = step(s, { throttle: 1, steer: 1, slow: true }, 1 / 120);
  close(s.speed, 0.72);
  close(s.steer, CAR.maxSteer);
});

test("normal and slow speed limits apply in both travel directions", () => {
  for (const [slow, limit] of [
    [false, 1.65],
    [true, 0.72],
  ]) {
    for (const throttle of [-1, 1]) {
      let s = { ...initial };
      for (let i = 0; i < 240; i++) s = step(s, { throttle, slow }, 1 / 120);
      close(s.speed, throttle * limit);
      assert.equal(s.collision, false);
    }
  }
});

test("reverse command brakes through zero rather than flipping speed", () => {
  let s = { ...initial, speed: 1 };
  s = step(s, { throttle: -1 }, 0.1);
  assert.ok(s.speed > 0 && s.speed < 1);
  for (let i = 0; i < 3; i++) s = step(s, { throttle: -1 }, 0.1);
  assert.ok(s.speed < 0);
});

test("braking and release both stop without changing direction", () => {
  for (const speed of [-1, 1]) {
    const stopped = step({ ...initial, speed }, { brake: true }, 0.3);
    close(stopped.speed, 0);
    const slowed = step({ ...initial, speed }, {}, 0.1);
    assert.ok(Math.abs(slowed.speed) < 1);
    assert.equal(Math.sign(slowed.speed), Math.sign(speed));
  }
});

test("SAT detects rotated cars, containment, and nonoverlap", () => {
  const a = carPolygon(initial);
  assert.ok(
    polygonsOverlap(a, rectPolygon({ x: 13, y: 11, width: 0.3, length: 0.3 })),
  );
  assert.ok(
    !polygonsOverlap(
      a,
      rectPolygon({ x: 18, y: 11, width: 1.8, length: 4.46 }),
    ),
  );
  assert.ok(
    polygonsOverlap(
      carPolygon({ ...initial, heading: Math.PI / 4 }),
      rectPolygon({ x: 14, y: 11, width: 1.8, length: 4.46 }),
    ),
  );
});

test("all scenario spawns are clear of obstacles and boundaries", () => {
  for (const [id, scenario] of Object.entries(SCENARIOS))
    assert.equal(collides(scenario.spawn, scenario.obstacles), false, id);
});

test("obstacle contact stops car and allows movement away", () => {
  const obstacles = [{ x: 13, y: 8.35, width: 2, length: 2 }];
  let s = { ...initial, speed: 0.7 };
  for (let i = 0; i < 300; i++) {
    s = step(s, { throttle: 1, slow: true }, 1 / 120, obstacles);
    if (s.collision) break;
  }
  assert.equal(s.collision, true);
  close(s.speed, 0);
  assert.equal(collides(s, obstacles), false);
  const oldY = s.y;
  for (let i = 0; i < 120; i++)
    s = step(s, { throttle: -1, slow: true }, 1 / 120, obstacles);
  assert.ok(s.y > oldY);
  assert.equal(s.collision, false);
});

test("all body corners are checked against world boundary", () => {
  assert.equal(collides({ ...initial, x: 0.9 }, []), true);
  assert.equal(collides({ ...initial, y: 3.9 }, []), true);
  assert.equal(
    collides({ ...initial, x: 22.2, heading: Math.PI / 2 }, []),
    true,
  );
});

test("parking requires whole body inside, correct heading, and stopping", () => {
  const t = SCENARIOS.reverse.target;
  const parked = { ...initial, x: t.x, y: t.y + CAR.wheelbase / 2 };
  assert.equal(isParked(parked, t), true);
  assert.equal(isParked({ ...parked, x: t.x + 1 }, t), false);
  assert.equal(isParked({ ...parked, speed: 0.2 }, t), false);
  assert.equal(isParked({ ...parked, heading: Math.PI }, t), false);
  assert.equal(isParked({ ...parked, heading: 0.2 }, t), false);
  assert.equal(isParked(parked, null), false);
});

test("default reverse-parking exercise admits a collision-free maneuver", () => {
  const scenario = SCENARIOS.reverse;
  let s = { ...scenario.spawn, steer: CAR.maxSteer };
  const radius = CAR.wheelbase / Math.tan(CAR.maxSteer);
  const arc = (-radius * Math.PI) / 2;
  for (let i = 0; i < 500; i++) {
    s = advance(s, arc / 500);
    assert.equal(collides(s, scenario.obstacles), false);
  }
  s.steer = 0;
  const distance = -(scenario.target.y + CAR.wheelbase / 2 - s.y);
  for (let i = 0; i < 400; i++) {
    s = advance(s, distance / 400);
    assert.equal(collides(s, scenario.obstacles), false);
  }
  assert.equal(isParked(s, scenario.target), true);
});
