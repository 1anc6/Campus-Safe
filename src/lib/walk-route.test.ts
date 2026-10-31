import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOsrm, routeProgress, suggestedCheckInMinutes } from "./walk-route.ts";

// An L-shaped walk: ~100 m east along an unnamed path, then ~100 m north on Bell Road.
const A = [77.99, 30.268] as [number, number];
const B = [77.991036, 30.268] as [number, number];
const C = [77.991036, 30.2689] as [number, number];

const osrm = {
  code: "Ok",
  routes: [
    {
      distance: 200,
      duration: 160,
      geometry: { coordinates: [A, B, C] },
      legs: [
        {
          steps: [
            {
              name: "",
              distance: 100,
              duration: 80,
              maneuver: { type: "depart", location: A, bearing_after: 90 },
            },
            {
              name: "Bell Road",
              distance: 100,
              duration: 80,
              maneuver: { type: "turn", modifier: "left", location: B },
            },
            {
              name: "Bell Road",
              distance: 0,
              duration: 0,
              maneuver: { type: "arrive", location: C },
            },
          ],
        },
      ],
    },
  ],
};

describe("parseOsrm", () => {
  it("turns router steps into readable directions", () => {
    const r = parseOsrm(osrm, "CS-IT Block");
    assert.equal(r.points.length, 3);
    assert.deepEqual(
      r.steps.map((s) => s.text),
      ["Head east", "Turn left onto Bell Road", "Arrive at CS-IT Block"],
    );
    assert.deepEqual(
      r.steps.map((s) => s.kind),
      ["depart", "left", "arrive"],
    );
    assert.equal(r.via, "Bell Road");
  });

  it("rejects a response without a route", () => {
    assert.throws(() => parseOsrm({ code: "NoRoute", routes: [] }));
  });
});

describe("routeProgress", () => {
  const route = parseOsrm(osrm);

  it("measures the distance left along the path, not as the crow flies", () => {
    const p = routeProgress(route, { lat: 30.268, lng: 77.99 });
    assert.ok(p.offRouteM < 1);
    assert.ok(Math.abs(p.remainingM - 200) < 5, `remaining ${p.remainingM}`);
    assert.equal(p.next?.step.text, "Turn left onto Bell Road");
    assert.ok(Math.abs(p.next!.inM - 100) < 5);
  });

  it("moves the next turn on once it is passed", () => {
    const p = routeProgress(route, { lat: 30.26845, lng: 77.991036 });
    assert.ok(Math.abs(p.remainingM - 50) < 5, `remaining ${p.remainingM}`);
    assert.equal(p.next?.step.kind, "arrive");
  });

  it("reports how far off the route you are", () => {
    const p = routeProgress(route, { lat: 30.2685, lng: 77.9905 });
    assert.ok(p.offRouteM > 50, `off ${p.offRouteM}`);
  });
});

describe("suggestedCheckInMinutes", () => {
  it("adds a buffer and rounds up to five minutes", () => {
    assert.equal(suggestedCheckInMinutes(2), 10);
    assert.equal(suggestedCheckInMinutes(8), 15);
    assert.equal(suggestedCheckInMinutes(20), 30);
  });
});
