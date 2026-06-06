import { currency } from "./mortgage.js";

function pluralizePayments(count) {
  return `${count} payment${count === 1 ? "" : "s"}`;
}

export function drawChart(chart, rows, principal, baselineRows = []) {
  const ctx = chart.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, chart.width, chart.height);
  const pad = { left: 54, right: 22, top: 24, bottom: 42 };
  const width = chart.width - pad.left - pad.right;
  const height = chart.height - pad.top - pad.bottom;
  const timelinePayments = Math.max(rows.length, baselineRows.length, 1);

  function plotLine(seriesRows) {
    const points = [{ number: 0, balance: principal }, ...seriesRows];
    points.forEach((row, index) => {
      const paymentNumber = index === 0 ? 0 : row.number;
      const x = pad.left + (paymentNumber / timelinePayments) * width;
      const y = pad.top + (1 - row.balance / Math.max(principal, 1)) * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }

  ctx.strokeStyle = "#d8dee8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, chart.height - pad.bottom);
  ctx.lineTo(chart.width - pad.right, chart.height - pad.bottom);
  ctx.stroke();

  ctx.fillStyle = "#657386";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(currency.format(principal), 10, pad.top + 8);
  ctx.fillText("0", 34, chart.height - pad.bottom + 7);

  if (!rows.length) return;

  if (baselineRows.length) {
    ctx.strokeStyle = "#9aa6b5";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    plotLine(baselineRows);
    ctx.stroke();
  }

  ctx.strokeStyle = "#2367c8";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  plotLine(rows);
  ctx.stroke();

  ctx.fillStyle = "#17202a";
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText("Balance over time", pad.left, chart.height - 12);

  ctx.font = "20px system-ui, sans-serif";
  const legendY = chart.height - 12;
  const baseLabel = baselineRows.length ? `Base: ${pluralizePayments(baselineRows.length)}` : "";
  const acceleratedLabel = `Accelerated: ${pluralizePayments(rows.length)}`;
  const gap = 24;
  const swatchWidth = 28;
  const swatchGap = 7;
  const baseWidth = baseLabel ? swatchWidth + swatchGap + ctx.measureText(baseLabel).width : 0;
  const acceleratedWidth = swatchWidth + swatchGap + ctx.measureText(acceleratedLabel).width;
  let legendX = chart.width - pad.right - acceleratedWidth - (baseLabel ? baseWidth + gap : 0);
  legendX = Math.max(pad.left + 245, legendX);

  function drawLegendItem(x, color, label, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, legendY - 8);
    ctx.lineTo(x + swatchWidth, legendY - 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(label, x + swatchWidth + swatchGap, legendY);
    return x + swatchWidth + swatchGap + ctx.measureText(label).width;
  }

  if (baseLabel) {
    legendX = drawLegendItem(legendX, "#9aa6b5", baseLabel, 3) + gap;
  }
  drawLegendItem(legendX, "#2367c8", acceleratedLabel, 5);
}
