import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

for (const size of [16, 32, 48, 128]) {
  test(`committed ${size}px icon is a square PNG`, async () => {
    const image = await readFile(
      new URL(`../apps/extension/public/icon/${size}.png`, import.meta.url),
    );

    assert.deepEqual(image.subarray(0, 8), pngSignature);
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
  });
}
