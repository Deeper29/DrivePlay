export const CAR = Object.freeze({
  wheelbase: 2.7,
  width: 1.8,
  track: 1.55,
  frontOverhang: 0.88,
  rearOverhang: 0.88,
  maxSteer: (35 * Math.PI) / 180,
  steeringRatio: 15,
});
export const WORLD = Object.freeze({ width: 26, height: 22 });
export const WORLD_MARGIN = 0.55;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const degrees = (radians) => (radians * 180) / Math.PI;
export const angleDifference = (a, b) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
const approach = (n, target, amount) =>
  n < target ? Math.min(target, n + amount) : Math.max(target, n - amount);

export function localToWorld(state, right, forward) {
  return {
    x:
      state.x +
      right * Math.cos(state.heading) +
      forward * Math.sin(state.heading),
    y:
      state.y +
      right * Math.sin(state.heading) -
      forward * Math.cos(state.heading),
  };
}

export function carPolygon(state) {
  const front = CAR.wheelbase + CAR.frontOverhang;
  return [
    localToWorld(state, -CAR.width / 2, front),
    localToWorld(state, CAR.width / 2, front),
    localToWorld(state, CAR.width / 2, -CAR.rearOverhang),
    localToWorld(state, -CAR.width / 2, -CAR.rearOverhang),
  ];
}

export function rectPolygon(rect) {
  const c = Math.cos(rect.heading || 0),
    s = Math.sin(rect.heading || 0);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x: rect.x + ((x * rect.width) / 2) * c - ((y * rect.length) / 2) * s,
    y: rect.y + ((x * rect.width) / 2) * s + ((y * rect.length) / 2) * c,
  }));
}

export function polygonsOverlap(a, b) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length];
      const axis = { x: -(q.y - p.y), y: q.x - p.x };
      const project = (points) =>
        points.map((v) => v.x * axis.x + v.y * axis.y);
      const pa = project(a),
        pb = project(b);
      if (
        Math.max(...pa) <= Math.min(...pb) ||
        Math.max(...pb) <= Math.min(...pa)
      )
        return false;
    }
  }
  return true;
}

export function collides(state, obstacles, world = WORLD) {
  const points = carPolygon(state);
  const left = (world.x || 0) + WORLD_MARGIN,
    top = (world.y || 0) + WORLD_MARGIN,
    right = (world.x || 0) + world.width - WORLD_MARGIN,
    bottom = (world.y || 0) + world.height - WORLD_MARGIN;
  if (
    points.some((p) => p.x < left || p.y < top || p.x > right || p.y > bottom)
  )
    return true;
  return obstacles.some((obstacle) =>
    polygonsOverlap(points, rectPolygon(obstacle)),
  );
}

export function wheelAngles(steer) {
  if (Math.abs(steer) < 0.00001) return { left: 0, right: 0 };
  const radius = CAR.wheelbase / Math.tan(steer);
  return {
    left: Math.atan(CAR.wheelbase / (radius + CAR.track / 2)),
    right: Math.atan(CAR.wheelbase / (radius - CAR.track / 2)),
  };
}

export function turningCenter(state) {
  if (Math.abs(state.steer) < 0.001) return null;
  return localToWorld(state, CAR.wheelbase / Math.tan(state.steer), 0);
}

// Position is the rear-axle midpoint. Exact arc integration keeps reverse motion symmetric.
export function advance(state, distance) {
  const curvature = Math.tan(state.steer) / CAR.wheelbase;
  if (Math.abs(curvature) < 1e-8)
    return {
      ...state,
      x: state.x + distance * Math.sin(state.heading),
      y: state.y - distance * Math.cos(state.heading),
    };
  const heading = state.heading + distance * curvature;
  return {
    ...state,
    x: state.x + (Math.cos(state.heading) - Math.cos(heading)) / curvature,
    y: state.y + (Math.sin(state.heading) - Math.sin(heading)) / curvature,
    heading: angleDifference(heading, 0),
  };
}

