// scripts/anime-modal.js
// Enhanced Anime Details Modal with Notes Support and Data Fetching

import { showToast } from './toast.js';
import { saveDataToLocalStorage } from './storage.js';
import { getStatusBadgeClass } from './ui.js';
import { handleError } from './error-handler.js';
import { showButtonLoading, showLoadingOverlay } from './loading.js';
import { trapFocus, releaseFocus, saveFocus, restoreFocus, updateModalAria, escapeHtml } from './utils.js';

// Lazy import for custom lists (to avoid circular dependencies)
let renderAddToListButton = null;
async function getAddToListButton(animeId) {
  if (!renderAddToListButton) {
    const module = await import('./custom-lists-view.js');
    renderAddToListButton = module.renderAddToListButton;
  }
  if (renderAddToListButton) {
    return renderAddToListButton(animeId);
  }
  return ''; // Return empty if not available
}

/**
 * Populate "Add to List" button in modal
 */
async function populateModalAddToListButton(animeId) {
  const container = document.getElementById('anime-details-add-to-list-container');
  if (!container || !animeId) return;
  
  // Load custom lists first
  try {
    const { loadCustomLists } = await import('./custom-lists.js');
    await loadCustomLists();
  } catch (error) {
    // Silent fail for custom lists - not critical
    console.warn('Could not load custom lists:', error);
  }
  
  // Populate the button
  const buttonHtml = await getAddToListButton(animeId);
  if (buttonHtml) {
    container.innerHTML = buttonHtml;
  }
}

/**
 * Open enhanced anime details modal
 * Fetches full data from AniList if needed
 */
