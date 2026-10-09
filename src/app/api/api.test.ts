import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import { LocalHouseRepository } from "@/lib/db/local";
import { setTestRepository } from "@/lib/db";
import { POST as loginRoute } from "./auth/login/route";
import { GET as checkRoute } from "./auth/check/route";
import { GET as houseDataRoute } from "./house/data/route";
import { POST as cleaningsRoute } from "./house/cleanings/route";
import { POST as trashRoute } from "./house/trash/route";
import { POST as roommatesRoute } from "./house/roommates/route";
import { GET as historyRoute } from "./house/history/route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const TEST_DB = path.join(process.cwd(), "data", "test-api-db.json");

describe("API Routes Integration Tests", () => {
  let repo: LocalHouseRepository;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    repo = new LocalHouseRepository(TEST_DB);
    setTestRepository(repo);
    process.env.HOUSE_SECRET_CODE = "segreto123";
  });

  it("handles login verification and rate limiting", async () => {
    // Failed login attempt
    const failedReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
      body: JSON.stringify({ code: "wrong" }),
    });

    const res1 = await loginRoute(failedReq);
    expect(res1.status).toBe(401);

    // 4 more failed attempts
    for (let i = 0; i < 4; i++) {
      await loginRoute(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
          body: JSON.stringify({ code: "wrong" }),
        })
      );
    }

    // 6th attempt should be rate limited (429)
    const resLimited = await loginRoute(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
        body: JSON.stringify({ code: "segreto123" }),
      })
    );
    expect(resLimited.status).toBe(429);

    // From different IP, correct login succeeds
    const successReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.2" },
      body: JSON.stringify({ code: "segreto123" }),
    });

    const resSuccess = await loginRoute(successReq);
    expect(resSuccess.status).toBe(200);
    const cookie = resSuccess.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBeDefined();
  });

  it("blocks unauthenticated access to house data and history", async () => {
    const unauthReq = new Request("http://localhost/api/house/data");
    const unauthRes = await houseDataRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    const checkReq = new Request("http://localhost/api/auth/check");
    const checkRes = await checkRoute(checkReq);
    const checkData = await checkRes.json();
    expect(checkData.authenticated).toBe(false);

    const historyReq = new Request("http://localhost/api/house/history");
    const historyRes = await historyRoute(historyReq);
    expect(historyRes.status).toBe(401);
  });

  it("allows authenticated operations on cleanings, trash, roommates and history", async () => {
    const token = createSessionToken();
    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };

    // 1. Fetch house data
    const dataReq = new Request("http://localhost/api/house/data", { headers: authHeaders });
    const dataRes = await houseDataRoute(dataReq);
    expect(dataRes.status).toBe(200);
    const houseData = await dataRes.json();
    expect(houseData.roommates).toHaveLength(3);
    expect(houseData.currentWeek.cleanings).toHaveLength(3);

    // 2. Update roommate name
    const updateRoommateReq = new Request("http://localhost/api/house/roommates", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: 0, name: "Matteo" }),
    });
    const updateRoommateRes = await roommatesRoute(updateRoommateReq);
    expect(updateRoommateRes.status).toBe(200);
    const updatedRoommates = (await updateRoommateRes.json()).roommates;
    expect(updatedRoommates[0].name).toBe("Matteo");

    // 3. Complete a cleaning task
    const firstTask = houseData.currentWeek.cleanings[0];
    const completeCleanReq = new Request("http://localhost/api/house/cleanings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "complete",
        weekKey: houseData.currentWeek.weekKey,
        taskId: firstTask.id,
        roommateName: "Matteo",
      }),
    });
    const completeCleanRes = await cleaningsRoute(completeCleanReq);
    expect(completeCleanRes.status).toBe(200);

    // 4. Report trash
    const reportTrashReq = new Request("http://localhost/api/house/trash", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action: "report" }),
    });
    const reportTrashRes = await trashRoute(reportTrashReq);
    expect(reportTrashRes.status).toBe(200);
    const reportData = await reportTrashRes.json();
    expect(reportData.openTrashTask).not.toBeNull();
    expect(reportData.openTrashTask.assignedTo).toBe(0);

    // 5. Complete trash
    const completeTrashReq = new Request("http://localhost/api/house/trash", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        action: "complete",
        roommateId: 0,
        roommateName: "Matteo",
      }),
    });
    const completeTrashRes = await trashRoute(completeTrashReq);
    expect(completeTrashRes.status).toBe(200);

    // 6. View history
    const historyReq = new Request("http://localhost/api/house/history", { headers: authHeaders });
    const historyRes = await historyRoute(historyReq);
    expect(historyRes.status).toBe(200);
    const historyData = await historyRes.json();
    expect(historyData.history.length).toBeGreaterThanOrEqual(2);
  });
});
