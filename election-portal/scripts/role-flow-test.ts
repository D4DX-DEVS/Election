import assert from "node:assert/strict";
import { canAccessPath } from "../client/src/lib/roles";

assert.equal(canAccessPath("super_admin", "/admins"), true);
assert.equal(canAccessPath("super_admin", "/franchises"), true);

assert.equal(canAccessPath("franchise_admin", "/admins"), true);
assert.equal(canAccessPath("franchise_admin", "/elections/create"), true);
assert.equal(canAccessPath("franchise_admin", "/audit-logs"), false);

assert.equal(canAccessPath("election_admin", "/elections"), true);
assert.equal(canAccessPath("election_admin", "/elections/create"), false);
assert.equal(canAccessPath("election_admin", "/admins"), false);

assert.equal(canAccessPath("voter", "/voting"), true);
assert.equal(canAccessPath("voter", "/profile"), true);
assert.equal(canAccessPath("voter", "/elections"), false);
assert.equal(canAccessPath("voter", "/admins"), false);

console.log("Role-flow navigation tests passed.");
