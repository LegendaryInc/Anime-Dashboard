// =====================================================================
// --- CHARTS MODULE (charts.js) ---
// =====================================================================
// Chart.js integration for visualizing anime statistics
// =====================================================================

import { loadChartJS } from './utils.js';

// Cache for Chart.js library
let ChartLib = null;

/**
 * Ensure Chart.js is loaded
 * @returns {Promise<Object>} Chart.js library
 */
async function ensureChartJS() {
  if (ChartLib) {
    return ChartLib;
  }
  ChartLib = await loadChartJS();
  return ChartLib;
}

/**
 * Helper to create a Chart instance with lazy-loaded Chart.js
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} config - Chart configuration
 * @returns {Promise<Object>} Chart instance
 */
async function createChart(canvas, config) {
  const Chart = await ensureChartJS();
  return new Chart(canvas.getContext('2d'), config);
}

/**
 * Get theme colors from CSS variables or use defaults
 */
function getThemeColors() {
  const root = document.documentElement;
  const isNeon = document.body.classList.contains('theme-neon');
  const getColor = (varName, fallback) => {
    return getComputedStyle(root).getPropertyValue(varName).trim() || fallback;
  };

  // Use brighter, more vibrant colors for neon theme
  if (isNeon) {
    return {
      primaryColor: '#e879f9', // Bright pink/purple for neon
      borderColor: '#a855f7', // Purple border
      gridColor: 'rgba(139, 92, 246, 0.2)', // Lighter purple grid
      fontColor: '#ffffff',
      fontColorBright: '#ffffff',
      mutedColor: '#c084fc',
      accentColor: '#e879f9',
      // Brighter colors for chart elements
      chartColors: [
        '#e879f9', // Bright pink
        '#a855f7', // Purple
        '#3b82f6', // Blue
        '#10b981', // Green
        '#f59e0b', // Orange
        '#ef4444', // Red
        '#06b6d4', // Cyan
        '#8b5cf6'  // Violet
      ]
    };
  }

  return {
    primaryColor: getColor('--primary-color', '#6366f1'),
    borderColor: getColor('--border-color', '#374151'),
    gridColor: getColor('--grid-color', '#1f2937'),
    fontColor: getColor('--text-primary', '#f3f4f6'),
    fontColorBright: getColor('--text-primary', '#ffffff'),
    mutedColor: getColor('--text-muted', '#9ca3af'),
    accentColor: getColor('--accent', '#e879f9'),
    // Standard colors for other themes
    chartColors: [
      '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'
    ]
  };
}

/**
 * Render stat cards at the top of the charts tab
 */
function renderStatCards(stats) {
  const container = document.getElementById('charts-stat-cards');
  if (!container || !stats) return;

  // Get top genre by count
  const topGenre = stats.genreCounts && Object.keys(stats.genreCounts).length > 0
    ? Object.entries(stats.genreCounts).sort(([, a], [, b]) => b - a)[0][0]
    : '—';

  // Get top studio
  const topStudio = stats.topStudio || '—';

  // Get highest rated genre
  const highestRatedGenre = stats.highestRatedGenre || '—';

  // Get completion rate
  const completionRate = stats.completionRate 
    ? `${parseFloat(stats.completionRate).toFixed(1)}%`
    : '—';

  // Get top genre by watch time
  const topGenreByWatchTime = stats.watchTimeByGenre && Object.keys(stats.watchTimeByGenre).length > 0
    ? Object.entries(stats.watchTimeByGenre)
        .map(([genre, minutes]) => ({ genre, hours: minutes / 60 }))
        .sort((a, b) => b.hours - a.hours)[0]?.genre
    : '—';

  container.innerHTML = `
    <div class="stat-card-mini">
      <div class="stat-label">Top Genre</div>
      <div class="stat-value">${topGenre}</div>
    </div>
    <div class="stat-card-mini">
      <div class="stat-label">Top Studio</div>
      <div class="stat-value">${topStudio}</div>
    </div>
    <div class="stat-card-mini">
      <div class="stat-label">Highest Rated Genre</div>
      <div class="stat-value">${highestRatedGenre}</div>
    </div>
    <div class="stat-card-mini">
      <div class="stat-label">Completion Rate</div>
      <div class="stat-value">${completionRate}</div>
    </div>
  `;
}

