import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSchedule,
  canPayOffWithin,
  defaults,
  monthlyPayment,
  payoffLabel,
  solve,
  summarize
} from "../src/lib/mortgage.js";

const closeTo = (actual, expected, tolerance = 0.01) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

test("monthlyPayment calculates a standard fixed-rate payment", () => {
  closeTo(monthlyPayment(200000, 6.75, 360), 1297.20);
});

test("buildSchedule marks a normal loan as paid off", () => {
  const schedule = buildSchedule(defaults);

  assert.equal(schedule.status, "paid-off");
  assert.equal(schedule.paidOff, true);
  assert.equal(schedule.payoffPayments, 360);
  assert.equal(schedule.rows.length, 360);
  assert.equal(payoffLabel(schedule.payoffPayments), "30 yr");
  assert.ok(schedule.remainingBalance <= 0.005);
});

test("stalled schedules are not reported as paid off", () => {
  const values = {
    ...defaults,
    principal: 200000,
    rate: 6.75,
    payment: 1,
    extra: 0,
    annualExtraPayments: 12
  };

  const schedule = buildSchedule(values);
  const solved = solve(values);

  assert.equal(schedule.status, "stalled");
  assert.equal(schedule.paidOff, false);
  assert.equal(schedule.payoffPayments, Infinity);
  assert.equal(payoffLabel(schedule.payoffPayments), "Not paid off");
  assert.equal(solved.values.payments, values.payments);
  assert.match(solved.message, /must be more than \$1,125\.00/);
});

test("exact interest-only payment is treated as stalled", () => {
  const values = {
    ...defaults,
    principal: 200000,
    rate: 1,
    payment: 200000 * (1 / 100 / 12),
    extra: 0,
    annualExtraPayments: 0
  };

  const schedule = buildSchedule(values);

  assert.equal(schedule.status, "stalled");
  assert.equal(schedule.paidOff, false);
  assert.equal(schedule.payoffPayments, Infinity);
});

test("long amortizing loans are allowed beyond 100 years", () => {
  const values = {
    ...defaults,
    principal: 200000,
    rate: 1,
    payments: 360,
    payment: 200,
    extra: 0,
    annualExtraPayments: 0
  };

  const solved = solve(values);
  const schedule = buildSchedule(solved.values);

  assert.equal(solved.message, "");
  assert.equal(solved.values.payments, 2152);
  assert.equal(schedule.status, "paid-off");
  assert.equal(schedule.payoffPayments, 2152);
  assert.equal(payoffLabel(schedule.payoffPayments), "179 yr 4 mo");
});

test("canPayOffWithin uses the target payment count as a hard limit", () => {
  const values = {
    ...defaults,
    principal: 200000,
    rate: 1,
    payment: 200,
    extra: 0,
    annualExtraPayments: 0
  };

  assert.equal(canPayOffWithin(values, 2151), false);
  assert.equal(canPayOffWithin(values, 2152), true);
});

test("summarize only reports savings when both schedules pay off", () => {
  const stalled = summarize({
    ...defaults,
    principal: 200000,
    rate: 6.75,
    payment: 1,
    extra: 0,
    annualExtraPayments: 12
  });

  assert.equal(stalled.amortization.paidOff, false);
  assert.equal(stalled.interestSaved, 0);
  assert.equal(stalled.timeSaved, 0);

  const accelerated = summarize({
    ...defaults,
    extra: 200
  });

  assert.equal(accelerated.baseline.paidOff, true);
  assert.equal(accelerated.amortization.paidOff, true);
  assert.ok(accelerated.interestSaved > 0);
  assert.ok(accelerated.timeSaved > 0);
});