export async function openAnimeDetailsModal(anime) {
  console.log('openAnimeDetailsModal called with:', anime?.title);
  const backdrop = document.getElementById('anime-details-modal-backdrop');
  if (!backdrop) {
    console.error('Modal backdrop not found!');
    return;
  }
  console.log('Backdrop found, showing modal...');
  
  // Save current focus for restoration
  saveFocus();

  // Scroll to top of viewport immediately to ensure modal appears in view
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  // Prevent body scroll when modal is open (but allow modal content to scroll)
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Show modal immediately - force display first, then add class
  backdrop.style.display = 'flex';
  backdrop.style.opacity = '1';
  backdrop.style.pointerEvents = 'auto';
  backdrop.style.visibility = 'visible';
  backdrop.style.zIndex = '100000'; // Higher than everything else
  backdrop.style.background = 'rgba(0, 0, 0, 0.5)'; // Force background color
  backdrop.style.position = 'fixed'; // Force position
  backdrop.style.top = '0';
  backdrop.style.left = '0';
  backdrop.style.right = '0';
  backdrop.style.bottom = '0';
  backdrop.style.width = '100vw';
  backdrop.style.height = '100vh';
  backdrop.classList.add('show');
  
  // Also ensure modal content is visible
  const modalContent = document.getElementById('anime-details-modal-content');
  if (modalContent) {
    modalContent.style.display = 'block';
    modalContent.style.visibility = 'visible';
    modalContent.style.position = 'relative'; // Ensure it's positioned
    modalContent.style.opacity = '1'; // Force opacity
    modalContent.classList.remove('hidden');
    
    // Log content dimensions
    console.log('Modal content width:', modalContent.offsetWidth);
    console.log('Modal content height:', modalContent.offsetHeight);
    console.log('Modal content computed display:', window.getComputedStyle(modalContent).display);
    console.log('Modal content computed opacity:', window.getComputedStyle(modalContent).opacity);
  }
  
  // Force a reflow to ensure styles are applied
  void backdrop.offsetHeight;
  
  // Check if backdrop is in a hidden parent
  let parent = backdrop.parentElement;
  let parentHidden = false;
  while (parent && parent !== document.body) {
    const parentDisplay = window.getComputedStyle(parent).display;
    const parentVisibility = window.getComputedStyle(parent).visibility;
    if (parentDisplay === 'none' || parentVisibility === 'hidden' || parent.classList.contains('hidden')) {
      console.warn('Modal backdrop parent is hidden:', parent.id || parent.className, {
        display: parentDisplay,
        visibility: parentVisibility,
        hasHiddenClass: parent.classList.contains('hidden')
      });
      parentHidden = true;
      // Move backdrop to body if parent is hidden
      if (parent.classList.contains('hidden') || parentDisplay === 'none') {
        console.log('Moving modal backdrop to body...');
        document.body.appendChild(backdrop);
        break;
      }
    }
    parent = parent.parentElement;
  }
  
  // Re-apply styles after moving to body
  if (parentHidden) {
    backdrop.style.display = 'flex';
    backdrop.style.opacity = '1';
    backdrop.style.pointerEvents = 'auto';
    backdrop.style.visibility = 'visible';
    backdrop.style.zIndex = '100000';
    backdrop.style.background = 'rgba(0, 0, 0, 0.5)';
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.right = '0';
    backdrop.style.bottom = '0';
    backdrop.style.width = '100vw';
    backdrop.style.height = '100vh';
  }
  
  console.log('Modal backdrop classes:', backdrop.className);
  console.log('Modal backdrop computed display:', window.getComputedStyle(backdrop).display);
  console.log('Modal backdrop computed opacity:', window.getComputedStyle(backdrop).opacity);
  console.log('Modal backdrop computed z-index:', window.getComputedStyle(backdrop).zIndex);
  console.log('Modal backdrop computed visibility:', window.getComputedStyle(backdrop).visibility);
  console.log('Modal backdrop computed position:', window.getComputedStyle(backdrop).position);
  console.log('Modal backdrop computed top:', window.getComputedStyle(backdrop).top);
  console.log('Modal backdrop computed left:', window.getComputedStyle(backdrop).left);
  console.log('Modal backdrop computed width:', window.getComputedStyle(backdrop).width);
  console.log('Modal backdrop computed height:', window.getComputedStyle(backdrop).height);
  console.log('Modal backdrop computed background:', window.getComputedStyle(backdrop).background);
  console.log('Modal backdrop offsetWidth:', backdrop.offsetWidth);
  console.log('Modal backdrop offsetHeight:', backdrop.offsetHeight);
  console.log('Modal backdrop getBoundingClientRect:', backdrop.getBoundingClientRect());
  
  if (modalContent) {
    console.log('Modal content computed display:', window.getComputedStyle(modalContent).display);
    console.log('Modal content computed visibility:', window.getComputedStyle(modalContent).visibility);
    console.log('Modal content computed opacity:', window.getComputedStyle(modalContent).opacity);
    console.log('Modal content getBoundingClientRect:', modalContent.getBoundingClientRect());
  }
  
  // Update ARIA attributes (set aria-hidden to false when showing)
  // Do this AFTER setting display to ensure the modal is visible
  requestAnimationFrame(() => {
    updateModalAria(backdrop, true);
  });
  
  // Trap focus within modal
  trapFocus(backdrop);
  
  // Reset modal content scroll position
  if (modalContent) {
    modalContent.scrollTop = 0;
  }
  
  // Populate basic info first (what we already have)
  document.getElementById('anime-details-title').textContent = anime.title || 'Loading...';
  document.getElementById('anime-details-cover-img').src = anime.coverImage || '';
  
  // Show loading state for synopsis
  const synopsisEl = document.getElementById('anime-details-synopsis');
  if (synopsisEl) synopsisEl.textContent = 'Loading...';
  
  // Check if we need to fetch full data
  const needsFullData = !anime.description || !anime.studios || anime.studios.length === 0;
  
  let fullAnime = anime;
  let hideLoading = null;
  
  if (needsFullData && anime.id) {
    // Show loading overlay on modal content
    const modalContent = document.getElementById('anime-details-modal-content');
    if (modalContent) {
      hideLoading = showLoadingOverlay(modalContent, 'Loading anime details...');
    }
    
    try {
      // Fetch full anime data from AniList
      const query = `
        query ($id: Int) {
          Media(id: $id) {
            id
            title { romaji }
            coverImage { large }
            description
            genres
            format
            episodes
            seasonYear
            season
            averageScore
            studios { nodes { name } }
            source
            trailer { id site }
            startDate { year month day }
            siteUrl
            staff {
              edges {
                role
                node {
                  id
                  name {
                    full
                  }
                }
              }
            }
          }
        }
      `;
      
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables: { id: parseInt(anime.id) } })
      });
      
      const data = await response.json();
      const media = data?.data?.Media;
      
      if (media) {
        // Process staff data
        const staffData = media.staff?.edges?.map(edge => ({
          role: edge.role,
          name: edge.node?.name?.full || 'Unknown'
        })) || [];
        
        // Merge fetched data with existing anime object
        fullAnime = {
          ...anime,
          description: media.description,
          studios: media.studios?.nodes?.map(s => s.name) || [],
          source: media.source,
          averageScore: media.averageScore,
          trailer: media.trailer,
          startDate: media.startDate,
          siteUrl: media.siteUrl,
          staff: staffData
        };
        
        // Update the local data cache
        if (window.animeData) {
          const index = window.animeData.findIndex(a => a.id === anime.id);
          if (index !== -1) {
            window.animeData[index] = { ...window.animeData[index], ...fullAnime };
            saveDataToLocalStorage(window.animeData);
          }
        }
      }
    } catch (error) {
      handleError(error, 'loading anime details', {
        showToast: true
      });
      // Continue with partial data
    } finally {
      if (hideLoading) hideLoading();
    }
  }
  
  // Now populate all fields with fullAnime data
  populateModalWithData(fullAnime);
  
  // Load related anime and recommendations
  if (fullAnime.id) {
    loadRelatedAndRecommendations(fullAnime.id);
  }
}

