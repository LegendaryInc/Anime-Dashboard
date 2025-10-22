// =====================================================================
// --- CHARTS MODULE (charts.js) ---
// =====================================================================
// Handles the rendering and updating of all Chart.js instances.
// =====================================================================

/**
 * Renders the Genre Distribution and Score Distribution charts.
 * @param {object} stats - The calculated statistics object.
 * @param {object} stats.genreCounts - Counts of each genre.
 * @param {object} stats.scoreCounts - Counts of each score.
 * @param {Chart | null} genreChartInstance - The *existing* genre chart instance (or null).
 * @param {Chart | null} scoreChartInstance - The *existing* score chart instance (or null).
 * @returns {object} An object containing the new { genreChartInstance, scoreChartInstance }.
 */
export function renderCharts({ genreCounts, scoreCounts }, genreChartInstance, scoreChartInstance) {
  const genreChartCanvas = document.getElementById('genre-chart');
  const genreChartFallback = document.getElementById('genre-chart-fallback');
  const scoreChartCanvas = document.getElementById('score-chart');

  if (!genreChartCanvas || !scoreChartCanvas) {
    return { genreChartInstance, scoreChartInstance };
  }

  // --- 1. Destroy old charts before drawing new ones ---
  if (genreChartInstance) genreChartInstance.destroy();
  if (scoreChartInstance) scoreChartInstance.destroy();

  // --- 2. Theme-based styling ---
  const theme = document.body.className;
  const chartFontColor = theme.includes('neon') ? '#e2e8f0' : '#4A5568';
  const chartGridColor = theme.includes('neon') ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
  const chartBorderColor = theme.includes('neon')
    ? '#0f172a'
    : theme.includes('sakura')
      ? '#fff1f2'
      : theme.includes('sky')
        ? '#f0f9ff'
        : '#F0F4F8';

  // --- 3. Genre Chart ---
  const sortedGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, window.CONFIG.CHART_GENRE_LIMIT || 10);

  let newGenreChartInstance = null;
  if (sortedGenres.length > 0) {
    genreChartCanvas.style.display = 'block';
    if (genreChartFallback) genreChartFallback.classList.add('hidden');

    newGenreChartInstance = new Chart(genreChartCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: sortedGenres.map(g => g[0]),
        datasets: [{
          data: sortedGenres.map(g => g[1]),
          backgroundColor: [
            '#818cf8', '#f472b6', '#60a5fa', '#fb923c',
            '#a78bfa', '#f87171', '#4ade80', '#2dd4bf',
            '#fbbf24', '#93c5fd', '#fde047', '#d946ef'
          ],
          borderColor: chartBorderColor,
          borderWidth: 3,
          hoverOffset: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,     // ✅ Fixed aspect ratio
        aspectRatio: 1.5,              // Keeps proportional width/height
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: chartFontColor,
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            bodyFont: { size: 12 },
            titleFont: { size: 14 }
          }
        }
      }
    });
  } else {
    genreChartCanvas.style.display = 'none';
    if (genreChartFallback) genreChartFallback.classList.remove('hidden');
  }

  // --- 4. Score Chart ---
  const scoreLabels = Object.keys(scoreCounts).sort((a, b) => Number(a) - Number(b));
  const scoreData = scoreLabels.map(label => scoreCounts[label]);

  let barColor = '#6366F1';
  if (theme.includes('theme-sakura')) barColor = '#F472B6';
  else if (theme.includes('theme-sky')) barColor = '#38BDF8';
  else if (theme.includes('theme-neon')) barColor = '#e879f9';

  const newScoreChartInstance = new Chart(scoreChartCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: scoreLabels,
      datasets: [{
        label: 'Number of Anime',
        data: scoreData,
        backgroundColor: barColor,
        borderColor: barColor,
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: barColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,     // ✅ Fixed aspect ratio
      aspectRatio: 1.5,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) label += context.parsed.y;
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: chartGridColor },
          ticks: { color: chartFontColor, precision: 0 },
          title: {
            display: true,
            text: 'Count',
            color: chartFontColor,
            font: { size: 12 }
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: chartFontColor },
          title: {
            display: true,
            text: 'Score',
            color: chartFontColor,
            font: { size: 12 }
          }
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
      }
    }
  });

  // --- 5. Return new instances ---
  return {
    genreChartInstance: newGenreChartInstance,
    scoreChartInstance: newScoreChartInstance
  };
}
