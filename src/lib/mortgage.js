export const defaults = {
  solveFor: "payoff",
  principal: 200000,
  rate: 6.75,
  payments: 360,
  payment: 1297.2,
  extra: 0,
  annualExtraPayments: 0,
  otherCosts: 1000
};

export const fieldIds = ["solveFor", "principal", "rate", "payments", "payment", "extra", "annualExtraPayments", "otherCosts"];
export const numericFieldIds = ["principal", "rate", "payments", "payment", "extra", "annualExtraPayments", "otherCosts"];
export const balanceTolerance = 0.005;

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export const currencyCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function parseNumber(value) {
  const cleaned = String(value).trim().toLowerCase().replace(/[$,%\s,]/g, "");
  const shorthand = cleaned.match(/^([-+]?\d*\.?\d+)([kmb])?$/);
  if (shorthand) {
    const multipliers = { k: 1000, m: 1000000, b: 1000000000 };
    const multiplier = multipliers[shorthand[2]] || 1;
    return Number(shorthand[1]) * multiplier;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

export function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function formatRate(value) {
  return formatNumber(value, 3).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatCount(value) {
  return formatNumber(value, 2).replace(/0+$/, "").replace(/\.$/, "");
}

export function monthlyPayment(principal, annualRate, payments) {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / payments;
  const factor = Math.pow(1 + monthlyRate, payments);
  return principal * monthlyRate * factor / (factor - 1);
}

export function payoffPaymentsFromSchedule(values) {
  const schedule = buildSchedule(values);
  return schedule.payoffPayments;
}

export function canPayOffWithin(values, targetPayments) {
  const schedule = buildSchedule(values, { maxRows: targetPayments });
  return Boolean(schedule.paidOff && schedule.payoffPayments <= targetPayments);
}

export function solvePaymentForTarget(values) {
  const targetPayments = Math.max(1, values.payments);
  let low = 0;
  let high = Math.max(monthlyPayment(values.principal, values.rate, targetPayments), values.principal / targetPayments, 1);

  while (!canPayOffWithin({ ...values, payment: high }, targetPayments) && high < values.principal * 2) {
    high *= 2;
  }

  if (!canPayOffWithin({ ...values, payment: high }, targetPayments)) return NaN;

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (canPayOffWithin({ ...values, payment: mid }, targetPayments)) high = mid;
    else low = mid;
  }

  return high;
}

export function solvePrincipalForTarget(values) {
  const targetPayments = Math.max(1, values.payments);
  const fullAnnualExtraPayments = Math.floor(targetPayments / 12) * values.payment * values.annualExtraPayments;
  let low = 0;
  let high = Math.max((values.payment + values.extra) * targetPayments + fullAnnualExtraPayments, 1);

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (canPayOffWithin({ ...values, principal: mid }, targetPayments)) low = mid;
    else high = mid;
  }

  return low;
}

export function solveRateForTarget(values) {
  const targetPayments = Math.max(1, values.payments);
  if (!canPayOffWithin({ ...values, rate: 0 }, targetPayments)) return NaN;

  let low = 0;
  let high = 100;
  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    if (canPayOffWithin({ ...values, rate: mid }, targetPayments)) low = mid;
    else high = mid;
  }

  return low;
}

export function solve(values) {
  const next = { ...values };
  let message = "";

  if (next.solveFor === "payoff" || next.solveFor === "payments") {
    const schedule = buildSchedule(next);
    next.payments = schedule.payoffPayments;
    if (!Number.isFinite(next.payments)) {
      if (schedule.status === "stalled") {
        const minimum = next.principal * (next.rate / 100 / 12);
        message = `Monthly payment plus extra principal must be more than ${currencyCents.format(minimum)} to reduce the balance at this rate.`;
      } else {
        message = "This loan is still amortizing beyond the supported schedule preview.";
      }
      next.payments = values.payments;
    }
  } else if (next.solveFor === "payment") {
    next.payment = solvePaymentForTarget(next);
    if (!Number.isFinite(next.payment)) {
      message = "Could not find a monthly payment that pays off the loan within the selected payment count.";
      next.payment = values.payment;
    }
  } else if (next.solveFor === "principal") {
    next.principal = solvePrincipalForTarget(next);
  } else if (next.solveFor === "rate") {
    next.rate = solveRateForTarget(next);
    if (!Number.isFinite(next.rate)) {
      message = "That payment plan is too low for the selected loan amount and payment count, even at 0% interest.";
      next.rate = values.rate;
    }
  }

  return { values: next, message };
}

export function buildSchedule({ principal, rate, payments, payment, extra, annualExtraPayments = 0 }, { maxRows } = {}) {
  const monthlyRate = rate / 100 / 12;
  let balance = principal;
  let totalInterest = 0;
  const rows = [];
  const rowLimit = maxRows ?? Math.max(12000, payments + 600);
  let status = principal <= balanceTolerance ? "paid-off" : "truncated";

  for (let i = 1; i <= rowLimit && balance > balanceTolerance; i += 1) {
    const interest = balance * monthlyRate;
    const recurringAvailable = payment + extra;
    const annualExtra = i % 12 === 0 ? payment * annualExtraPayments : 0;
    const totalAvailable = recurringAvailable + annualExtra;
    if (recurringAvailable < interest || (recurringAvailable <= interest && payment * annualExtraPayments <= 0)) {
      rows.push({
        number: i,
        principal: 0,
        interest,
        extra: 0,
        balance
      });
      totalInterest += interest;
      status = "stalled";
      break;
    }

    const totalPrincipal = Math.min(totalAvailable - interest, balance);
    const scheduledPrincipal = Math.min(Math.max(payment - interest, 0), totalPrincipal);
    const extraPrincipal = totalPrincipal - scheduledPrincipal;
    balance = Math.max(0, balance - scheduledPrincipal - extraPrincipal);
    totalInterest += interest;
    rows.push({
      number: i,
      principal: scheduledPrincipal,
      interest,
      extra: extraPrincipal,
      balance
    });
  }

  const paidOff = balance <= balanceTolerance;
  if (paidOff) status = "paid-off";

  return {
    rows,
    totalInterest,
    payoffPayments: paidOff ? rows.length : Infinity,
    paidOff,
    status,
    remainingBalance: balance
  };
}

export function payoffLabel(payments) {
  if (!Number.isFinite(payments)) return "Not paid off";
  const years = Math.floor(payments / 12);
  const months = payments % 12;
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}

export function summarize(values) {
  const baseline = buildSchedule({ ...values, extra: 0, annualExtraPayments: 0 });
  const amortization = buildSchedule(values);
  const averageAnnualExtra = values.payment * values.annualExtraPayments / 12;
  const allInMonthly = values.payment + values.extra + averageAnnualExtra + values.otherCosts;
  const interestSaved = baseline.paidOff && amortization.paidOff
    ? Math.max(0, baseline.totalInterest - amortization.totalInterest)
    : 0;
  const timeSaved = baseline.paidOff && amortization.paidOff
    ? Math.max(0, baseline.payoffPayments - amortization.payoffPayments)
    : 0;

  return {
    baseline,
    amortization,
    allInMonthly,
    interestSaved,
    timeSaved
  };
}