/**
 * Populate modal with anime data
 */
function populateModalWithData(anime) {
  // Title and cover
  const titleEl = document.getElementById('anime-details-title');
  if (titleEl) titleEl.textContent = anime.title || 'Unknown';
  const coverImg = document.getElementById('anime-details-cover-img');
  if (coverImg) coverImg.src = anime.coverImage || '';
  
  // Meta badges
  const year = anime.seasonYear || anime.startDate?.year || '—';
  const format = anime.format || '—';
  const episodesCount = anime.totalEpisodes ? `${anime.totalEpisodes} Episodes` : '—';
  
  const yearEl = document.getElementById('anime-details-year');
  if (yearEl) yearEl.textContent = year;
  const formatEl = document.getElementById('anime-details-format');
  if (formatEl) formatEl.textContent = format;
  const episodesCountEl = document.getElementById('anime-details-episodes-count');
  if (episodesCountEl) episodesCountEl.textContent = episodesCount;
  
  // Quick stats
  const scoreDisplay = document.querySelector('#anime-details-modal-content .score-display span');
  const scoreInput = document.querySelector('#anime-details-modal-content .score-input');
  const score = anime.score || 0;
  
  if (scoreDisplay) scoreDisplay.textContent = score > 0 ? score.toFixed(1) : 'N/A';
  if (scoreInput) {
    scoreInput.value = score;
    scoreInput.dataset.animeId = anime.id;
    scoreInput.dataset.animeTitle = anime.title;
  }
  
  // Progress
  const watched = anime.episodesWatched || 0;
  const total = anime.totalEpisodes || '?';
  const progressEl = document.getElementById('anime-details-progress');
  if (progressEl) progressEl.textContent = `${watched}/${total}`;
  
  const addEpisodeBtn = document.getElementById('anime-details-add-episode');
  if (addEpisodeBtn) {
    addEpisodeBtn.dataset.animeId = anime.id;
    addEpisodeBtn.dataset.title = anime.title;
    addEpisodeBtn.dataset.watched = watched;
    addEpisodeBtn.dataset.total = anime.totalEpisodes || 0;
    addEpisodeBtn.disabled = anime.totalEpisodes && watched >= anime.totalEpisodes;
  }
  
  // Status
  const statusBadge = document.querySelector('#anime-details-modal-content .status-badge-clickable span:first-child');
  const statusSelect = document.querySelector('#anime-details-modal-content .status-select');
  
  if (statusBadge) statusBadge.textContent = anime.status || 'Unknown';
  if (statusSelect) {
    statusSelect.value = anime.status || 'Watching';
    statusSelect.dataset.animeId = anime.id;
    statusSelect.dataset.animeTitle = anime.title;
  }
  
  // Apply status badge styling
  const statusContainer = document.querySelector('#anime-details-modal-content .status-badge-clickable');
  if (statusContainer) {
    statusContainer.className = 'status-badge-clickable';
    const statusClass = getStatusBadgeClass(anime.status)?.class || '';
    if (statusClass) statusContainer.classList.add(statusClass);
  }
  
  // Synopsis
  const synopsis = anime.description?.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '') || 'No synopsis available.';
  const synopsisEl = document.getElementById('anime-details-synopsis');
  if (synopsisEl) synopsisEl.textContent = synopsis;
  
  // Information grid
  const studios = anime.studios?.length > 0 ? anime.studios.join(', ') : '—';
  
  // Format source: LIGHT_NOVEL -> Light Novel, VISUAL_NOVEL -> Visual Novel, etc.
  let source = anime.source || '—';
  if (source !== '—') {
    source = source
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Format season: WINTER -> Winter, etc.
  let seasonText = '—';
  if (anime.season && anime.seasonYear) {
    const formattedSeason = anime.season.charAt(0).toUpperCase() + anime.season.slice(1).toLowerCase();
    seasonText = `${formattedSeason} ${anime.seasonYear}`;
  }
  
  const avgScore = anime.averageScore ? `${anime.averageScore}%` : '—';
  
  const studiosEl = document.getElementById('anime-details-studios');
  if (studiosEl) studiosEl.textContent = studios;
  const sourceEl = document.getElementById('anime-details-source');
  if (sourceEl) sourceEl.textContent = source;
  const seasonEl = document.getElementById('anime-details-season');
  if (seasonEl) seasonEl.textContent = seasonText;
  const avgScoreEl = document.getElementById('anime-details-avg-score');
  if (avgScoreEl) avgScoreEl.textContent = avgScore;
  
  // Staff
  const staffSection = document.getElementById('anime-details-staff-section');
  const staffContainer = document.getElementById('anime-details-staff');
  if (staffContainer && anime.staff && anime.staff.length > 0) {
    if (staffSection) staffSection.style.display = 'block';
    
    // Group staff by role
    const staffByRole = {};
    anime.staff.forEach(member => {
      const role = member.role || 'Other';
      if (!staffByRole[role]) staffByRole[role] = [];
      staffByRole[role].push(member.name);
    });
    
    // Render staff (show top roles: Director, Writer, Music, etc.)
    const priorityRoles = ['Director', 'Writer', 'Music', 'Character Design', 'Animation Director'];
    const otherRoles = Object.keys(staffByRole).filter(r => !priorityRoles.includes(r));
    const allRoles = [...priorityRoles.filter(r => staffByRole[r]), ...otherRoles];
    
    if (allRoles.length > 0) {
      staffContainer.innerHTML = allRoles.slice(0, 6).map(role => {
        const names = staffByRole[role].slice(0, 3).join(', ');
        const more = staffByRole[role].length > 3 ? ` +${staffByRole[role].length - 3} more` : '';
        return `
          <div class="staff-item">
            <span class="staff-role">${role}:</span>
            <span class="staff-name">${names}${more}</span>
          </div>
        `;
      }).join('');
    } else {
      staffContainer.innerHTML = '<span class="theme-text-muted">No staff information available</span>';
    }
  } else {
    if (staffSection) staffSection.style.display = 'none';
    if (staffContainer && (!anime.staff || anime.staff.length === 0)) {
      staffContainer.innerHTML = '<span class="theme-text-muted">No staff information available</span>';
    }
  }
  
  // External Links
  const linksSection = document.getElementById('anime-details-links-section');
  const linksContainer = document.getElementById('anime-details-links');
  if (linksSection && linksContainer) {
    const links = [];
    
    // AniList link
    if (anime.id) {
      links.push({
        label: 'AniList',
        url: `https://anilist.co/anime/${anime.id}`,
        icon: '🔗'
      });
    }
    
    // Official site
    if (anime.siteUrl) {
      links.push({
        label: 'Official Site',
        url: anime.siteUrl,
        icon: '🌐'
      });
    }
    
    // MAL link (search)
    if (anime.id) {
      const searchTitle = encodeURIComponent(anime.title || '');
      links.push({
        label: 'MyAnimeList',
        url: `https://myanimelist.net/search/all?q=${searchTitle}&cat=all`,
        icon: '📋'
      });
    }
    
    if (links.length > 0) {
      linksSection.style.display = 'block';
      linksContainer.innerHTML = links.map(link => `
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="external-link-btn">
          <span class="link-icon">${link.icon}</span>
          <span class="link-label">${link.label}</span>
        </a>
      `).join('');
    } else {
      linksSection.style.display = 'none';
    }
  }
  
  // Genres
  const genresContainer = document.getElementById('anime-details-genres');
  if (genresContainer) {
    if (anime.genres && anime.genres.length > 0) {
      genresContainer.innerHTML = anime.genres.map(g => 
        `<span class="genre-tag-modal">${g}</span>`
      ).join('');
    } else {
      genresContainer.innerHTML = '<span class="theme-text-muted">No genres available</span>';
    }
  }
  
  // Trailer
  const trailerSection = document.getElementById('anime-details-trailer-section');
  const showTrailerBtn = document.getElementById('anime-details-show-trailer');
  const trailerContainer = document.getElementById('anime-details-trailer-container');
  const trailerIframe = document.getElementById('anime-details-trailer');
  
  if (anime.trailer && anime.trailer.site === 'youtube') {
    trailerSection.style.display = 'block';
    showTrailerBtn.onclick = () => {
      trailerContainer.classList.remove('hidden');
      trailerIframe.src = `https://www.youtube.com/embed/${anime.trailer.id}`;
      showTrailerBtn.style.display = 'none';
    };
  } else {
    trailerSection.style.display = 'none';
  }
  
  // Notes
  const notesTextarea = document.getElementById('anime-details-notes');
  const notesCount = document.getElementById('anime-details-notes-count');
  const saveNotesBtn = document.getElementById('anime-details-save-notes');
  
  if (notesTextarea) {
    notesTextarea.value = anime.notes || '';
    notesTextarea.dataset.animeId = anime.id;
    notesTextarea.dataset.animeTitle = anime.title;
    
    const updateCount = () => {
      const count = notesTextarea.value.length;
      notesCount.textContent = `${count}/2000`;
    };
    updateCount();
    notesTextarea.oninput = updateCount;
  }
  
  if (saveNotesBtn) {
    saveNotesBtn.dataset.animeId = anime.id;
    saveNotesBtn.dataset.animeTitle = anime.title;
  }
  
  // Add to List button
  populateModalAddToListButton(anime.id);
  
  // Store anime ID for toast notifications
  const modalContainer = document.getElementById('anime-details-add-to-list-container');
  if (modalContainer) {
    modalContainer.dataset.animeId = anime.id;
  }
  
  // Watch Dates
  const startedDateInput = document.getElementById('anime-details-started-date');
  const completedDateInput = document.getElementById('anime-details-completed-date');
  const clearStartedBtn = document.getElementById('anime-details-clear-started');
  const clearCompletedBtn = document.getElementById('anime-details-clear-completed');
  const saveDatesBtn = document.getElementById('anime-details-save-dates');
  
  // Helper to format date from AniList format (year, month, day) to YYYY-MM-DD
  const formatDateForInput = (date) => {
    if (!date || !date.year) return '';
    const year = date.year || '';
    const month = String(date.month || 1).padStart(2, '0');
    const day = String(date.day || 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  if (startedDateInput) {
    startedDateInput.value = formatDateForInput(anime.startedAt);
    startedDateInput.dataset.animeId = anime.id;
  }
  
  if (completedDateInput) {
    completedDateInput.value = formatDateForInput(anime.completedAt);
    completedDateInput.dataset.animeId = anime.id;
  }
  
  if (saveDatesBtn) {
    saveDatesBtn.dataset.animeId = anime.id;
    saveDatesBtn.dataset.animeTitle = anime.title;
  }
  
  // Reset tabs to overview
  document.querySelectorAll('.anime-details-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.details-tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="overview"]').classList.add('active');
  document.getElementById('anime-details-overview-tab').classList.add('active');
}

/**
 * Close anime details modal
 */
export function closeAnimeDetailsModal() {
  const backdrop = document.getElementById('anime-details-modal-backdrop');
  const trailerContainer = document.getElementById('anime-details-trailer-container');
  const trailerIframe = document.getElementById('anime-details-trailer');
  const showTrailerBtn = document.getElementById('anime-details-show-trailer');
  
  if (backdrop) {
    backdrop.classList.remove('show');
    
    // Remove inline styles that force display
    backdrop.style.display = '';
    backdrop.style.opacity = '';
    backdrop.style.pointerEvents = '';
    backdrop.style.visibility = '';
    backdrop.style.zIndex = '';
    backdrop.style.background = '';
    backdrop.style.position = '';
    backdrop.style.top = '';
    backdrop.style.left = '';
    backdrop.style.right = '';
    backdrop.style.bottom = '';
    backdrop.style.width = '';
    backdrop.style.height = '';
    
    // Update ARIA attributes (set aria-hidden to true when closing)
    updateModalAria(backdrop, false);
    
    // Release focus trap
    releaseFocus(backdrop);
  }
  
  // Restore body scroll
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  
  if (trailerIframe) trailerIframe.src = '';
  if (trailerContainer) trailerContainer.classList.add('hidden');
  if (showTrailerBtn) showTrailerBtn.style.display = 'block';
  
  // Restore focus to previous element
  restoreFocus();
}

/**
 * Load related anime AND recommendations from AniList
 */
async function loadRelatedAndRecommendations(animeId) {
  const container = document.getElementById('anime-details-related-content');
  
  container.innerHTML = '<p class="theme-text-muted">Loading...</p>';
  
  try {
    const query = `
      query ($id: Int) {
        Media(id: $id) {
          relations {
            edges {
              relationType
              node {
                id
                title { romaji }
                coverImage { medium }
                format
                averageScore
              }
            }
          }
          recommendations(sort: RATING_DESC, perPage: 10) {
            nodes {
              rating
              mediaRecommendation {
                id
                title { romaji }
                coverImage { medium }
                format
                averageScore
                genres
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables: { id: parseInt(animeId) } })
    });
    
    const data = await response.json();
    const relations = data?.data?.Media?.relations?.edges || [];
    const recommendations = data?.data?.Media?.recommendations?.nodes || [];
    
    // Combine all anime into one unified array
    const allAnime = [];
    
    // Add related anime
    relations.forEach(rel => {
      const node = rel.node;
      const relation = rel.relationType.replace(/_/g, ' ');
      const score = node.averageScore ? node.averageScore : null;
      
      allAnime.push({
        id: node.id,
        title: node.title.romaji,
        image: node.coverImage.medium,
        type: 'related',
        badge: relation,
        score: score
      });
    });
    
    // Add recommendations
    recommendations
      .filter(rec => rec.mediaRecommendation)
      .slice(0, 12)
      .forEach(rec => {
        const media = rec.mediaRecommendation;
        const score = media.averageScore ? media.averageScore : null;
        
        allAnime.push({
          id: media.id,
          title: media.title.romaji,
          image: media.coverImage.medium,
          type: 'recommendation',
          badge: `${rec.rating} users`,
          score: score
        });
      });
    
    // If no anime found
    if (allAnime.length === 0) {
      container.innerHTML = '<p class="theme-text-muted">No related anime or recommendations found.</p>';
      return;
    }
    
    // Add the grid class to the container
    container.className = 'related-anime-grid';
    
    // Render unified grid - using classes only, no inline styles
    container.innerHTML = allAnime.map(anime => `
      <div class="related-anime-card ${anime.type === 'recommendation' ? 'recommendation-card' : ''}" 
           onclick="window.openRelatedAnime(${anime.id})">
        <img src="${anime.image}" 
             alt="${escapeHtml(anime.title)}" 
             loading="lazy" />
        <div class="related-anime-info">
          <div class="related-anime-title">${escapeHtml(anime.title)}</div>
          <div class="related-anime-meta">
            <span class="related-anime-relation">${anime.badge}</span>
            ${anime.score ? `<span class="related-anime-score">⭐${anime.score}%</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    const errorInfo = handleError(error, 'loading related anime', {
      showToast: false // Don't show toast for background loading
    });
    
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="theme-text-muted mb-4">${errorInfo.message}</p>
        <button class="btn-primary retry-btn" onclick="window.location.reload()">
          Retry
        </button>
      </div>
    `;
  }
}

// escapeHtml is now imported from utils.js

/**
 * Save watch dates to AniList
 */
export async function saveAnimeDates(animeId, startedAt, completedAt, animeTitle) {
  try {
    // Convert date string (YYYY-MM-DD) to AniList format {year, month, day}
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || isNaN(year)) return null;
      return { year, month: month || 0, day: day || 0 };
    };
    
    const startedAtObj = parseDate(startedAt);
    const completedAtObj = parseDate(completedAt);
    
    const response = await fetch('/api/anilist/update-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaId: parseInt(animeId),
        startedAt: startedAtObj,
        completedAt: completedAtObj
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save dates');
    }
    
    // Update local data
    const anime = window.animeData?.find(a => a.id === parseInt(animeId));
    if (anime) {
      anime.startedAt = result.entry.startedAt;
      anime.completedAt = result.entry.completedAt;
      saveDataToLocalStorage(window.animeData);
    }
    
    return { success: true, entry: result.entry };
    
  } catch (error) {
    handleError(error, 'saving dates', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Save notes to AniList
 */
export async function saveAnimeNotes(animeId, notes, animeTitle) {
  try {
    console.log('📝 [saveAnimeNotes] Attempting to save notes for anime:', animeId);
    console.log('📝 [saveAnimeNotes] Using update-score endpoint (which works)');
    
    // Use the working update-score endpoint, passing notes as well
    const response = await fetch('/api/anilist/update-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies/session
      body: JSON.stringify({ 
        mediaId: parseInt(animeId), 
        notes: notes 
      })
    });
    
    console.log('📝 [saveAnimeNotes] Response status:', response.status);
    console.log('📝 [saveAnimeNotes] Response ok:', response.ok);
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save notes');
    }
    
    // Update local data
    const anime = window.animeData?.find(a => a.id === parseInt(animeId));
    if (anime) {
      anime.notes = notes;
      saveDataToLocalStorage(window.animeData);
    }
    
    return { success: true };
    
  } catch (error) {
    handleError(error, 'saving notes', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Initialize modal event listeners
 */
export function initAnimeDetailsModal() {
  const closeBtn = document.getElementById('anime-details-modal-close');
  const backdrop = document.getElementById('anime-details-modal-backdrop');
  const saveNotesBtn = document.getElementById('anime-details-save-notes');
  const saveDatesBtn = document.getElementById('anime-details-save-dates');
  const clearStartedBtn = document.getElementById('anime-details-clear-started');
  const clearCompletedBtn = document.getElementById('anime-details-clear-completed');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAnimeDetailsModal);
  }
  
  // Make clicking anywhere outside modal content close it
  const modalContent = document.getElementById('anime-details-modal-content');
  
  // Add click handler to backdrop - this will catch all clicks outside modal content
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      // Close if clicking directly on backdrop (not on modal content or its children)
      if (e.target === backdrop || e.target.id === 'anime-details-modal-backdrop') {
        e.preventDefault();
        e.stopPropagation();
        closeAnimeDetailsModal();
      }
    }, { once: false }); // Allow multiple clicks
  }
  
  // Prevent clicks inside modal content from closing
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent clicks inside modal from bubbling to backdrop
    });
  }
  
  // Tab switching
  document.querySelectorAll('.anime-details-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      document.querySelectorAll('.anime-details-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.details-tab-pane').forEach(p => p.classList.remove('active'));
      document.getElementById(`anime-details-${targetTab}-tab`).classList.add('active');
    });
  });
  
  // Save notes button
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', async () => {
      const btn = saveNotesBtn;
      const textarea = document.getElementById('anime-details-notes');
      const animeId = btn.dataset.animeId;
      const animeTitle = btn.dataset.animeTitle;
      const notes = textarea.value;
      
      const restoreButton = showButtonLoading(btn, 'Saving...');
      
      try {
        await saveAnimeNotes(animeId, notes, animeTitle);
        showToast(`Notes saved for '${animeTitle}'!`, 'success');
        restoreButton();
        btn.textContent = 'Saved ✓';
        
        setTimeout(() => {
          btn.textContent = 'Save Notes';
        }, 2000);
        
      } catch (error) {
        restoreButton();
        handleError(error, 'saving notes', {
          showToast: true
        });
      }
    });
  }
  
  // Save dates button
  if (saveDatesBtn) {
    saveDatesBtn.addEventListener('click', async () => {
      const btn = saveDatesBtn;
      const startedDateInput = document.getElementById('anime-details-started-date');
      const completedDateInput = document.getElementById('anime-details-completed-date');
      const animeId = btn.dataset.animeId;
      const animeTitle = btn.dataset.animeTitle;
      const startedAt = startedDateInput?.value || '';
      const completedAt = completedDateInput?.value || '';
      
      const restoreButton = showButtonLoading(btn, 'Saving...');
      
      try {
        await saveAnimeDates(animeId, startedAt, completedAt, animeTitle);
        showToast(`Watch dates saved for '${animeTitle}'!`, 'success');
        restoreButton();
        btn.textContent = 'Saved ✓';
        
        setTimeout(() => {
          btn.textContent = 'Save Dates';
        }, 2000);
        
      } catch (error) {
        restoreButton();
        handleError(error, 'saving dates', {
          showToast: true
        });
      }
    });
  }
  
  // Clear date buttons
  if (clearStartedBtn) {
    clearStartedBtn.addEventListener('click', () => {
      const startedDateInput = document.getElementById('anime-details-started-date');
      if (startedDateInput) startedDateInput.value = '';
    });
  }
  
  if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener('click', () => {
      const completedDateInput = document.getElementById('anime-details-completed-date');
      if (completedDateInput) completedDateInput.value = '';
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const backdrop = document.getElementById('anime-details-modal-backdrop');
      if (backdrop && backdrop.classList.contains('show')) {
        closeAnimeDetailsModal();
      }
    }
  });
}

