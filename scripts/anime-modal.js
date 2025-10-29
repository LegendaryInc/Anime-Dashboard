// scripts/anime-modal.js
// Enhanced Anime Details Modal with Notes Support and Data Fetching

import { showToast } from './toast.js';
import { saveDataToLocalStorage } from './storage.js';
import { getStatusBadgeClass } from './ui.js';

/**
 * Open enhanced anime details modal
 * Fetches full data from AniList if needed
 */
export async function openAnimeDetailsModal(anime) {
  const backdrop = document.getElementById('anime-details-modal-backdrop');
  if (!backdrop) return;

  // Show modal immediately
  backdrop.classList.add('show');
  
  // Populate basic info first (what we already have)
  document.getElementById('anime-details-title').textContent = anime.title || 'Loading...';
  document.getElementById('anime-details-cover-img').src = anime.coverImage || '';
  
  // Show loading state for synopsis
  document.getElementById('anime-details-synopsis').textContent = 'Loading...';
  
  // Check if we need to fetch full data
  const needsFullData = !anime.description || !anime.studios || anime.studios.length === 0;
  
  let fullAnime = anime;
  
  if (needsFullData && anime.id) {
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
        // Merge fetched data with existing anime object
        fullAnime = {
          ...anime,
          description: media.description,
          studios: media.studios?.nodes?.map(s => s.name) || [],
          source: media.source,
          averageScore: media.averageScore,
          trailer: media.trailer,
          startDate: media.startDate
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
      console.error('Failed to fetch full anime data:', error);
      // Continue with partial data
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
  document.getElementById('anime-details-title').textContent = anime.title || 'Unknown';
  document.getElementById('anime-details-cover-img').src = anime.coverImage || '';
  
  // Meta badges
  const year = anime.seasonYear || anime.startDate?.year || '—';
  const format = anime.format || '—';
  const episodesCount = anime.totalEpisodes ? `${anime.totalEpisodes} Episodes` : '—';
  
  document.getElementById('anime-details-year').textContent = year;
  document.getElementById('anime-details-format').textContent = format;
  document.getElementById('anime-details-episodes-count').textContent = episodesCount;
  
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
  document.getElementById('anime-details-progress').textContent = `${watched}/${total}`;
  
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
  document.getElementById('anime-details-synopsis').textContent = synopsis;
  
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
  
  document.getElementById('anime-details-studios').textContent = studios;
  document.getElementById('anime-details-source').textContent = source;
  document.getElementById('anime-details-season').textContent = season;
  document.getElementById('anime-details-avg-score').textContent = avgScore;
  
  // Genres
  const genresContainer = document.getElementById('anime-details-genres');
  if (anime.genres && anime.genres.length > 0) {
    genresContainer.innerHTML = anime.genres.map(g => 
      `<span class="genre-tag-modal">${g}</span>`
    ).join('');
  } else {
    genresContainer.innerHTML = '<span class="theme-text-muted">No genres available</span>';
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
  
  if (backdrop) backdrop.classList.remove('show');
  
  if (trailerIframe) trailerIframe.src = '';
  if (trailerContainer) trailerContainer.classList.add('hidden');
  if (showTrailerBtn) showTrailerBtn.style.display = 'block';
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
    console.error('Failed to load related anime and recommendations:', error);
    container.innerHTML = '<p class="theme-text-muted">Failed to load content.</p>';
  }
}

/**
 * Escape HTML helper
 */
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Save notes to AniList
 */
export async function saveAnimeNotes(animeId, notes, animeTitle) {
  try {
    const response = await fetch('/api/anilist/update-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: parseInt(animeId), notes })
    });
    
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
    console.error('Failed to save notes:', error);
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
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAnimeDetailsModal);
  }
  
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAnimeDetailsModal();
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
      
      btn.disabled = true;
      btn.textContent = 'Saving...';
      
      try {
        await saveAnimeNotes(animeId, notes, animeTitle);
        showToast(`Notes saved for '${animeTitle}'!`, 'success');
        btn.textContent = 'Saved ✓';
        
        setTimeout(() => {
          btn.textContent = 'Save Notes';
          btn.disabled = false;
        }, 2000);
        
      } catch (error) {
        showToast(`Failed to save notes: ${error.message}`, 'error');
        btn.textContent = 'Save Notes';
        btn.disabled = false;
      }
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
    console.error('Failed to open related anime:', error);
    showToast('Failed to load anime details', 'error');
  }
};