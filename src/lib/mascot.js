import { buildSchedule, currency, currencyCents, payoffLabel, solve, summarize } from "./mortgage.js";

export function buildMortyLines(readInputs) {
  const solved = solve(readInputs());
  const values = solved.values;
  const baseline = buildSchedule({ ...values, extra: 0, annualExtraPayments: 0 });
  const accelerated = buildSchedule(values);
  const { allInMonthly, interestSaved, timeSaved } = summarize(values);

  return [
    `Ah jeez, ${payoffLabel(accelerated.payoffPayments)} to go.`,
    `That interest is ${currency.format(accelerated.totalInterest)}.`,
    `You save ${currency.format(interestSaved)} in interest.`,
    `That's ${payoffLabel(timeSaved)} faster.`,
    `All-in monthly is ${currencyCents.format(allInMonthly)}.`,
    `Base interest was ${currency.format(baseline.totalInterest)}.`,
    `Extra principal is ${currencyCents.format(values.extra)} a month.`,
    `${values.annualExtraPayments} extra payment(s) a year.`
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