export function step(state, input, dt, obstacles = [], world = WORLD) {
  let next = { ...state };
  const steeringRate = (38 * Math.PI) / 180;
  if (input.center) next.steer = approach(next.steer, 0, steeringRate * dt * 2);
  else
    next.steer = clamp(
      next.steer + (input.steer || 0) * steeringRate * dt,
      -CAR.maxSteer,
      CAR.maxSteer,
    );
  const throttle = input.throttle || 0;
  const maxSpeed = input.slow ? 0.72 : 1.65;
  let target = throttle * maxSpeed;
  let acceleration = throttle ? 1.15 : 0.9;
  if (input.brake) {
    target = 0;
    acceleration = 5;
  }
  // An opposite direction command brakes to rest before applying reverse propulsion.
  else if (next.speed * throttle < 0) {
    target = 0;
    acceleration = 3.5;
  }
  next.speed = approach(next.speed, target, acceleration * dt);
  const moved = advance(next, ((state.speed + next.speed) / 2) * dt);
  if (collides(moved, obstacles, world))
    return { ...next, speed: 0, collision: true };
  return { ...moved, collision: false };
}

export function isParked(state, target) {
  if (
    !target ||
    Math.abs(state.speed) > 0.08 ||
    Math.abs(angleDifference(state.heading, target.heading || 0)) >
      (2 * Math.PI) / 180 + 1e-9
  )
    return false;
  const c = Math.cos(target.heading || 0),
    s = Math.sin(target.heading || 0);
  const center = localToWorld(
    state,
    0,
    (CAR.wheelbase + CAR.frontOverhang - CAR.rearOverhang) / 2,
  );
  const dx = center.x - target.x,
    dy = center.y - target.y;
  const centerTolerance = 0.1 + 1e-9;
  if (
    Math.abs(dx * c + dy * s) > centerTolerance ||
    Math.abs(-dx * s + dy * c) > centerTolerance
  )
    return false;
  return carPolygon(state).every((p) => {
    const dx = p.x - target.x,
      dy = p.y - target.y;
    return (
      Math.abs(dx * c + dy * s) <= target.width / 2 - 0.04 &&
      Math.abs(-dx * s + dy * c) <= target.length / 2 - 0.04
    );
  });
}

const parked = (x, y, color = "#a1afb9", heading = 0) => ({
  x,
  y,
  width: 1.8,
  length: 4.46,
  color,
  heading,
  kind: "car",
});
export const SCENARIOS = {
  reverse: {
    name: "倒车入库",
    english: "REVERSE PARKING",
    number: "01",
    description: "看懂车尾轨迹，练习转向与回正",
    spawn: { x: 18.7, y: 10.5, heading: Math.PI / 2, steer: 0, speed: 0 },
    target: { x: 14.8, y: 18, width: 3, length: 5.8, heading: 0 },
    obstacles: [
      parked(4.6, 4.1, "#bec3bd"),
      parked(11.4, 4.1, "#a6b6c5"),
      parked(18.2, 4.1, "#c5b8a8"),
      parked(21.6, 4.1, "#a4b2aa"),
      parked(8, 18, "#b5bcc5"),
      parked(11.4, 18, "#d0bdad"),
      parked(18.2, 18, "#a8b9ba"),
      parked(21.6, 18, "#c4c5bb"),
    ],
  },
  parallel: {
    name: "侧方停车",
    english: "PARALLEL PARKING",
    number: "02",
    description: "感受车头外摆，找到回正时机",
    spawn: { x: 16.8, y: 8.2, heading: 0, steer: 0, speed: 0 },
    target: { x: 21, y: 12.5, width: 2.8, length: 6.5, heading: 0 },
    obstacles: [
      parked(21, 5.8, "#b0bcc5"),
      parked(21, 18.9, "#c8b9a7"),
      { x: 23.8, y: 11, width: 1.5, length: 20, kind: "curb" },
    ],
  },
  free: {
    name: "自由探索",
    english: "FREE EXPLORATION",
    number: "03",
    description: "没有固定路线，理解每一次转向",
    spawn: { x: 13, y: 13, heading: 0, steer: 0, speed: 0 },
    target: null,
    obstacles: [
      { x: 4, y: 4, width: 0.5, length: 0.5, kind: "cone" },
      { x: 22, y: 4, width: 0.5, length: 0.5, kind: "cone" },
      { x: 4, y: 18, width: 0.5, length: 0.5, kind: "cone" },
      { x: 22, y: 18, width: 0.5, length: 0.5, kind: "cone" },
    ],
  },
};
