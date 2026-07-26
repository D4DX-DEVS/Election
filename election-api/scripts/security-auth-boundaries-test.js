const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { loginRateLimit } = require("../middleware/loginRateLimit");
const { encryptCredential, decryptCredential } = require("../lib/credentialVault");

function fakeResponse() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = null;
  res.set = (name, value) => {
    res.headers[name] = value;
    return res;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function runLimiter(req) {
  const res = fakeResponse();
  let nextCalled = false;
  loginRateLimit(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

function run() {
  if (!process.env.CREDENTIAL_ENCRYPTION_KEY && !process.env.JWT_SECRET) {
    process.env.CREDENTIAL_ENCRYPTION_KEY = "release-test-credential-key";
  }
  const encryptedCredential = encryptCredential("sample-pass-123");
  assert.notEqual(encryptedCredential, "sample-pass-123");
  assert.equal(decryptCredential(encryptedCredential), "sample-pass-123");

  const req = {
    ip: "203.0.113.25",
    body: { username: "release-test-user" },
  };

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const result = runLimiter(req);
    assert.equal(result.nextCalled, true, `Attempt ${attempt} should reach login.`);
  }
  const blocked = runLimiter(req);
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.res.statusCode, 429);
  assert.match(blocked.res.body.message, /Too many sign-in attempts/i);

  const mapSource = read("lib/supabase/map.js");
  assert.equal(
    mapSource.includes("plain_password"),
    false,
    "Readable passwords must not be mapped from the database."
  );

  const electionRoutes = read("routes/election.js");
  assert.match(
    electionRoutes,
    /\.post\(protect,\s*franchiseOrSuper,/,
    "Election creation must be limited to franchise and super administrators."
  );

  assert.match(
    read("migrations/enforce-one-vote-per-election.sql"),
    /UNIQUE INDEX[\s\S]*voter_id,\s*election_id/i
  );
  assert.match(
    read("migrations/remove-persistent-plain-passwords.sql"),
    /DROP COLUMN IF EXISTS plain_password/i
  );
  assert.match(
    read("migrations/add-encrypted-voter-credentials.sql"),
    /ADD COLUMN IF NOT EXISTS credential_ciphertext/i
  );

  const userRoutes = read("routes/users.js");
  assert.match(userRoutes, /voters\/credentials", protect, admin, getVoterCredentials/);
  const userController = read("controllers/user.js");
  assert.match(userController, /roles\.assertCanManageUser\(req\.user, voter\)/);
  assert.match(userController, /Printed credentials for/);
  assert.match(
    read("migrations/add-ballot-selection-rule.sql"),
    /CHECK \(ballot_selection_rule IN \('exact', 'up_to'\)\)/i
  );

  const voteController = read("controllers/vote.js");
  assert.match(voteController, /ballotSelectionRule === "up_to"/);
  assert.match(voteController, /Select exactly/);
  assert.match(voteController, /Select up to/);

  console.log("Authentication and ballot boundary tests passed.");
}

run();
