import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-profile-${process.pid}.db`);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Profile = typeof import("./profile");
let profile: Profile;

before(async () => {
  profile = await import("./profile");
});

describe("profile pictures", () => {
  it("stores a picture and a banner, then replaces and removes them", () => {
    assert.deepEqual(profile.profileMedia(), { avatar: null, banner: null });

    const avatar = profile.setProfileImage("avatar", PNG);
    const banner = profile.setProfileImage("banner", PNG);
    const saved = profile.profileMedia();
    assert.equal(saved.avatar, avatar.updatedAt);
    assert.equal(saved.banner, banner.updatedAt);

    const read = profile.readProfileImage("avatar");
    assert.equal(read?.mime, "image/png");
    assert.equal(read?.bytes.length, PNG.length);
    assert.equal(existsSync(join(tmpdir(), "profile", "avatar.png")), true);
    assert.equal(existsSync(join(tmpdir(), "profile", "banner.png")), true);

    const again = profile.setProfileImage("avatar", PNG);
    assert.ok(again.updatedAt >= avatar.updatedAt);
    assert.equal(profile.profileMedia().banner, banner.updatedAt);

    profile.clearProfileImage("avatar");
    assert.equal(profile.profileMedia().avatar, null);
    assert.equal(profile.readProfileImage("avatar"), null);
    assert.equal(existsSync(join(tmpdir(), "profile", "avatar.png")), false);
    assert.equal(profile.profileMedia().banner, banner.updatedAt);
    assert.throws(() => profile.clearProfileImage("avatar"), profile.ProfileError);
  });

  it("refuses a file that is not a picture", () => {
    assert.throws(() => profile.setProfileImage("banner", Buffer.from("not a photo")), /JPEG/);
    assert.equal(profile.readProfileImage("banner")?.mime, "image/png");
  });
});
