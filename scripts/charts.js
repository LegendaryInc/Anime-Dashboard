// =====================================================================
// --- CHARTS MODULE (charts.js) ---
// =====================================================================
// Handles the rendering and updating of all Chart.js instances.
// =====================================================================

/**
 * Renders all charts on the Visualizations tab
 * @param {object} stats - The calculated statistics object.
 * @param {Chart | null} genreChartInstance - Existing genre chart instance
 * @param {Chart | null} scoreChartInstance - Existing score chart instance
 * @returns {object} An object containing all chart instances
 */
export function renderCharts(stats, genreChartInstance, scoreChartInstance) {
  // Destroy old charts
  if (genreChartInstance) genreChartInstance.destroy();
  if (scoreChartInstance) scoreChartInstance.destroy();
  
  // Destroy additional chart instances if they exist
  if (window.studioChartInstance) window.studioChartInstance.destroy();
  if (window.formatChartInstance) window.formatChartInstance.destroy();
  if (window.statusChartInstance) window.statusChartInstance.destroy();
  if (window.genreScoreChartInstance) window.genreScoreChartInstance.destroy();

  // Get theme styling
  const theme = getThemeStyles();
  
  // Render stat cards
  renderStatCards(stats);
  
  // Render all charts
  const newGenreChart = renderGenreChart(stats, theme);
  const newScoreChart = renderScoreChart(stats, theme);
  const newStudioChart = renderStudioChart(stats, theme);
  const newFormatChart = renderFormatChart(stats, theme);
  const newStatusChart = renderStatusChart(stats, theme);
  const newGenreScoreChart = renderGenreScoreChart(stats, theme);

  // Store instances globally for destruction later
  window.studioChartInstance = newStudioChart;
  window.formatChartInstance = newFormatChart;
  window.statusChartInstance = newStatusChart;
  window.genreScoreChartInstance = newGenreScoreChart;

  return {
    genreChartInstance: newGenreChart,
    scoreChartInstance: newScoreChart
  };
}

/**
 * Get theme-based styling
 */
function getThemeStyles() {
  const themeClass = document.body.className;
  const isNeon = themeClass.includes('neon');
  const isSakura = themeClass.includes('sakura');
  const isSky = themeClass.includes('sky');
  
  return {
    fontColor: isNeon ? '#e2e8f0' : '#4A5568',
    gridColor: isNeon ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
    borderColor: isNeon ? '#0f172a' : isSakura ? '#fff1f2' : isSky ? '#f0f9ff' : '#F0F4F8',
    primaryColor: isNeon ? '#e879f9' : isSakura ? '#F472B6' : isSky ? '#38BDF8' : '#6366F1',
    isNeon,
    isSakura,
    isSky
  };
}

/**
 * Render stat cards at the top
 */
function renderStatCards(stats) {
  const container = document.getElementById('charts-stat-cards');
  if (!container) return;
  
  container.innerHTML = `
    <div class="stat-card-mini">
      <div class="stat-label">Completion Rate</div>
      <div class="stat-value">${stats.completionRate}%</div>
    </div>
    <div class="stat-card-mini">
      <div class="stat-label">Top Studio</div>
      <div class="stat-value">${stats.topStudio || 'N/A'}</div>
    </div>
    <div class="stat-card-mini">
      <div class="stat-label">Best Genre</div>
      <div class="stat-value">${stats.highestRatedGenre || 'N/A'}</div>
    </div>
    <div class="stat-card-mini">
      <div class="stat-label">Avg Episodes/Anime</div>
      <div class="stat-value">${stats.averageEpisodesPerAnime}</div>
    </div>
  `;
}

/**
 * Render Genre Distribution Chart (existing)
 */
