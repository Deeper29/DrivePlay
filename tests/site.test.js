import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const resources = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !value.startsWith("#") && !/^[a-z]+:/i.test(value));

test("branding, guidance, and settings share one sidebar beside the practice area", () => {
  const sidebar = html.match(
    /<aside class="left-sidebar"[^>]*>([\s\S]*?)<\/aside>/,
  )?.[1];
  const practice = html.match(
    /<main class="practice-area">([\s\S]*?)<\/main>/,
  )?.[1];
  assert.ok(sidebar);
  assert.ok(practice);
  for (const retained of [
    'class="sidebar-header"',
    'class="brand"',
    'id="guide-button"',
    'class="scenario-list"',
    'id="slow-toggle"',
    'id="prediction-toggle"',
    'id="trails-toggle"',
    'id="center-toggle"',
  ])
    assert.ok(sidebar.includes(retained));
  assert.ok(practice.includes('class="simulator"'));
  assert.ok(!practice.includes('id="guide-button"'));
  assert.ok(!html.includes('class="site-header"'));
  assert.ok(!html.includes('class="right-sidebar"'));
  assert.equal((html.match(/<aside\b/g) || []).length, 1);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});

test("the existing wheel module floats inside the right practice canvas", async () => {
  const sidebar = html.match(/<aside\b[\s\S]*?<\/aside>/)?.[0];
  const canvas = html.match(
    /<div\s+class="canvas-wrap"[\s\S]*?<section class="steering-card">([\s\S]*?)<\/section>/,
  )?.[1];
  assert.ok(canvas);
  assert.ok(!sidebar.includes('class="steering-card"'));
  assert.equal((html.match(/class="steering-card"/g) || []).length, 1);
  for (const id of [
    "steering-wheel",
    "wheel-angle",
    "left-wheel",
    "right-wheel",
    "left-angle",
    "right-angle",
  ])
    assert.ok(canvas.includes(`id="${id}"`));
  const css = await readFile(new URL("styles.css", root), "utf8");
  const panel = css.match(/\.steering-card\s*\{([^}]+)\}/)?.[1];
  assert.match(panel, /position:\s*absolute/);
  assert.match(panel, /top:\s*18px/);
  assert.match(panel, /right:\s*18px/);
  assert.match(panel, /pointer-events:\s*none/);
});

test("practice routes and their unused bindings and data are removed", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const physics = await readFile(new URL("physics.js", root), "utf8");
  const css = await readFile(new URL("styles.css", root), "utf8");
  assert.doesNotMatch(
    html,
    /练习路线|lesson-card|lesson-list|lesson-count|sidebar-details/,
  );
  assert.doesNotMatch(
    app,
    /lessonIndex|renderLessons|lesson-list|scenario\.lessons/,
  );
  assert.doesNotMatch(physics, /lessons:/);
  assert.doesNotMatch(css, /\.lesson-|\.sidebar-details/);
});

test("the practice area has no enclosing card or surrounding padding", async () => {
  const css = await readFile(new URL("styles.css", root), "utf8");
  const simulator = css.match(/\.simulator\s*\{([^}]+)\}/)?.[1];
  assert.match(simulator, /border:\s*0;/);
  assert.match(simulator, /border-radius:\s*0;/);
  assert.match(simulator, /box-shadow:\s*none;/);
  for (const match of css.matchAll(/\.practice-area\s*\{([^}]+)\}/g))
    assert.doesNotMatch(match[1], /padding:/);
});

test("the supplied product icon is used for the logo and favicon", async () => {
  const logo = html.match(/<img\b[^>]*class="brand-mark"[^>]*>/)?.[0];
  const favicon = html.match(/<link\b[^>]*rel="icon"[^>]*>/)?.[0];
  assert.match(logo || "", /src="\.\/assets\/driveplay-icon\.png"/);
  assert.match(favicon || "", /href="\.\/assets\/driveplay-icon\.png"/);
  const image = await readFile(new URL("assets/driveplay-icon.png", root));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16), 60);
  assert.equal(image.readUInt32BE(20), 60);
});

