import { currency, currencyCents, payoffLabel, solve, summarize } from "./mortgage.js";

function countLabel(value, singular, plural) {
  const formatted = Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
  return `${formatted} ${value === 1 ? singular : plural}`;
}

function extraPaymentLine(values) {
  const hasMonthlyExtra = values.extra > 0;
  const hasAnnualExtra = values.annualExtraPayments > 0;

  if (hasMonthlyExtra && hasAnnualExtra) {
    return `${currencyCents.format(values.extra)} monthly extra plus ${countLabel(values.annualExtraPayments, "full extra payment", "full extra payments")} a year`;
  }

  if (hasMonthlyExtra) {
    return `${currencyCents.format(values.extra)} extra principal every month`;
  }

  if (hasAnnualExtra) {
    return `${countLabel(values.annualExtraPayments, "full extra payment", "full extra payments")} a year`;
  }

  return "No extra principal is in the portal yet";
}

export function buildMortyLines(readInputs) {
  const solved = solve(readInputs());
  const values = solved.values;
  const { baseline, amortization, allInMonthly, interestSaved, timeSaved } = summarize(values);
  const hasMonthlyExtra = values.extra > 0;
  const hasAnnualExtra = values.annualExtraPayments > 0;
  const hasAnyExtra = hasMonthlyExtra || hasAnnualExtra;

  if (!amortization.paidOff) {
    const monthlyInterest = values.principal * (values.rate / 100 / 12);
    const minimumLine = monthlyInterest > 0
      ? `Ah jeez Rick, we need more than ${currencyCents.format(monthlyInterest)} a month pointed at the loan just to beat the interest.`
      : "Ah jeez Rick, we need an actual payment before this balance goes anywhere.";

    const lines = [
      "Ah jeez Rick, this plan does not reach a payoff.",
      minimumLine,
      `The preview already sees ${currency.format(amortization.totalInterest)} of interest.`
    ];
    if (hasAnyExtra) lines.splice(2, 0, `Even with ${extraPaymentLine(values)}, the loan is still stuck.`);
    return lines;
  }

  if (!hasAnyExtra) {
    return [
      `Ah jeez Rick, I see the base route: ${payoffLabel(amortization.payoffPayments)}.`,
      `Interest lands around ${currency.format(amortization.totalInterest)} if you stay on this path.`,
      "Try a small monthly extra and I'll check whether it bends the timeline."
    ];
  }

  if (interestSaved <= 0 && timeSaved <= 0) {
    return [
      "Ah jeez Rick, the extras are entered, but I'm not seeing a real shortcut yet.",
      `${extraPaymentLine(values)}.`,
      `The payoff still reads ${payoffLabel(amortization.payoffPayments)}.`,
      `Base interest is ${currency.format(baseline.totalInterest)}; this route is ${currency.format(amortization.totalInterest)}.`
    ];
  }

  if (hasMonthlyExtra && hasAnnualExtra) {
    return [
      "Ah jeez Rick, monthly extra plus annual lump payments? I found the double-portal route.",
      `${extraPaymentLine(values)}.`,
      `That saves ${currency.format(interestSaved)} and cuts ${payoffLabel(timeSaved)} off the schedule.`,
      `Base route was ${payoffLabel(baseline.payoffPayments)}; this route is ${payoffLabel(amortization.payoffPayments)}.`,
      `All-in monthly averages ${currencyCents.format(allInMonthly)} with regular costs included.`
    ];
  }

  if (hasMonthlyExtra) {
    return [
      "Ah jeez Rick, I like the steady drip of extra principal.",
      `${extraPaymentLine(values)}.`,
      `It saves ${currency.format(interestSaved)} and gets you out ${payoffLabel(timeSaved)} faster.`,
      `Payoff moves from ${payoffLabel(baseline.payoffPayments)} to ${payoffLabel(amortization.payoffPayments)}.`,
      `All-in monthly is ${currencyCents.format(allInMonthly)} with the other costs included.`
    ];
  }

  return [
    "Ah jeez Rick, I see the annual-payment portal opening.",
    `${extraPaymentLine(values)}.`,
    `That saves ${currency.format(interestSaved)} and trims ${payoffLabel(timeSaved)} from the loan.`,
    `Payoff moves from ${payoffLabel(baseline.payoffPayments)} to ${payoffLabel(amortization.payoffPayments)}.`,
    `All-in monthly averages ${currencyCents.format(allInMonthly)} once I spread those yearly payments out.`
  ];
}

export function bindMascot(readInputs) {
  const morty = document.querySelector(".morty");
  const bubble = document.getElementById("mortyBubble");
  if (!morty || !bubble) return;

  let mortyLineIndex = 0;
  let mortyBubbleTimer = null;

  morty.addEventListener("click", (event) => {
    event.stopPropagation();
    const lines = buildMortyLines(readInputs);
    bubble.textContent = lines[mortyLineIndex % lines.length];
    mortyLineIndex = (mortyLineIndex + 1) % lines.length;
    bubble.classList.add("show");
    window.clearTimeout(mortyBubbleTimer);
    mortyBubbleTimer = window.setTimeout(() => {
      bubble.classList.remove("show");
    }, 3200);
  });
}