// Make openRelatedAnime available globally
window.openRelatedAnime = async function(animeId) {
  try {
    const anime = window.animeData?.find(a => a.id === animeId);
    
    if (anime) {
      openAnimeDetailsModal(anime);
    } else {
      // Fetch from AniList if not in local data
      const query = `
        query ($id: Int) {
          Media(id: $id) {
            id
            title { romaji }
            coverImage { large }
            description
            genres
            format
            episodes
            seasonYear
            season
            averageScore
            studios { nodes { name } }
            source
            trailer { id site }
          }
        }
      `;
      
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables: { id: animeId } })
      });
      
      const data = await response.json();
      const media = data?.data?.Media;
      
      if (media) {
        const formattedAnime = {
          id: media.id,
          title: media.title.romaji,
          coverImage: media.coverImage.large,
          description: media.description,
          genres: media.genres,
          format: media.format,
          totalEpisodes: media.episodes,
          seasonYear: media.seasonYear,
          season: media.season,
          averageScore: media.averageScore,
          studios: media.studios?.nodes?.map(s => s.name) || [],
          source: media.source,
          trailer: media.trailer,
          score: 0,
          episodesWatched: 0,
          status: 'Planning',
          notes: ''
        };
        
        openAnimeDetailsModal(formattedAnime);
      }
    }
  } catch (error) {
    handleError(error, 'opening related anime', {
      showToast: true
    });
  }
};