test("normal speed is the default in both the UI and input state", async () => {
  const toggle = html.match(/<input\b[^>]*id="slow-toggle"[^>]*>/)?.[0];
  assert.ok(toggle);
  assert.doesNotMatch(toggle, /\bchecked\b/);
  const app = await readFile(new URL("app.js", root), "utf8");
  const options = app.match(/const options = \{[^}]+\}/)?.[0];
  assert.ok(options);
  assert.match(options, /\bslow:\s*false\b/);
});

test("product identity is DrivePlay with Chinese positioning", () => {
  assert.match(html, /<title>DrivePlay · 可视化驾驶与泊车原理练习<\/title>/);
  assert.match(html, /<h1>DrivePlay<\/h1>/);
  assert.match(html, /<small>可视化驾驶与泊车原理练习<\/small>/);
  assert.match(html, /aria-label="DrivePlay 首页"/);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
});

test("removed promotional sections leave the practice controls intact", () => {
  for (const removed of [
    "泊车实验室",
    "PARKING LAB",
    "LEARN BY DRIVING",
    "把驾驶原理，变成看得见的直觉",
    "看懂方向，",
    "从容停车。",
    "在安全的虚拟场地里，理解每一次打方向背后的运动原理。",
    'class="header-center"',
    'class="intro"',
  ]) {
    assert.ok(
      !html.includes(removed),
      `Unexpected retired content: ${removed}`,
    );
  }
  for (const retained of [
    'class="workspace"',
    'class="steering-card"',
    'id="guide-button"',
    'id="scene"',
  ]) {
    assert.ok(html.includes(retained));
  }
});

test("practice surface omits removed decorations and duplicate help entry", () => {
  for (const removed of [
    'class="model-badge"',
    'class="vehicle-spec"',
    'class="insight-card"',
    'class="tip-card"',
    'id="principles-button"',
    'id="radius-value"',
    "<footer>",
    "为什么车头会向外摆？",
    "TAKE IT SLOW. FIND YOUR FLOW.",
  ]) {
    assert.ok(!html.includes(removed), `Removed UI returned: ${removed}`);
  }
  assert.equal((html.match(/id="guide-button"/g) || []).length, 1);
});

test("the existing intuition appears once and only inside the operating guide", () => {
  const guide = html.match(
    /<dialog\b[^>]*id="guide-dialog"[^>]*>([\s\S]*?)<\/dialog>/,
  )?.[1];
  assert.ok(guide);
  for (const content of [
    "一个重要的直觉",
    "车尾往哪边走",
    "就往哪边打方向。",
    "这里的左右，始终以车辆为参照。",
  ]) {
    assert.equal(html.split(content).length - 1, 1);
    assert.ok(guide.includes(content));
  }
  assert.equal((guide.match(/<li>/g) || []).length, 3);
});

test("static JavaScript DOM references all have live page elements", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const ids = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  );
  for (const match of app.matchAll(/\$\(["']([^"']+)["']\)/g)) {
    assert.ok(ids.has(match[1]), `Dangling DOM reference: ${match[1]}`);
  }
});

test("site assets and home link remain inside root and project Pages deployments", () => {
  assert.ok(resources.includes("./styles.css"));
  assert.ok(resources.includes("./app.js"));
  assert.ok(resources.includes("./"));
  for (const base of [
    "https://example.test/",
    "https://example.test/DrivePlay/",
  ]) {
    for (const resource of resources) {
      assert.ok(
        !resource.startsWith("/"),
        `${resource} escapes the project subpath`,
      );
      const resolved = new URL(resource, base);
      assert.ok(resolved.href.startsWith(base));
    }
  }
});

test("every local page resource and module import exists", async () => {
  for (const resource of resources) await access(new URL(resource, root));
  for (const module of ["app.js", "physics.js"]) {
    const source = await readFile(new URL(module, root), "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(match[1].startsWith("./"));
      await access(new URL(match[1], root));
    }
  }
  await access(new URL(".nojekyll", root));
});
