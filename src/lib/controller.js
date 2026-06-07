import { drawChart } from "./chart.js";
import { bindMascot } from "./mascot.js";
import {
  currency,
  currencyCents,
  defaults,
  fieldIds,
  formatCount,
  formatNumber,
  formatRate,
  monthlyPayment,
  numericFieldIds,
  parseNumber,
  payoffLabel,
  solve,
  summarize
} from "./mortgage.js";
import { clearStoredValues, loadStoredValues, saveValues } from "./storage.js";

const fields = Object.fromEntries(fieldIds.map((id) => [id, document.getElementById(id)]));
const warning = document.getElementById("warning");
const scheduleBody = document.getElementById("schedule");
const tableHint = document.getElementById("tableHint");
const tablePageStatus = document.getElementById("tablePageStatus");
const paginationButtons = Array.from(document.querySelectorAll("[data-page-action]"));
const chart = document.getElementById("chart");
const schedulePageSize = 12;
let schedulePage = 0;
let currentScheduleRows = [];

function readInputs() {
  return {
    solveFor: fields.solveFor.value,
    principal: Math.max(0, parseNumber(fields.principal.value)),
    rate: Math.max(0, parseNumber(fields.rate.value)),
    payments: Math.max(1, Math.round(parseNumber(fields.payments.value))),
    payment: Math.max(0, parseNumber(fields.payment.value)),
    extra: Math.max(0, parseNumber(fields.extra.value)),
    annualExtraPayments: Math.max(0, parseNumber(fields.annualExtraPayments.value)),
    otherCosts: Math.max(0, parseNumber(fields.otherCosts.value))
  };
}

function updateReadonly() {
  ["principal", "rate", "payments", "payment"].forEach((id) => {
    const shouldBeReadonly = fields.solveFor.value === id
      || (fields.solveFor.value === "payment" && id === "payment")
      || (fields.solveFor.value === "payoff" && id === "payments");
    if (fields[id].readOnly !== shouldBeReadonly) {
      fields[id].readOnly = shouldBeReadonly;
    }
  });
}

function computedFieldIds(solveFor) {
  if (solveFor === "payoff" || solveFor === "payments") return ["payments"];
  if (solveFor === "payment") return ["payment"];
  if (solveFor === "principal") return ["principal"];
  if (solveFor === "rate") return ["rate"];
  return [];
}

function formattedValues(values) {
  return {
    principal: formatNumber(values.principal, 2),
    rate: formatRate(values.rate),
    payments: String(values.payments),
    payment: formatNumber(values.payment, 2),
    extra: formatNumber(values.extra, 2),
    annualExtraPayments: formatCount(values.annualExtraPayments),
    otherCosts: formatNumber(values.otherCosts, 2)
  };
}

function syncFields(values, { formatInputs = true } = {}) {
  const idsToSync = formatInputs ? fieldIds : computedFieldIds(values.solveFor);
  if (!formatInputs && idsToSync.includes(document.activeElement?.id)) return;

  const formatted = formattedValues(values);
  idsToSync.forEach((id) => {
    if (id === "solveFor") fields[id].value = values.solveFor;
    else fields[id].value = formatted[id];
  });
}

function renderSchedule(rows, { resetPage = false } = {}) {
  currentScheduleRows = rows;
  if (resetPage) schedulePage = 0;
  const pageCount = Math.max(1, Math.ceil(rows.length / schedulePageSize));
  schedulePage = Math.min(Math.max(schedulePage, 0), pageCount - 1);
  const start = schedulePage * schedulePageSize;
  const visibleRows = rows.slice(start, start + schedulePageSize);

  scheduleBody.innerHTML = visibleRows.length ? visibleRows.map((row) => `
    <tr>
      <td>${row.number}</td>
      <td>${currencyCents.format(row.principal)}</td>
      <td>${currencyCents.format(row.interest)}</td>
      <td>${currencyCents.format(row.extra)}</td>
      <td>${currencyCents.format(row.balance)}</td>
    </tr>
  `).join("") : `
    <tr>
      <td colspan="5">No payments to preview</td>
    </tr>
  `;

  const end = start + visibleRows.length;
  tableHint.textContent = rows.length
    ? `Payments ${start + 1}-${end} of ${rows.length}`
    : "No payments";
  tablePageStatus.textContent = `Page ${schedulePage + 1} of ${pageCount}`;
  paginationButtons.forEach((button) => {
    const action = button.dataset.pageAction;
    button.disabled = rows.length === 0
      || ((action === "first" || action === "prev") && schedulePage === 0)
      || ((action === "next" || action === "last") && schedulePage === pageCount - 1);
  });
}

