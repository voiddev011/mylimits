import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateAccess } from "./private-access";
test("saved-sign-in access is requested only on action and includes one provider origin and optional scopes", async () => {
  const requests: unknown[] = [],
    access = createPrivateAccess({
      permissions: {
        request: async (grants) => {
          requests.push(grants);
          return false;
        },
      },
    });
  assert.equal(requests.length, 0);
  assert.equal(await access.grant("chatgpt"), false);
  assert.deepEqual(requests, [
    {
      permissions: ["cookies", "declarativeNetRequestWithHostAccess"],
      origins: ["https://chatgpt.com/*"],
    },
  ]);
});
