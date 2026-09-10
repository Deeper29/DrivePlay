import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const resources = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !value.startsWith("#") && !/^[a-z]+:/i.test(value));

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
    'class="lesson-card"',
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