/**
 * Render Score Distribution Chart
 */
async function renderScoreChart(stats, theme) {
  const canvas = document.getElementById('score-chart');
  if (!canvas) return null;

  if (!stats?.scoreCounts || Object.keys(stats.scoreCounts).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No score data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const labels = Object.keys(stats.scoreCounts).sort((a, b) => parseInt(a) - parseInt(b));
  const data = labels.map(label => stats.scoreCounts[label]);

  return await createChart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Anime Count',
        data: data,
        backgroundColor: themeColors.primaryColor + '80',
        borderColor: themeColors.primaryColor,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} anime`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, precision: 0 }
        },
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Score',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

/**
 * Render Status Distribution Chart
 */
async function renderStatusChart(stats, theme) {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return null;

  if (!stats?.statusCounts || Object.keys(stats.statusCounts).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No status data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const colors = themeColors.chartColors || [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'
  ];

  const labels = Object.keys(stats.statusCounts);
  const data = labels.map(label => stats.statusCounts[label]);
  const backgroundColors = labels.map((_, i) => colors[i % colors.length] + '80');
  const borderColors = labels.map((_, i) => colors[i % colors.length]);

  return await createChart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: 'Anime Count',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: themeColors.fontColorBright }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed} anime`
          }
        }
      }
    }
  });
}

/**
 * Render Watch Time by Year Chart
 */
async function renderWatchTimeYearChart(stats, theme) {
  const canvas = document.getElementById('watch-time-year-chart');
  if (!canvas) return null;

  if (!stats?.watchTimeByYear || Object.keys(stats.watchTimeByYear).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No watch time data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const years = Object.keys(stats.watchTimeByYear).sort((a, b) => parseInt(a) - parseInt(b));
  const hours = years.map(year => (stats.watchTimeByYear[year] / 60).toFixed(1));

  return await createChart(canvas, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Watch Time (hours)',
        data: hours,
        borderColor: themeColors.primaryColor,
        backgroundColor: themeColors.primaryColor + '20',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: themeColors.primaryColor,
        pointBorderColor: themeColors.borderColor,
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Watch Time: ${context.parsed.y} hours`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Hours',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Year',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

/**
 * Render Score Trends Over Time Chart
 */
async function renderScoreTrendsChart(stats, theme) {
  const canvas = document.getElementById('score-trends-chart');
  if (!canvas) return null;

  if (!stats?.averageScoreByYear || Object.keys(stats.averageScoreByYear).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No score trend data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const years = Object.keys(stats.averageScoreByYear).sort((a, b) => parseInt(a) - parseInt(b));
  const scores = years.map(year => parseFloat(stats.averageScoreByYear[year]));

  return await createChart(canvas, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Average Score',
        data: scores,
        borderColor: themeColors.primaryColor,
        backgroundColor: themeColors.primaryColor + '20',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: themeColors.primaryColor,
        pointBorderColor: themeColors.borderColor,
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Average Score: ${context.parsed.y.toFixed(1)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 0,
          max: 10,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, precision: 1 },
          title: {
            display: true,
            text: 'Average Score',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Year',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

/**
 * Render Watch Time by Genre Chart
 */
async function renderWatchTimeGenreChart(stats, theme) {
  const canvas = document.getElementById('watch-time-genre-chart');
  if (!canvas) return null;

  if (!stats?.watchTimeByGenre || Object.keys(stats.watchTimeByGenre).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No watch time data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const genreData = Object.entries(stats.watchTimeByGenre)
    .map(([genre, minutes]) => ({ genre, hours: minutes / 60 }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10); // Top 10 genres

  const labels = genreData.map(d => d.genre);
  const data = genreData.map(d => d.hours.toFixed(1));

  return await createChart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Watch Time (hours)',
        data: data,
        backgroundColor: themeColors.primaryColor + '80',
        borderColor: themeColors.primaryColor,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Watch Time: ${context.parsed.x} hours`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Hours',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, maxRotation: 45, minRotation: 0 }
        }
      }
    }
  });
}

