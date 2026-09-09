import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const resources = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !value.startsWith("#") && !/^[a-z]+:/i.test(value));

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
    'class="model-badge"',
    'id="guide-button"',
    'id="scene"',
  ]) {
    assert.ok(html.includes(retained));
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
