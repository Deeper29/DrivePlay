import {
  CAR,
  WORLD,
  SCENARIOS,
  degrees,
  angleDifference,
  localToWorld,
  wheelAngles,
  turningCenter,
  advance,
  step,
  isParked,
} from "./physics.js";

const $ = (id) => document.getElementById(id);
const canvas = $("scene"),
  ctx = canvas.getContext("2d");
let scenarioId = "reverse",
  scenario = SCENARIOS.reverse,
  state = { ...scenario.spawn };
let width = 0,
  height = 0,
  scale = 1,
  offsetX = 0,
  offsetY = 0;
let paused = false,
  completed = false,
  recentering = false,
  lastTime = 0,
  parkedTime = 0,
  collisions = 0,
  collisionCooldown = 0,
  lessonIndex = 0;
let toastTimer,
  uiTime = 0,
  lastTrail = null,
  lastDirection = -1;
const keys = new Set(),
  touch = new Set(),
  traces = [[], [], [], []];
const options = { prediction: true, trails: true, center: false, slow: true };
const offsets = [
  [-CAR.track / 2, CAR.wheelbase],
  [CAR.track / 2, CAR.wheelbase],
  [-CAR.track / 2, 0],
  [CAR.track / 2, 0],
];

function roundedRect(x, y, w, h, r, fill, stroke, line = 0.04) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}
function line(points, color, lineWidth = 0.04, dash = []) {
  if (!points.length) return;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}
