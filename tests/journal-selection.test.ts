import test from "node:test";
import assert from "node:assert/strict";
import {
  moods,
  emotions,
  newEntryForMood,
  parseMood,
} from "../src/modules/journal/emotions";

test("quick-entry URLs preselect a mood without choosing a specific emotion", () => {
  for (const mood of moods) {
    const url = new URL(newEntryForMood(mood.value), "http://localhost");
    assert.equal(url.pathname, "/journal/new");
    assert.equal(parseMood(url.searchParams.get("mood")), mood.value);
    assert.equal(url.searchParams.has("emotion"), false);
  }
});

test("a specific emotion or malformed parameter cannot become a mood", () => {
  for (const emotion of emotions) assert.equal(parseMood(emotion.value), "");
  for (const value of [
    undefined,
    null,
    [],
    ["low", "good"],
    "",
    "bad",
    "javascript:alert(1)",
  ]) {
    assert.equal(parseMood(value), "");
  }
});