/**
 * Render Average Score by Genre Chart
 */
async function renderGenreScoreChart(stats, theme) {
  const canvas = document.getElementById('genre-score-chart');
  if (!canvas) return null;

  if (!stats?.averageScoreByGenre || Object.keys(stats.averageScoreByGenre).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No score data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const genreData = Object.entries(stats.averageScoreByGenre)
    .map(([genre, score]) => ({ genre, score: parseFloat(score) }))
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 genres

  const labels = genreData.map(d => d.genre);
  const data = genreData.map(d => d.score);

  return await createChart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Score',
        data: data,
        backgroundColor: themeColors.primaryColor + '80',
        borderColor: themeColors.primaryColor,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Average Score: ${context.parsed.x.toFixed(1)}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: false,
          min: 0,
          max: 10,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, precision: 1 },
          title: {
            display: true,
            text: 'Average Score',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, maxRotation: 45, minRotation: 0 }
        }
      }
    }
  });
}

/**
 * Render Completion Rate by Genre Chart
 */
async function renderCompletionRateGenreChart(stats, theme) {
  const canvas = document.getElementById('completion-rate-genre-chart');
  if (!canvas) return null;

  if (!stats?.completionRateByGenre || Object.keys(stats.completionRateByGenre).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No completion rate data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const genreData = Object.entries(stats.completionRateByGenre)
    .map(([genre, rate]) => ({ genre, rate: parseFloat(rate) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10); // Top 10 genres

  const labels = genreData.map(d => d.genre);
  const data = genreData.map(d => d.rate);

  return await createChart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Completion Rate (%)',
        data: data,
        backgroundColor: themeColors.primaryColor + '80',
        borderColor: themeColors.primaryColor,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Completion Rate: ${context.parsed.x.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, callback: (value) => `${value}%` },
          title: {
            display: true,
            text: 'Completion Rate (%)',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, maxRotation: 45, minRotation: 0 }
        }
      }
    }
  });
}

/**
 * Render Genre Evolution Over Time Chart
 */
