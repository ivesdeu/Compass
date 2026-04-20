import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
window.Chart = Chart;

if (Chart.defaults) {
  Chart.defaults.font.family =
    '"Helvetica Now Pro Display Medium", system-ui, -apple-system, sans-serif';
}