function renderGenreChart(stats, theme) {
  const canvas = document.getElementById('genre-chart');
  const fallback = document.getElementById('genre-chart-fallback');
  if (!canvas) return null;

  const sortedGenres = Object.entries(stats.genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, window.CONFIG.CHART_GENRE_LIMIT || 10);

  if (sortedGenres.length === 0) {
    canvas.style.display = 'none';
    if (fallback) fallback.classList.remove('hidden');
    return null;
  }

  canvas.style.display = 'block';
  if (fallback) fallback.classList.add('hidden');

  return new Chart(canvas.getContext('2d'), {
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
        borderColor: theme.borderColor,
        borderWidth: 3,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.fontColor,
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
}

/**
 * Render Score Distribution Chart (existing, but exclude 0)
 */
function renderScoreChart(stats, theme) {
  const canvas = document.getElementById('score-chart');
  if (!canvas) return null;

  const scoreLabels = Object.keys(stats.scoreCounts)
    .filter(score => Number(score) !== 0)
    .sort((a, b) => Number(a) - Number(b));
  
  const scoreData = scoreLabels.map(label => stats.scoreCounts[label]);

  return new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: scoreLabels,
      datasets: [{
        label: 'Number of Anime',
        data: scoreData,
        backgroundColor: theme.primaryColor,
        borderColor: theme.primaryColor,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Count: ${context.parsed.y}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: theme.gridColor },
          ticks: { color: theme.fontColor, precision: 0 },
          title: {
            display: true,
            text: 'Count',
            color: theme.fontColor,
            font: { size: 12 }
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: theme.fontColor },
          title: {
            display: true,
            text: 'Score',
            color: theme.fontColor,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

/**
 * ⭐ NEW: Render Top Studios Chart
 */
function renderStudioChart(stats, theme) {
  const canvas = document.getElementById('studio-chart');
  if (!canvas) return null;

  const sortedStudios = Object.entries(stats.studioCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (sortedStudios.length === 0) {
    canvas.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No studio data available</p>';
    return null;
  }

  return new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: sortedStudios.map(([name]) => name),
      datasets: [{
        label: 'Anime Count',
        data: sortedStudios.map(([, count]) => count),
        backgroundColor: theme.primaryColor,
        borderColor: theme.primaryColor,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.x} anime`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: theme.gridColor },
          ticks: { color: theme.fontColor, precision: 0 },
          title: {
            display: true,
            text: 'Number of Anime',
            color: theme.fontColor,
            font: { size: 12 }
          }
        },
        y: {
          grid: { display: false },
          ticks: { 
            color: theme.fontColor,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

/**
 * ⭐ NEW: Render Format Distribution Chart
 */
function renderFormatChart(stats, theme) {
  const canvas = document.getElementById('format-chart');
  if (!canvas) return null;

  const formatData = Object.entries(stats.formatCounts)
    .sort(([, a], [, b]) => b - a);

  if (formatData.length === 0) {
    canvas.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No format data available</p>';
    return null;
  }

  return new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: formatData.map(([name]) => name),
      datasets: [{
        data: formatData.map(([, count]) => count),
        backgroundColor: [
          '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
          '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
        ],
        borderColor: theme.borderColor,
        borderWidth: 3,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.fontColor,
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed} (${((context.parsed / formatData.reduce((sum, [, count]) => sum + count, 0)) * 100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

/**
 * ⭐ NEW: Render Status Distribution Chart
 */
function renderStatusChart(stats, theme) {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return null;

  const statusData = Object.entries(stats.statusCounts)
    .sort(([, a], [, b]) => b - a);

  if (statusData.length === 0) {
    canvas.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No status data available</p>';
    return null;
  }

  // Status-specific colors
  const statusColors = {
    'Completed': '#10b981',
    'Current': '#3b82f6',
    'Watching': '#3b82f6',
    'Planning': '#f59e0b',
    'Paused': '#f97316',
    'Dropped': '#ef4444',
    'Repeating': '#8b5cf6'
  };

  return new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels: statusData.map(([name]) => name),
      datasets: [{
        data: statusData.map(([, count]) => count),
        backgroundColor: statusData.map(([name]) => statusColors[name] || '#6b7280'),
        borderColor: theme.borderColor,
        borderWidth: 2,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.fontColor,
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed} (${((context.parsed / statusData.reduce((sum, [, count]) => sum + count, 0)) * 100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

/**
 * ⭐ NEW: Render Average Score by Genre Chart
 */
function renderGenreScoreChart(stats, theme) {
  const canvas = document.getElementById('genre-score-chart');
  if (!canvas) return null;

  const genreScores = Object.entries(stats.averageScoreByGenre)
    .sort(([, a], [, b]) => parseFloat(b) - parseFloat(a))
    .slice(0, 10);

  if (genreScores.length === 0) {
    canvas.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No genre score data available</p>';
    return null;
  }

  return new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: genreScores.map(([name]) => name),
      datasets: [{
        label: 'Average Score',
        data: genreScores.map(([, score]) => parseFloat(score)),
        backgroundColor: genreScores.map(([, score]) => {
          const s = parseFloat(score);
          if (s >= 8) return '#10b981';
          if (s >= 6) return '#3b82f6';
          if (s >= 4) return '#f59e0b';
          return '#ef4444';
        }),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Avg Score: ${context.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          grid: { color: theme.gridColor },
          ticks: { color: theme.fontColor },
          title: {
            display: true,
            text: 'Average Score',
            color: theme.fontColor,
            font: { size: 12 }
          }
        },
        x: {
          grid: { display: false },
          ticks: { 
            color: theme.fontColor,
            font: { size: 11 }
          }
        }
      }
    }
  });
}