async function renderGenreEvolutionChart(stats, theme) {
  const canvas = document.getElementById('genre-evolution-chart');
  if (!canvas) return null;

  if (!stats?.genreEvolutionByYear || Object.keys(stats.genreEvolutionByYear).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No genre evolution data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const colors = themeColors.chartColors || [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
  ];

  const years = Object.keys(stats.genreEvolutionByYear).sort((a, b) => parseInt(a) - parseInt(b));
  const allGenres = new Set();
  years.forEach(year => {
    Object.keys(stats.genreEvolutionByYear[year]).forEach(genre => allGenres.add(genre));
  });

  const topGenres = Array.from(allGenres)
    .map(genre => {
      const total = years.reduce((sum, year) => sum + (stats.genreEvolutionByYear[year][genre] || 0), 0);
      return { genre, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map(d => d.genre);

  const datasets = topGenres.map((genre, i) => ({
    label: genre,
    data: years.map(year => stats.genreEvolutionByYear[year][genre] || 0),
    borderColor: colors[i % colors.length],
    backgroundColor: colors[i % colors.length] + '20',
    borderWidth: 2,
    fill: false,
    tension: 0.4
  }));

  return await createChart(canvas, {
    type: 'line',
    data: {
      labels: years,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: themeColors.fontColorBright }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, precision: 0 },
          title: {
            display: true,
            text: 'Anime Count',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Year',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

/**
 * Render Top 10 Studios Chart
 */
async function renderStudioChart(stats, theme) {
  const canvas = document.getElementById('studio-chart');
  if (!canvas) return null;

  if (!stats?.studioCounts || Object.keys(stats.studioCounts).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No studio data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const studioData = Object.entries(stats.studioCounts)
    .map(([studio, count]) => ({ studio, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 studios

  const labels = studioData.map(d => d.studio);
  const data = studioData.map(d => d.count);

  return await createChart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Anime Count',
        data: data,
        backgroundColor: themeColors.primaryColor + '80',
        borderColor: themeColors.primaryColor,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
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
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, precision: 0 },
          title: {
            display: true,
            text: 'Anime Count',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        y: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, maxRotation: 45, minRotation: 0 }
        }
      }
    }
  });
}

/**
 * Render Anime Completed Per Year Chart
 */
async function renderCompletedPerYearChart(stats, theme) {
  const canvas = document.getElementById('completed-per-year-chart');
  if (!canvas) return null;

  if (!stats?.completedPerYear || Object.keys(stats.completedPerYear).length === 0) {
    canvas.parentElement.parentElement.innerHTML = '<p class="text-center p-8 theme-text-muted">No completion data available</p>';
    return null;
  }

  const themeColors = getThemeColors();
  const years = Object.keys(stats.completedPerYear).sort((a, b) => parseInt(a) - parseInt(b));
  const counts = years.map(year => stats.completedPerYear[year]);

  return await createChart(canvas, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Anime Completed',
        data: counts,
        backgroundColor: themeColors.primaryColor + '80',
        borderColor: themeColors.primaryColor,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} anime completed`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright, precision: 0 },
          title: {
            display: true,
            text: 'Anime Completed',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        },
        x: {
          grid: { color: themeColors.gridColor },
          ticks: { color: themeColors.fontColorBright },
          title: {
            display: true,
            text: 'Year',
            color: themeColors.fontColorBright,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

/**
 * Main function to render all charts
 * @param {Object} stats - Statistics object from calculateStatistics
 * @param {Object} theme - Theme object (currently unused, kept for compatibility)
 * @param {Object} scoreChartInstance - Existing score chart instance to destroy
 * @returns {Object} Object containing all chart instances
 */
// Store chart instances for cleanup
let chartInstances = {};

/**
 * Destroy all existing chart instances
 */
async function destroyAllCharts() {
  Object.values(chartInstances).forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      try {
        chart.destroy();
      } catch (e) {
        console.warn('Failed to destroy chart:', e);
      }
    }
  });
  chartInstances = {};
  
  // Only destroy Chart.js charts if Chart.js is loaded
  if (ChartLib || window.Chart) {
    const Chart = ChartLib || window.Chart;
    const chartIds = [
      'score-chart', 'status-chart', 'watch-time-year-chart',
      'score-trends-chart', 'watch-time-genre-chart', 'genre-score-chart',
      'completion-rate-genre-chart', 'genre-evolution-chart',
      'studio-chart', 'completed-per-year-chart'
    ];
    
    chartIds.forEach(id => {
      const chart = Chart.getChart(id);
      if (chart) {
        try {
          chart.destroy();
        } catch (e) {
          // Ignore errors
        }
      }
    });
  }
}

export async function renderCharts(stats, theme, scoreChartInstance) {
  // Ensure Chart.js is loaded first
  await ensureChartJS();
  
  // Render stat cards first
  renderStatCards(stats);

  // Destroy all existing charts before creating new ones
  await destroyAllCharts();

  // Render all charts and store instances
  chartInstances = {
    scoreChartInstance: await renderScoreChart(stats, theme),
    statusChart: await renderStatusChart(stats, theme),
    watchTimeYearChart: await renderWatchTimeYearChart(stats, theme),
    scoreTrendsChart: await renderScoreTrendsChart(stats, theme),
    watchTimeGenreChart: await renderWatchTimeGenreChart(stats, theme),
    genreScoreChart: await renderGenreScoreChart(stats, theme),
    completionRateGenreChart: await renderCompletionRateGenreChart(stats, theme),
    genreEvolutionChart: await renderGenreEvolutionChart(stats, theme),
    studioChart: await renderStudioChart(stats, theme),
    completedPerYearChart: await renderCompletedPerYearChart(stats, theme)
  };

  return chartInstances;
}

/**
 * Cleanup function to destroy all charts (for memory management)
 */
export function cleanupCharts() {
  destroyAllCharts();
}