function text(value, x, y, size, color, align = "center", weight = "500") {
  ctx.font = `${weight} ${size}px Inter, "Noto Sans SC", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
function drawArrow(x, y, heading, color = "#bdc8bc", size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.moveTo(0, 0.6 * size);
  ctx.lineTo(0, -0.6 * size);
  ctx.moveTo(-0.33 * size, -0.22 * size);
  ctx.lineTo(0, -0.6 * size);
  ctx.lineTo(0.33 * size, -0.22 * size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.09 * size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}
function drawGround() {
  roundedRect(0.15, 0.15, 25.7, 21.7, 0.6, "#d2dcd0");
  roundedRect(0.48, 0.48, 25.04, 21.04, 0.3, "#e1e6df", "#c6d1c4", 0.04);
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let x = 1; x < 26; x++)
    line(
      [
        { x, y: 0.55 },
        { x, y: 21.45 },
      ],
      "#bac8bb",
      0.018,
    );
  for (let y = 1; y < 22; y++)
    line(
      [
        { x: 0.55, y },
        { x: 25.45, y },
      ],
      "#bac8bb",
      0.018,
    );
  ctx.restore();
  for (let y = 1.1; y < 21; y += 0.6) {
    roundedRect(0.2, y, 0.2, 0.34, 0.025, "#e8eee2");
    roundedRect(25.6, y, 0.2, 0.34, 0.025, "#e8eee2");
  }
  if (scenarioId === "reverse") {
    const centers = [4.6, 8, 11.4, 14.8, 18.2, 21.6];
    centers.forEach((x, i) => {
      line(
        [
          { x: x - 1.5, y: 7 },
          { x: x - 1.5, y: 1.2 },
          { x: x + 1.5, y: 1.2 },
          { x: x + 1.5, y: 7 },
        ],
        "#f7faf3",
        0.07,
      );
      line(
        [
          { x: x - 1.5, y: 15.1 },
          { x: x - 1.5, y: 20.9 },
          { x: x + 1.5, y: 20.9 },
          { x: x + 1.5, y: 15.1 },
        ],
        "#f7faf3",
        0.07,
      );
      roundedRect(x - 0.6, 1.63, 1.2, 0.12, 0.03, "#bcc9b8");
      roundedRect(x - 0.6, 20.38, 1.2, 0.12, 0.03, "#bcc9b8");
      text(`A-${String(i + 1).padStart(2, "0")}`, x, 7.48, 0.24, "#a6b5a4");
      if (i !== 3)
        text(`B-${String(i + 1).padStart(2, "0")}`, x, 14.58, 0.24, "#a6b5a4");
    });
    line(
      [
        { x: 2, y: 11.1 },
        { x: 24, y: 11.1 },
      ],
      "#c7d1c4",
      0.055,
      [0.5, 0.5],
    );
    drawArrow(5, 9.65, Math.PI / 2, "#c2cdbd", 0.8);
    drawArrow(20.9, 12.65, -Math.PI / 2, "#c2cdbd", 0.8);
    text("S L O W", 8.8, 12.7, 0.3, "#c0cbb9");
  } else if (scenarioId === "parallel") {
    line(
      [
        { x: 19.45, y: 1.8 },
        { x: 19.45, y: 20.7 },
      ],
      "#f5f8f0",
      0.08,
      [0.5, 0.2],
    );
    for (const y of [2.9, 8.7, 16.2, 21.1])
      line(
        [
          { x: 19.45, y },
          { x: 22.55, y },
        ],
        "#f5f8f0",
        0.08,
      );
    line(
      [
        { x: 12.6, y: 1.8 },
        { x: 12.6, y: 20.2 },
      ],
      "#c3cebf",
      0.07,
      [0.5, 0.6],
    );
    drawArrow(16.1, 17.5, 0, "#bdc9b8", 1.2);
    drawArrow(9, 5, Math.PI, "#bdc9b8", 1.2);
    text("缓 行", 8, 16, 0.55, "#bbc7b5");
  } else {
    for (const r of [3, 6, 9]) {
      ctx.beginPath();
      ctx.arc(13, 11, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#cbd5c6";
      ctx.lineWidth = 0.035;
      ctx.setLineDash([0.15, 0.18]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    text(
      "E X P L O R E   A T   Y O U R   O W N   P A C E",
      13,
      2.3,
      0.3,
      "#9eaf98",
    );
    line(
      [
        { x: 2.5, y: 11 },
        { x: 23.5, y: 11 },
      ],
      "#d1dacf",
      0.04,
    );
    line(
      [
        { x: 13, y: 2.5 },
        { x: 13, y: 19.5 },
      ],
      "#d1dacf",
      0.04,
    );
  }
}
function drawTarget() {
  const t = scenario.target;
  if (!t) return;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.heading);
  roundedRect(
    -t.width / 2,
    -t.length / 2,
    t.width,
    t.length,
    0.09,
    "#7db69820",
  );
  ctx.setLineDash([0.25, 0.15]);
  roundedRect(
    -t.width / 2 + 0.04,
    -t.length / 2 + 0.04,
    t.width - 0.08,
    t.length - 0.08,
    0.08,
    null,
    "#5b9e78",
    0.055,
  );
  ctx.setLineDash([]);
  roundedRect(-0.83, -2.12, 1.66, 4.24, 0.38, "#86b9990c", "#92b99b70", 0.028);
  text("P", 0, -0.38, 0.86, "#82ab88", "center", "550");
  text("目 标 车 位", 0, 0.49, 0.25, "#6e9e76");
  drawArrow(0, -1.53, 0, "#9ebc9e", 0.34);
  if (scenarioId === "reverse")
    text("B-04", 0, -t.length / 2 - 0.5, 0.24, "#629174");
  ctx.restore();
}
function drawCar(s, color = "#438d79", active = false) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.heading);
  const wa = wheelAngles(s.steer || 0);
  ctx.save();
  ctx.shadowColor = active ? "#2547393b" : "#3d51451f";
  ctx.shadowBlur = 0.2 * scale;
  ctx.shadowOffsetX = 0.06 * scale;
  ctx.shadowOffsetY = 0.12 * scale;
  roundedRect(-0.89, -3.56, 1.78, 4.44, [0.36, 0.36, 0.26, 0.26], color);
  ctx.restore();
  for (let i = 0; i < offsets.length; i++) {
    const [x, f] = offsets[i];
    ctx.save();
    ctx.translate(x, -f);
    ctx.rotate(i === 0 ? wa.left : i === 1 ? wa.right : 0);
    roundedRect(
      -0.18,
      -0.34,
      0.36,
      0.68,
      0.06,
      active ? "#253b35" : "#57655e",
      active ? "#7da69a" : "#8c9a90",
      0.035,
    );
    if (active) {
      line(
        [
          { x: -0.05, y: -0.25 },
          { x: -0.05, y: 0.25 },
        ],
        "#a5c1b650",
        0.024,
      );
      line(
        [
          { x: 0.06, y: -0.25 },
          { x: 0.06, y: 0.25 },
        ],
        "#a5c1b650",
        0.024,
      );
    }
    ctx.restore();
  }
  const bodyGradient = ctx.createLinearGradient(-0.8, 0, 0.8, 0);
  bodyGradient.addColorStop(0, color);
  bodyGradient.addColorStop(0.48, active ? "#72af98" : color);
  bodyGradient.addColorStop(1, color);
  roundedRect(
    -0.77,
    -3.54,
    1.54,
    4.4,
    [0.35, 0.35, 0.25, 0.25],
    bodyGradient,
    active ? "#367c6655" : "#82948744",
    0.045,
  );
  line(
    [
      { x: -0.69, y: -3.1 },
      { x: -0.69, y: -0.05 },
    ],
    "#ffffff35",
    0.035,
  );
  line(
    [
      { x: 0.69, y: -3.1 },
      { x: 0.69, y: -0.05 },
    ],
    "#ffffff35",
    0.035,
  );
  ctx.beginPath();
  ctx.moveTo(-0.62, -2.72);
  ctx.quadraticCurveTo(0, -2.92, 0.62, -2.72);
  ctx.lineTo(0.52, -1.91);
  ctx.quadraticCurveTo(0, -2.04, -0.52, -1.91);
  ctx.closePath();
  ctx.fillStyle = active ? "#244d48" : "#6c7f79";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.51, -0.41);
  ctx.lineTo(0.51, -0.41);
  ctx.lineTo(0.62, 0.25);
  ctx.quadraticCurveTo(0, 0.41, -0.62, 0.25);
  ctx.closePath();
  ctx.fillStyle = active ? "#345e54" : "#788c80";
  ctx.fill();
  roundedRect(
    -0.5,
    -1.96,
    1,
    1.66,
    0.12,
    active ? "#74ac93" : color,
    "#ffffff30",
    0.04,
  );
  roundedRect(-0.44, -1.84, 0.88, 1.05, 0.1, active ? "#4a8775" : "#8e9f9344");
  line(
    [
      { x: -0.64, y: -1.9 },
      { x: -0.64, y: -0.47 },
    ],
    active ? "#325e50" : "#7c8f8355",
    0.085,
  );
  line(
    [
      { x: 0.64, y: -1.9 },
      { x: 0.64, y: -0.47 },
    ],
    active ? "#325e50" : "#7c8f8355",
    0.085,
  );
  roundedRect(-0.97, -2.14, 0.24, 0.21, 0.07, color, "#44695255", 0.025);
  roundedRect(0.73, -2.14, 0.24, 0.21, 0.07, color, "#44695255", 0.025);
  roundedRect(-0.66, -3.36, 0.39, 0.14, 0.04, active ? "#e7f5ce" : "#e1e8dc");
  roundedRect(0.27, -3.36, 0.39, 0.14, 0.04, active ? "#e7f5ce" : "#e1e8dc");
  const braking = keys.has("Space") || touch.has("brake");
  roundedRect(
    -0.65,
    0.58,
    0.37,
    0.12,
    0.035,
    active && braking ? "#ee7461" : "#b88277",
  );
  roundedRect(
    0.28,
    0.58,
    0.37,
    0.12,
    0.035,
    active && braking ? "#ee7461" : "#b88277",
  );
  if (active && lastDirection < 0) {
    roundedRect(-0.27, 0.58, 0.17, 0.11, 0.02, "#edf2d7");
    roundedRect(0.1, 0.58, 0.17, 0.11, 0.02, "#edf2d7");
  }
  roundedRect(-0.23, 0.72, 0.46, 0.06, 0.01, "#dbe8d2");
  if (active) {
    line(
      [
        { x: -0.78, y: -2.7 },
        { x: 0.78, y: -2.7 },
      ],
      "#c1e7c473",
      0.04,
      [0.07, 0.06],
    );
    line(
      [
        { x: -0.78, y: 0 },
        { x: 0.78, y: 0 },
      ],
      "#c1e7c473",
      0.04,
      [0.07, 0.06],
    );
    ctx.beginPath();
    ctx.arc(0, 0, 0.09, 0, Math.PI * 2);
    ctx.fillStyle = "#d1e9b6";
    ctx.fill();
    drawArrow(0, -3.04, 0, "#d3e5c5", 0.22);
  }
  ctx.restore();
}
function drawObstacles() {
  for (const o of scenario.obstacles) {
    if (o.kind === "car") {
      drawCar(
        {
          x: o.x - (Math.sin(o.heading) * CAR.wheelbase) / 2,
          y: o.y + (Math.cos(o.heading) * CAR.wheelbase) / 2,
          heading: o.heading,
          steer: 0,
        },
        o.color,
      );
    } else if (o.kind === "curb") {
      roundedRect(
        o.x - o.width / 2,
        o.y - o.length / 2,
        o.width,
        o.length,
        0.1,
        "#bdcdb5",
        "#b1c0a9",
        0.05,
      );
      for (let y = 1.5; y < 21; y += 0.7)
        roundedRect(o.x - o.width / 2, y, 0.2, 0.35, 0.01, "#e8ecd9");
      for (let y = 2; y < 21; y += 2) {
        ctx.beginPath();
        ctx.arc(o.x + 0.15, y, 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "#9eb68e";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(o.x, y - 0.13, 0.29, 0, Math.PI * 2);
        ctx.fillStyle = "#adc09a";
        ctx.fill();
      }
    } else {
      roundedRect(o.x - 0.26, o.y - 0.26, 0.52, 0.52, 0.08, "#a7957755");
      ctx.beginPath();
      ctx.arc(o.x, o.y, 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "#c29462";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x, o.y, 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "#f2e5cb";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x, o.y, 0.065, 0, Math.PI * 2);
      ctx.fillStyle = "#ba8c5b";
      ctx.fill();
    }
  }
}
function drawPredictions() {
  if (!options.prediction || completed) return;
  let projected = { ...state };
  const lines = [[], [], [], []];
  for (let i = 0; i <= 90; i++) {
    offsets.forEach(([right, forward], j) =>
      lines[j].push(localToWorld(projected, right, forward)),
    );
    projected = advance(projected, lastDirection * 0.085);
  }
  lines.forEach((points, i) =>
    line(
      points,
      i < 2 ? "#589b7875" : "#559669a6",
      i < 2 ? 0.038 : 0.049,
      [0.16, 0.16],
    ),
  );
  const end = localToWorld(projected, 0, lastDirection > 0 ? CAR.wheelbase : 0);
  drawArrow(
    end.x,
    end.y,
    projected.heading + (lastDirection < 0 ? Math.PI : 0),
    "#619a7188",
    0.45,
  );
}
function drawTurningCenter() {
  if (!options.center) return;
  const center = turningCenter(state);
  if (!center) return;
  const radius = Math.abs(CAR.wheelbase / Math.tan(state.steer));
  if (radius > 70) return;
  line(
    [state, center, localToWorld(state, -CAR.track / 2, CAR.wheelbase)],
    "#b58b5880",
    0.032,
    [0.14, 0.13],
  );
  line(
    [center, localToWorld(state, CAR.track / 2, CAR.wheelbase)],
    "#b58b5860",
    0.03,
    [0.14, 0.13],
  );
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#b58b5845";
  ctx.lineWidth = 0.025;
  ctx.setLineDash([0.14, 0.13]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, 0.13, 0, Math.PI * 2);
  ctx.fillStyle = "#b08a53";
  ctx.fill();
  text("转弯圆心", center.x, center.y + 0.45, 0.25, "#a3875e");
}
function draw() {
  ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e8ede6";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawGround();
  drawTarget();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0.55, 0.55, 24.9, 20.9);
  ctx.clip();
  if (options.trails)
    traces.forEach((points, i) =>
      line(points, i < 2 ? "#739fb699" : "#c0936999", 0.049),
    );
  drawTurningCenter();
  drawPredictions();
  ctx.restore();
  drawObstacles();
  drawCar(state, "#478d75", true);
  const label = localToWorld(state, -1.65, CAR.wheelbase / 2);
  roundedRect(
    label.x - 0.51,
    label.y - 0.25,
    1.02,
    0.5,
    0.14,
    "#ffffffd9",
    "#cfddd088",
    0.025,
  );
  text("你的车", label.x, label.y, 0.22, "#588269");
  ctx.restore();
  const bar = document.querySelector(".scale>span");
  bar.style.width = `${scale * 2}px`;
}
function resize() {
  const box = canvas.parentElement.getBoundingClientRect();
  width = box.width;
  height = box.height;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  scale = Math.min((width - 24) / WORLD.width, (height - 70) / WORLD.height);
  offsetX = (width - WORLD.width * scale) / 2;
  offsetY = (height - WORLD.height * scale) / 2;
  draw();
}
new ResizeObserver(resize).observe(canvas.parentElement);

function showToast(message, warning = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").className = `toast visible${warning ? " warning" : ""}`;
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3000);
}
function clearInputs() {
  keys.clear();
  touch.clear();
  document
    .querySelectorAll("[data-control]")
    .forEach((b) => b.classList.remove("held"));
}
function setPaused(value) {
  paused = value;
  clearInputs();
  $("pause-overlay").hidden = !paused || completed;
  $("pause-button").setAttribute(
    "aria-label",
    paused ? "继续练习" : "暂停练习",
  );
  $("pause-button").innerHTML =
    `<svg><use href="#i-${paused ? "play" : "pause"}"/></svg>`;
}
function renderLessons() {
  $("lesson-list").innerHTML = scenario.lessons
    .map(
      (lesson, i) =>
        `<li class="${i === lessonIndex ? "active" : ""}"><span class="lesson-step">${i + 1}</span><button data-lesson="${i}" aria-expanded="${i === lessonIndex}">${lesson.title}</button><p>${lesson.text}</p></li>`,
    )
    .join("");
}
function selectScenario(id, announce = true) {
  scenarioId = id;
  scenario = SCENARIOS[id];
  state = { ...scenario.spawn };
  parkedTime = 0;
  collisions = 0;
  collisionCooldown = 0;
  completed = false;
  recentering = false;
  lastDirection = -1;
  lastTrail = null;
  lessonIndex = 0;
  traces.forEach((t) => (t.length = 0));
  clearInputs();
  setPaused(false);
  $("success-overlay").hidden = true;
  $("scene-title").textContent = scenario.name;
  $("scene-goal").textContent =
    id === "free"
      ? "试试相同转向下的前进与倒车"
      : id === "parallel"
        ? "停入两车之间的绿色车位"
        : "将车辆倒入绿色车位";
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    const selected = button.dataset.scenario === id;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  renderLessons();
  updateUI();
  draw();
  if (announce) showToast("按住 W / S 移动，A / D 打方向");
}
function insight() {
  const a = degrees(state.steer),
    speed = state.speed;
  if (Math.abs(a) < 0.6) {
    if (Math.abs(speed) < 0.05)
      return [
        "从转动方向盘开始",
        "按 A / D 观察前轮转向，再按 W / S，看看同样的方向如何影响前进和倒车。",
      ];
    return [
      speed < 0 ? "前轮回正，沿车身方向倒车" : "前轮回正，沿车身方向前进",
      "回正的是前轮，不是车身。车辆会沿当前朝向直行；想调整车身角度，需要转向并移动。",
    ];
  }
  const dir = a > 0 ? "右" : "左",
    opposite = a > 0 ? "左" : "右";
  if (Math.abs(speed) < 0.05)
    return [
      `前轮向${dir}，车身暂时不动`,
      `方向已保持。按 S 倒车，车尾向车辆${dir}侧走；按 W 前进，车头向${dir}转。虚线是保持当前转角的预测轮迹。`,
    ];
  if (speed < 0)
    return [
      `倒车${dir}打，车尾向${dir}`,
      `车尾向车辆${dir}侧走，车头向${opposite}侧摆出。注意车头外侧的障碍物；屏幕上的左右会随车身朝向改变。`,
    ];
  return [
    `前进${dir}打，车头向${dir}`,
    `前轮带动车头向${dir}转，后轮从更内侧通过。留意内轮差，车尾悬在开始转弯时也会向外摆。`,
  ];
}
function updateUI() {
  const steering = degrees(state.steer),
    wa = wheelAngles(state.steer),
    moving = Math.abs(state.speed) > 0.025;
  $("speed").textContent = (Math.abs(state.speed) * 3.6).toFixed(1);
  $("gear").textContent = moving ? (state.speed > 0 ? "D" : "R") : "N";
  $("gear").className =
    `gear ${moving ? (state.speed < 0 ? "reverse" : "") : "neutral"}`;
  $("motion-label").textContent = moving
    ? state.speed > 0
      ? "前进中"
      : "倒车中"
    : "静止";
  $("steer-number").textContent = `${Math.round(Math.abs(steering))}°`;
  $("steer-direction").textContent =
    Math.abs(steering) < 0.5 ? "已回正" : steering > 0 ? "向右" : "向左";
  $("steer-indicator").style.left = `${50 + (steering / 35) * 48}%`;
  $("steering-wheel").style.transform =
    `rotate(${steering * CAR.steeringRatio}deg)`;
  $("wheel-angle").textContent =
    `${steering < -0.5 ? "−" : steering > 0.5 ? "+" : ""}${Math.round(Math.abs(steering * CAR.steeringRatio))}°`;
  $("left-wheel").style.transform = `rotate(${degrees(wa.left)}deg)`;
  $("right-wheel").style.transform = `rotate(${degrees(wa.right)}deg)`;
  const angleLabel = (angle) =>
    `${angle < -0.5 ? "−" : angle > 0.5 ? "+" : ""}${Math.round(Math.abs(angle))}°`;
  $("left-angle").textContent = angleLabel(degrees(wa.left));
  $("right-angle").textContent = angleLabel(degrees(wa.right));
  $("radius-value").textContent =
    Math.abs(steering) < 0.1
      ? "∞"
      : `${Math.abs(CAR.wheelbase / Math.tan(state.steer)).toFixed(1)} m`;
  $("alignment-feedback").hidden = !scenario.target;
  if (scenario.target)
    $("alignment-angle").textContent =
      `${Math.abs(degrees(angleDifference(state.heading, scenario.target.heading))).toFixed(1)}°`;
  const [title, explanation] = insight();
  $("insight-title").textContent = title;
  $("insight-text").textContent = explanation;
}
function recordTrails() {
  if (
    lastTrail &&
    Math.hypot(state.x - lastTrail.x, state.y - lastTrail.y) < 0.08
  )
    return;
  offsets.forEach(([right, forward], i) => {
    traces[i].push(localToWorld(state, right, forward));
    if (traces[i].length > 1600) traces[i].shift();
  });
  lastTrail = { x: state.x, y: state.y };
}
function inputState() {
  const active = (...codes) => codes.some((c) => keys.has(c));
  const throttle =
    Number(active("KeyW", "ArrowUp") || touch.has("forward")) -
    Number(active("KeyS", "ArrowDown") || touch.has("reverse"));
  const steer =
    Number(active("KeyD", "ArrowRight") || touch.has("right")) -
    Number(active("KeyA", "ArrowLeft") || touch.has("left"));
  if (steer) recentering = false;
  return {
    throttle,
    steer,
    center: recentering,
    brake: keys.has("Space") || touch.has("brake"),
    slow: options.slow,
  };
}
function finishParking() {
  completed = true;
  clearInputs();
  state.speed = 0;
  $("success-overlay").hidden = false;
  $("success-message").textContent =
    `车身完整入位，方向偏差 ${Math.abs(degrees(angleDifference(state.heading, scenario.target.heading))).toFixed(1)}°。${collisions ? `本次触碰 ${collisions} 次，再练一次会更好。` : "全程无碰撞，做得不错。"}`;
  $("next-button").innerHTML =
    `${scenarioId === "reverse" ? "试试侧方停车" : "去自由探索"} <svg><use href="#i-arrow"/></svg>`;
}
function frame(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.5) : 0;
  lastTime = time;
  if (!paused && !completed && !$("guide-dialog").open) {
    const input = inputState();
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps; i++) {
      const previous = state;
      state = step(state, input, dt / steps, scenario.obstacles);
      collisionCooldown = Math.max(0, collisionCooldown - dt / steps);
      if (state.collision && collisionCooldown === 0) {
        collisions++;
        collisionCooldown = 1.5;
        showToast("触碰障碍物或边界了，试试向相反方向驶离", true);
      }
      if (Math.abs(state.speed) > 0.025) {
        lastDirection = Math.sign(state.speed);
      } else if (input.throttle) lastDirection = input.throttle;
      if (Math.hypot(state.x - previous.x, state.y - previous.y) > 0.00001)
        recordTrails();
      if (recentering && Math.abs(state.steer) < 0.001) recentering = false;
    }
    if (isParked(state, scenario.target)) {
      parkedTime += dt;
      if (parkedTime > 0.7) finishParking();
    } else parkedTime = 0;
  }
  if (time - uiTime > 70) {
    updateUI();
    uiTime = time;
  }
  draw();
  requestAnimationFrame(frame);
}

const drivingCodes = new Set([
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "KeyC",
  "KeyR",
  "KeyP",
]);
window.addEventListener("keydown", (event) => {
  if ($("guide-dialog").open) return;
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
  )
    return;
  if (event.key === "?") {
    event.preventDefault();
    openGuide();
    return;
  }
  if (!drivingCodes.has(event.code)) return;
  if (event.code === "Space" && /BUTTON|A/.test(event.target.tagName)) return;
  event.preventDefault();
  if (!event.repeat && event.code === "KeyR") {
    selectScenario(scenarioId);
    return;
  }
  if (!event.repeat && event.code === "KeyP" && !completed) {
    setPaused(!paused);
    return;
  }
  if (paused || completed) return;
  if (event.code === "KeyC") recentering = true;
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => {
  if (!completed && !$("guide-dialog").open) setPaused(true);
  clearInputs();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !completed) setPaused(true);
});
$("canvas-wrap").addEventListener("pointerdown", () =>
  $("canvas-wrap").focus({ preventScroll: true }),
);
document.querySelectorAll("[data-scenario]").forEach((button) =>
  button.addEventListener("click", () => {
    selectScenario(button.dataset.scenario);
    $("canvas-wrap").focus({ preventScroll: true });
  }),
);
for (const name of ["prediction", "trails", "center", "slow"])
  $(name + "-toggle").addEventListener("change", (event) => {
    options[name] = event.target.checked;
  });
$("pause-button").addEventListener("click", () => {
  if (!completed) setPaused(!paused);
  $("canvas-wrap").focus({ preventScroll: true });
});
$("resume-button").addEventListener("click", () => {
  setPaused(false);
  $("canvas-wrap").focus({ preventScroll: true });
});
$("reset-button").addEventListener("click", () => {
  selectScenario(scenarioId);
  $("canvas-wrap").focus({ preventScroll: true });
});
$("center-button").addEventListener("click", () => {
  recentering = true;
  if (paused) showToast("继续练习后，前轮会回正");
  $("canvas-wrap").focus({ preventScroll: true });
});
$("next-button").addEventListener("click", () => {
  selectScenario(scenarioId === "reverse" ? "parallel" : "free");
  $("canvas-wrap").focus({ preventScroll: true });
});
$("again-button").addEventListener("click", () => {
  selectScenario(scenarioId);
  $("canvas-wrap").focus({ preventScroll: true });
});
$("lesson-list").addEventListener("click", (event) => {
  const item = event.target.closest("[data-lesson]");
  if (item) {
    lessonIndex = Number(item.dataset.lesson);
    renderLessons();
  }
});
$("fullscreen-button").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement)
      await document.querySelector(".simulator").requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    showToast("当前浏览器不支持全屏，可放大浏览器窗口");
  }
});
let pausedBeforeGuide = false;
function openGuide() {
  pausedBeforeGuide = paused;
  clearInputs();
  $("guide-dialog").showModal();
}
function closeGuide() {
  $("guide-dialog").close();
}
$("guide-button").addEventListener("click", openGuide);
$("principles-button").addEventListener("click", openGuide);
$("close-guide").addEventListener("click", closeGuide);
$("start-button").addEventListener("click", closeGuide);
$("guide-dialog").addEventListener("close", () => {
  setPaused(pausedBeforeGuide);
  $("canvas-wrap").focus({ preventScroll: true });
});
$("guide-dialog").addEventListener("click", (event) => {
  if (event.target === $("guide-dialog")) {
    const r = $("guide-dialog").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeGuide();
  }
});
for (const button of document.querySelectorAll("[data-control]")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (paused || completed) return;
    button.setPointerCapture(event.pointerId);
    touch.add(button.dataset.control);
    button.classList.add("held");
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(name, () => {
      touch.delete(button.dataset.control);
      button.classList.remove("held");
    });
}
selectScenario("reverse", false);
requestAnimationFrame(frame);