function updateSummary(values, summary) {
  const hasAcceleration = values.extra > 0 || values.annualExtraPayments > 0;
  const amortizationInterest = summary.amortization.paidOff
    ? currency.format(summary.amortization.totalInterest)
    : `>${currency.format(summary.amortization.totalInterest)}`;
  const baselineInterest = summary.baseline.paidOff
    ? currency.format(summary.baseline.totalInterest)
    : `>${currency.format(summary.baseline.totalInterest)}`;

  document.getElementById("allInLabel").textContent = hasAcceleration ? "Avg accelerated monthly" : "Avg monthly";
  document.getElementById("interestLabel").textContent = hasAcceleration ? "Accelerated interest" : "Total interest";
  document.getElementById("payoffLabel").textContent = hasAcceleration ? "Accelerated payoff" : "Payoff";
  document.getElementById("monthlyOut").textContent = currencyCents.format(values.payment);
  document.getElementById("allInOut").textContent = currencyCents.format(summary.allInMonthly);
  document.getElementById("interestOut").textContent = amortizationInterest;
  document.getElementById("payoffOut").textContent = payoffLabel(summary.amortization.payoffPayments);
  document.getElementById("baseInterestOut").textContent = baselineInterest;
  document.getElementById("basePayoffOut").textContent = payoffLabel(summary.baseline.payoffPayments);
  document.getElementById("interestSavedOut").textContent = currency.format(summary.interestSaved);
  document.getElementById("timeSavedOut").textContent = payoffLabel(summary.timeSaved);
}

function render({ formatInputs = true } = {}) {
  const activeElement = document.activeElement;
  const shouldRestoreSelection = !formatInputs
    && activeElement instanceof HTMLInputElement
    && activeElement.selectionStart !== null
    && activeElement.selectionEnd !== null;
  const selection = shouldRestoreSelection
    ? {
        element: activeElement,
        value: activeElement.value,
        start: activeElement.selectionStart,
        end: activeElement.selectionEnd
      }
    : null;

  updateReadonly();
  const solved = solve(readInputs());
  const values = solved.values;
  syncFields(values, { formatInputs });

  warning.textContent = solved.message;
  warning.classList.toggle("show", Boolean(solved.message));

  const summary = summarize(values);
  updateSummary(values, summary);
  renderSchedule(summary.amortization.rows, { resetPage: true });
  drawChart(chart, summary.amortization.rows, values.principal, summary.baseline.rows, {
    hasAcceleration: values.extra > 0 || values.annualExtraPayments > 0
  });

  if (selection && document.activeElement === selection.element && selection.element.value === selection.value) {
    selection.element.setSelectionRange(selection.start, selection.end);
  }

  saveValues(values);
  return { values };
}

function bindTermMenu() {
  const termCalc = document.getElementById("termCalc");
  const termMenu = document.getElementById("termMenu");

  function setPaymentForTerm(years) {
    const values = readInputs();
    const payments = years * 12;
    fields.payments.value = String(payments);
    fields.payment.value = formatNumber(monthlyPayment(values.principal, values.rate, payments), 2);
    fields.solveFor.value = "payoff";
    render();
  }

  function closeTermMenu() {
    termMenu.classList.remove("show");
    termCalc.setAttribute("aria-expanded", "false");
  }

  termCalc.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = termMenu.classList.toggle("show");
    termCalc.setAttribute("aria-expanded", String(isOpen));
  });

  termMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-years]");
    if (!option) return;
    setPaymentForTerm(Number(option.dataset.years));
    closeTermMenu();
  });

  document.addEventListener("click", closeTermMenu);
}

function bindSchedulePagination() {
  paginationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const pageCount = Math.max(1, Math.ceil(currentScheduleRows.length / schedulePageSize));
      if (button.dataset.pageAction === "first") schedulePage = 0;
      else if (button.dataset.pageAction === "prev") schedulePage -= 1;
      else if (button.dataset.pageAction === "next") schedulePage += 1;
      else if (button.dataset.pageAction === "last") schedulePage = pageCount - 1;
      renderSchedule(currentScheduleRows);
    });
  });
}

function resetCalculator() {
  fieldIds.forEach((id) => {
    if (id === "solveFor") fields[id].value = defaults.solveFor;
    else if (id === "payments") fields[id].value = String(defaults[id]);
    else if (id === "rate") fields[id].value = formatRate(defaults[id]);
    else if (id === "annualExtraPayments") fields[id].value = formatCount(defaults[id]);
    else fields[id].value = formatNumber(defaults[id], 2);
  });
  clearStoredValues();
  render();
}

function bindInputs() {
  document.getElementById("apply").addEventListener("click", render);
  fields.solveFor.addEventListener("change", render);
  document.getElementById("reset").addEventListener("click", resetCalculator);

  numericFieldIds.forEach((id) => {
    fields[id].addEventListener("input", () => {
      window.clearTimeout(fields[id].timer);
      fields[id].timer = window.setTimeout(() => render({ formatInputs: false }), 180);
    });
    fields[id].addEventListener("blur", () => render({ formatInputs: true }));
  });
}

bindInputs();
bindTermMenu();
bindSchedulePagination();
bindMascot(readInputs);

const storedValues = loadStoredValues();
if (storedValues) syncFields(storedValues, { formatInputs: true });
render();
