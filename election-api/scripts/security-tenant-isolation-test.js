const assert = require("node:assert/strict");
const roles = require("../lib/roles");
const {
  assertElectionIdsScoped,
  assertUserIdsScoped,
} = require("../lib/tenantScope");

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const electionA = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  franchiseId: orgA,
};
const electionB = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  franchiseId: orgB,
};
const voterA = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  role: "voter",
  franchiseId: orgA,
};
const voterB = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  role: "voter",
  franchiseId: orgB,
};
const electionMap = new Map([
  [electionA.id, electionA],
  [electionB.id, electionB],
]);
const userMap = new Map([
  [voterA.id, voterA],
  [voterB.id, voterB],
]);

async function mustReject(work, expectedMessage) {
  await assert.rejects(work, (err) => {
    assert.equal(err.statusCode, 403);
    assert.match(err.message, expectedMessage);
    return true;
  });
}

async function run() {
  const franchiseAdminA = {
    id: "admin-a",
    role: "franchise_admin",
    franchiseId: orgA,
  };
  const superAdmin = { id: "root", role: "super_admin" };

  assert.equal(
    roles.resolveFranchiseIdForActor(franchiseAdminA, orgB),
    orgA,
    "A tenant admin must not override their organization from request data."
  );

  assert.deepEqual(
    await assertElectionIdsScoped({
      actor: franchiseAdminA,
      franchiseId: orgA,
      electionIds: [electionA.id],
      findElectionById: async (id) => electionMap.get(id),
    }),
    [electionA.id]
  );

  await mustReject(
    () =>
      assertElectionIdsScoped({
        actor: franchiseAdminA,
        franchiseId: orgA,
        electionIds: [electionB.id],
        findElectionById: async (id) => electionMap.get(id),
      }),
    /another organization/
  );

  await mustReject(
    () =>
      assertElectionIdsScoped({
        actor: superAdmin,
        franchiseId: orgA,
        electionIds: [electionB.id],
        findElectionById: async (id) => electionMap.get(id),
      }),
    /another organization/
  );

  assert.deepEqual(
    await assertUserIdsScoped({
      actor: franchiseAdminA,
      franchiseId: orgA,
      userIds: [voterA.id],
      findUserById: async (id) => userMap.get(id),
    }),
    [voterA.id]
  );

  await mustReject(
    () =>
      assertUserIdsScoped({
        actor: superAdmin,
        franchiseId: orgA,
        userIds: [voterB.id],
        findUserById: async (id) => userMap.get(id),
      }),
    /another organization/
  );

  console.log("Tenant isolation regression tests passed.");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
