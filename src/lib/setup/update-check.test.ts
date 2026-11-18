import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shaFromCommitFeed } from "./update-check";

describe("commit feed", () => {
  it("reads the newest commit from GitHub's public feed", () => {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
      <feed>
        <entry>
          <id>tag:github.com,2008:Grit::Commit/9c55ffae5c385c859cb7163c8af97f939b111938</id>
        </entry>
        <entry>
          <id>tag:github.com,2008:Grit::Commit/9c3bbe91d29bf64b7873d6766200f20bd41dc18a</id>
        </entry>
      </feed>`;
    assert.equal(shaFromCommitFeed(body), "9c55ffae5c385c859cb7163c8af97f939b111938");
  });

  it("also accepts the API's sha field", () => {
    assert.equal(shaFromCommitFeed(`{"sha":"abc1234","commit":{}}`), "abc1234");
    assert.equal(shaFromCommitFeed("no commit here"), null);
  });
});
