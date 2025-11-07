// =====================================================================
// --- EXPORT MODULE (export.js) ---
// =====================================================================
// Handles exporting anime data in various formats
// =====================================================================

import { loadJsPDF } from './utils.js';

/**
 * Export anime data as JSON
 */
export function exportAsJSON(animeData) {
  if (!animeData || animeData.length === 0) {
    return null;
  }
  
  const jsonString = JSON.stringify(animeData, null, 2);
  return {
    content: jsonString,
    filename: `anime-list-${new Date().toISOString().split('T')[0]}.json`,
    mimeType: 'application/json'
  };
}

/**
 * Export anime data as CSV
 */
export function exportAsCSV(animeData) {
  if (!animeData || animeData.length === 0) {
    return null;
  }
  
  // CSV headers
  const headers = [
    'Title',
    'Status',
    'Score',
    'Episodes Watched',
    'Total Episodes',
    'Started Date',
    'Completed Date',
    'Genres',
    'Studio',
    'Format',
    'AniList ID',
    'MAL ID'
  ];
  
  // Convert data to CSV rows
  const rows = animeData.map(anime => {
    const title = (anime.title || anime._romaji || anime._english || 'Unknown').replace(/"/g, '""');
    const status = anime.status || '';
    const score = anime.score || '';
    const episodesWatched = anime.episodesWatched || '';
    const totalEpisodes = anime.totalEpisodes || '';
    const startedDate = anime.startedAt 
      ? `${anime.startedAt.year || ''}-${String(anime.startedAt.month || '').padStart(2, '0')}-${String(anime.startedAt.day || '').padStart(2, '0')}`
      : '';
    const completedDate = anime.completedAt
      ? `${anime.completedAt.year || ''}-${String(anime.completedAt.month || '').padStart(2, '0')}-${String(anime.completedAt.day || '').padStart(2, '0')}`
      : '';
    const genres = (anime.genres || []).join('; ');
    const studio = (anime.studios && anime.studios.length > 0) ? anime.studios[0] : (anime.studio || '');
    const format = anime.format || '';
    const anilistId = anime.id || '';
    const malId = anime.malId || '';
    
    return [
      `"${title}"`,
      status,
      score,
      episodesWatched,
      totalEpisodes,
      startedDate,
      completedDate,
      `"${genres}"`,
      `"${studio}"`,
      format,
      anilistId,
      malId
    ].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  
  return {
    content: csvContent,
    filename: `anime-list-${new Date().toISOString().split('T')[0]}.csv`,
    mimeType: 'text/csv'
  };
}

/**
 * Export anime data as MyAnimeList XML format
 */
export function exportAsMALXML(animeData) {
  if (!animeData || animeData.length === 0) {
    return null;
  }
  
  // MAL XML format
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<myanimelist>\n';
  xml += '  <myinfo>\n';
  xml += '    <user_export_type>1</user_export_type>\n';
  xml += `    <user_total_anime>${animeData.length}</user_total_anime>\n`;
  xml += '  </myinfo>\n';
  xml += '  <anime>\n';
  
  animeData.forEach(anime => {
    const title = (anime.title || anime._romaji || anime._english || 'Unknown')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    // Map status to MAL format
    const statusMap = {
      'Watching': '1',
      'Completed': '2',
      'On Hold': '3',
      'Dropped': '4',
      'Plan to Watch': '6',
      'Current': '1',
      'Paused': '3',
      'Dropped': '4',
      'Planning': '6'
    };
    const malStatus = statusMap[anime.status] || '6';
    
    // Score (MAL uses 0-10, but 0 means unrated)
    const malScore = anime.score && anime.score > 0 ? anime.score : '0';
    
    // Episodes watched
    const episodesWatched = anime.episodesWatched || '0';
    
    // Dates (MAL format: YYYY-MM-DD)
    const startDate = anime.startedAt
      ? `${anime.startedAt.year || ''}-${String(anime.startedAt.month || '').padStart(2, '0')}-${String(anime.startedAt.day || '').padStart(2, '0')}`
      : '';
    const finishDate = anime.completedAt
      ? `${anime.completedAt.year || ''}-${String(anime.completedAt.month || '').padStart(2, '0')}-${String(anime.completedAt.day || '').padStart(2, '0')}`
      : '';
    
    // Notes
    const notes = (anime.notes || '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    xml += '    <anime>\n';
    xml += `      <series_animedb_id>${anime.malId || anime.id || ''}</series_animedb_id>\n`;
    xml += `      <series_title><![CDATA[${title}]]></series_title>\n`;
    xml += `      <series_type>${anime.format || 'TV'}</series_type>\n`;
    xml += `      <series_episodes>${anime.totalEpisodes || '0'}</series_episodes>\n`;
    xml += `      <my_id>0</my_id>\n`;
    xml += `      <my_watched_episodes>${episodesWatched}</my_watched_episodes>\n`;
    xml += `      <my_start_date>${startDate}</my_start_date>\n`;
    xml += `      <my_finish_date>${finishDate}</my_finish_date>\n`;
    xml += `      <my_score>${malScore}</my_score>\n`;
    xml += `      <my_status>${malStatus}</my_status>\n`;
    xml += `      <my_rewatching>0</my_rewatching>\n`;
    xml += `      <my_rewatching_ep>0</my_rewatching_ep>\n`;
    xml += `      <my_last_updated>${Math.floor(Date.now() / 1000)}</my_last_updated>\n`;
    xml += `      <my_tags><![CDATA[${notes}]]></my_tags>\n`;
    xml += '    </anime>\n';
  });
  
  xml += '  </anime>\n';
  xml += '</myanimelist>\n';
  
  return {
    content: xml,
    filename: `myanimelist-${new Date().toISOString().split('T')[0]}.xml`,
    mimeType: 'application/xml'
  };
}

/**
 * Download export file
 */
export function downloadExport(exportData) {
  if (!exportData) {
    console.error('No export data provided');
    return;
  }
  
  // Handle blob exports (PDF) or string content (JSON, CSV, XML)
  const blob = exportData.blob || new Blob([exportData.content], { type: exportData.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportData.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export all charts and statistics as a comprehensive PDF
 * @param {Object} stats - Statistics object from calculateStatistics
 * @returns {Promise<Object|null>} Export data object or null if charts not found
 */
export async function exportChartsAsPDF(stats) {
  // Lazy load jsPDF if not already loaded
  let jsPDF;
  try {
    jsPDF = await loadJsPDF();
  } catch (error) {
    console.error('Failed to load jsPDF library:', error);
    return null;
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredHeight) => {
    if (yPos + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper function to add title
  const addTitle = (text, size = 24) => {
    checkPageBreak(20);
    yPos += 5;
    doc.setFontSize(size);
    doc.setFont(undefined, 'bold');
    doc.text(text, margin, yPos);
    yPos += 12;
    doc.setFont(undefined, 'normal');
  };

  // Helper function to add section header
  const addSectionHeader = (text) => {
    checkPageBreak(18);
    yPos += 6;
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text(text, margin, yPos);
    yPos += 8;
    doc.setFont(undefined, 'normal');
  };

  // Helper function to temporarily increase chart font sizes and change colors for PDF export
  const increaseChartFontSizes = (chart) => {
    if (!chart || !chart.options) return null;
    
    const originalConfig = {
      scales: {},
      plugins: {}
    };
    
    const fontSizeMultiplier = 1.3; // 1.3x larger for better readability (reduced for cleaner look)
    const pdfTextColor = '#000000'; // Black for maximum readability in PDF
    
    // Store original font sizes and increase them, also change colors
    if (chart.options.scales) {
      Object.keys(chart.options.scales).forEach(scaleKey => {
        const scale = chart.options.scales[scaleKey];
        if (!originalConfig.scales[scaleKey]) {
          originalConfig.scales[scaleKey] = {};
        }
        
        // Increase tick font size and change color
        if (scale.ticks) {
          originalConfig.scales[scaleKey].ticks = JSON.parse(JSON.stringify(scale.ticks));
          if (!scale.ticks.font) {
            scale.ticks.font = {};
          }
          const currentSize = scale.ticks.font.size || 12;
          scale.ticks.font.size = currentSize * fontSizeMultiplier;
          scale.ticks.font.family = scale.ticks.font.family || 'Arial';
          scale.ticks.font.weight = scale.ticks.font.weight || 'normal';
          // Change color to black for readability
          scale.ticks.color = pdfTextColor;
        }
        
        // Increase title font size and change color
        if (scale.title) {
          originalConfig.scales[scaleKey].title = JSON.parse(JSON.stringify(scale.title));
          if (!scale.title.font) {
            scale.title.font = {};
          }
          const currentSize = scale.title.font.size || 12;
          scale.title.font.size = currentSize * fontSizeMultiplier;
          scale.title.font.family = scale.title.font.family || 'Arial';
          scale.title.font.weight = scale.title.font.weight || 'bold';
          // Change color to black for readability
          scale.title.color = pdfTextColor;
        }
      });
    }
    
    // Increase legend font size and change color
    if (chart.options.plugins && chart.options.plugins.legend) {
      originalConfig.plugins.legend = JSON.parse(JSON.stringify(chart.options.plugins.legend));
      if (!chart.options.plugins.legend.labels) {
        chart.options.plugins.legend.labels = {};
      }
      if (!chart.options.plugins.legend.labels.font) {
        chart.options.plugins.legend.labels.font = {};
      }
      const currentSize = chart.options.plugins.legend.labels.font.size || 12;
      chart.options.plugins.legend.labels.font.size = currentSize * fontSizeMultiplier;
      chart.options.plugins.legend.labels.font.family = chart.options.plugins.legend.labels.font.family || 'Arial';
      // Change color to black for readability
      chart.options.plugins.legend.labels.color = pdfTextColor;
    }
    
    // Increase tooltip font size and change color
    if (chart.options.plugins && chart.options.plugins.tooltip) {
      if (!originalConfig.plugins.tooltip) {
        originalConfig.plugins.tooltip = JSON.parse(JSON.stringify(chart.options.plugins.tooltip));
      }
      if (!chart.options.plugins.tooltip.titleFont) {
        chart.options.plugins.tooltip.titleFont = {};
      }
      if (!chart.options.plugins.tooltip.bodyFont) {
        chart.options.plugins.tooltip.bodyFont = {};
      }
      const titleSize = chart.options.plugins.tooltip.titleFont.size || 12;
      const bodySize = chart.options.plugins.tooltip.bodyFont.size || 12;
      chart.options.plugins.tooltip.titleFont.size = titleSize * fontSizeMultiplier;
      chart.options.plugins.tooltip.bodyFont.size = bodySize * fontSizeMultiplier;
      // Change tooltip colors to black for readability
      chart.options.plugins.tooltip.titleColor = pdfTextColor;
      chart.options.plugins.tooltip.bodyColor = pdfTextColor;
    }
    
    // Update the chart to apply new font sizes and colors
    chart.update('none'); // 'none' mode for faster update
    
    return originalConfig;
  };
  
  // Helper function to restore original chart font sizes
  const restoreChartFontSizes = (chart, originalConfig) => {
    if (!chart || !chart.options || !originalConfig) return;
    
    // Restore scales
    if (chart.options.scales && originalConfig.scales) {
      Object.keys(originalConfig.scales).forEach(scaleKey => {
        const scale = chart.options.scales[scaleKey];
        const original = originalConfig.scales[scaleKey];
        
        if (scale && original) {
          if (original.ticks && scale.ticks) {
            scale.ticks = JSON.parse(JSON.stringify(original.ticks));
          }
          if (original.title && scale.title) {
            scale.title = JSON.parse(JSON.stringify(original.title));
          }
        }
      });
    }
    
    // Restore legend
    if (chart.options.plugins && chart.options.plugins.legend && originalConfig.plugins?.legend) {
      chart.options.plugins.legend = JSON.parse(JSON.stringify(originalConfig.plugins.legend));
    }
    
    // Restore tooltip
    if (chart.options.plugins && chart.options.plugins.tooltip && originalConfig.plugins?.tooltip) {
      chart.options.plugins.tooltip = JSON.parse(JSON.stringify(originalConfig.plugins.tooltip));
    }
    
    // Update the chart to restore original font sizes
    chart.update('none');
  };

  // Helper function to wait for chart update
  const waitForChartUpdate = (chart) => {
    return new Promise((resolve) => {
      chart.update('none');
      // Wait for next animation frame to ensure chart is rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  };

  // Helper function to add chart
  const addChart = async (chartId, chartName, width = 160, height = 90) => {
    const chart = Chart.getChart(chartId);
    if (!chart) {
      console.warn(`Chart not found: ${chartId}`);
      return false;
    }

    checkPageBreak(height + 20);

    // Add chart title with better spacing
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text(chartName, margin, yPos);
    yPos += 6;

    // Temporarily increase font sizes for PDF export
    const originalConfig = increaseChartFontSizes(chart);
    
    // Wait for chart to update with new font sizes
    await waitForChartUpdate(chart);
    
    // Export chart as image at higher resolution (2x for better quality)
    const imageData = chart.toBase64Image('image/png', 2.0);
    
    // Restore original font sizes
    restoreChartFontSizes(chart, originalConfig);
    
    // Calculate aspect ratio to maintain chart proportions
    const canvas = document.getElementById(chartId);
    if (canvas) {
      const aspectRatio = canvas.width / canvas.height;
      const chartHeight = width / aspectRatio;
      doc.addImage(imageData, 'PNG', margin, yPos, width, chartHeight);
      yPos += chartHeight + 8;
    } else {
      doc.addImage(imageData, 'PNG', margin, yPos, width, height);
      yPos += height + 8;
    }

    return true;
  };

  // Helper function to add stat cards data
  const addStatCards = () => {
    if (!stats) return;

    checkPageBreak(50);
    
    const statsData = [
      { label: 'Total Anime Watched', value: stats.totalAnime || 0 },
      { label: 'Total Episodes', value: (stats.totalEpisodes || 0).toLocaleString() },
      { label: 'Time Spent Watching', value: `${stats.timeWatchedDays || 0}d ${stats.timeWatchedHours || 0}h ${stats.timeWatchedMinutes || 0}m` },
      { label: 'Mean Score', value: typeof stats.meanScore === 'number' ? stats.meanScore.toFixed(2) : stats.meanScore || '0' },
      { label: 'Top Genre', value: stats.genreCounts && Object.keys(stats.genreCounts).length > 0 
        ? Object.entries(stats.genreCounts).sort(([, a], [, b]) => b - a)[0][0] 
        : '—' },
      { label: 'Top Studio', value: stats.topStudio || '—' },
      { label: 'Highest Rated Genre', value: stats.highestRatedGenre || '—' },
      { label: 'Completion Rate', value: stats.completionRate ? `${parseFloat(stats.completionRate).toFixed(1)}%` : '—' }
    ];

    const cols = 2;
    const colWidth = contentWidth / cols;
    const rowHeight = 14;
    let col = 0;
    let xPos = margin;
    let currentRowY = yPos;

    statsData.forEach((stat, index) => {
      // Check if we need a new row
      if (col === 0) {
        checkPageBreak(rowHeight + 5);
        currentRowY = yPos;
      }

      // Draw a subtle background box for each stat
      const boxWidth = colWidth - 5;
      const boxHeight = rowHeight - 2;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(245, 245, 245);
      // Use rect if roundedRect is not available
      if (typeof doc.roundedRect === 'function') {
        doc.roundedRect(xPos, currentRowY - boxHeight + 2, boxWidth, boxHeight, 2, 2, 'FD');
      } else {
        doc.rect(xPos, currentRowY - boxHeight + 2, boxWidth, boxHeight, 'FD');
      }

      // Add label
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(stat.label + ':', xPos + 3, currentRowY - 2);
      
      // Add value
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      const valueX = xPos + boxWidth - 3;
      doc.text(stat.value.toString(), valueX, currentRowY - 2, { align: 'right' });

      // Reset text color
      doc.setTextColor(0, 0, 0);

      col++;
      if (col >= cols) {
        col = 0;
        xPos = margin;
        yPos = currentRowY + rowHeight;
      } else {
        xPos += colWidth;
      }
    });

    if (col > 0) {
      yPos = currentRowY + rowHeight;
    }
    yPos += 8;
  };

  // Page 1: Title and Overview
  addTitle('Anime Dashboard Statistics Report', 24);
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, margin, yPos);
  yPos += 15;
  
  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Add stat cards data
  addSectionHeader('Quick Overview');
  addStatCards();
  yPos += 5;

  // Page 2+: Core Patterns
  addSectionHeader('Core Patterns');
  
  await addChart('score-chart', 'Score Distribution', 160, 90);
  await addChart('status-chart', 'Status Distribution', 160, 90);
  await addChart('watch-time-year-chart', 'Watch Time by Year', 160, 90);
  await addChart('score-trends-chart', 'Score Trends Over Time', 160, 90);

  // Genre Insights
  addSectionHeader('Genre Insights');
  
  await addChart('watch-time-genre-chart', 'Watch Time by Genre', 160, 90);
  await addChart('genre-score-chart', 'Average Score by Genre', 160, 90);
  await addChart('completion-rate-genre-chart', 'Completion Rate by Genre', 160, 90);
  await addChart('genre-evolution-chart', 'Genre Evolution Over Time', 160, 90);

  // Studio Insights
  addSectionHeader('Studio Insights');
  
  await addChart('studio-chart', 'Top 10 Studios', 160, 90);
  await addChart('completed-per-year-chart', 'Anime Completed Per Year', 160, 90);

  // Generate filename
  const filename = `anime-dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`;

  // Get PDF as blob
  const pdfBlob = doc.output('blob');

  return {
    blob: pdfBlob,
    filename: filename,
    mimeType: 'application/pdf'
  };
}

/**
 * Get all available export formats
 */
export function getExportFormats() {
  return [
    { id: 'json', name: 'JSON', description: 'Full data with all fields', icon: '📄' },
    { id: 'csv', name: 'CSV', description: 'Spreadsheet format', icon: '📊' },
    { id: 'mal-xml', name: 'MAL XML', description: 'MyAnimeList import format', icon: '📋' },
    { id: 'chart-pdf', name: 'Charts (PDF)', description: 'Export all charts and statistics as PDF', icon: '📈' }
  ];
}

