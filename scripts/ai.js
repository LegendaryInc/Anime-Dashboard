// =====================================================================
// ai.js – Enhanced Google Gemini + Personal Insights (v3.0)
// =====================================================================

const DEFAULT_MODEL = (window.CONFIG && window.CONFIG.GEMINI_MODEL) || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"];
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

// --- Utilities ---
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function num(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// --- Core Gemini Callers ---
async function geminiGenerate(prompt, apiKey, modelId) {
  if (!apiKey) throw new Error("Missing Gemini API key.");

  const url = `${API_ROOT}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || res.status === 400)
      throw new Error(`Model error for "${modelId}": ${text || res.statusText}`);
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const part = candidate?.content?.parts?.[0];
  return part?.text || "";
}

async function callGeminiWithFallbacks(prompt, apiKey) {
  const tried = new Set();
  const tryOrder = [DEFAULT_MODEL, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i);
  let lastErr = null;

  for (const model of tryOrder) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      return await geminiGenerate(prompt, apiKey, model);
    } catch (e) {
      lastErr = e;
      console.warn(`[Gemini] Failed with "${model}":`, e.message);
    }
  }
  throw lastErr || new Error("All Gemini model attempts failed.");
}

// --- Jikan API for Anime Images ---
const jikanCache = new Map();

async function fetchAnimeImage(title) {
  if (jikanCache.has(title)) {
    return jikanCache.get(title);
  }

  try {
    const searchUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const anime = data.data?.[0];
    
    const imageUrl = anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || null;
    jikanCache.set(title, imageUrl);
    
    return imageUrl;
  } catch (error) {
    console.warn(`[Jikan] Failed to fetch image for "${title}":`, error.message);
    return null;
  }
}

// --- Formatting Helpers ---
function parseRecommendations(text = "") {
  if (!text) return [];

  text = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/^`+|`+$/g, "")
    .trim();

  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      const j = JSON.parse(slice);
      if (Array.isArray(j)) {
        return j
          .map((x) => ({
            title: (x.title || "").toString().trim(),
            reason: (x.reason || "").toString().trim(),
            vibe: (x.vibe || "").toString().trim(),
          }))
          .filter((x) => x.title);
      }
    }
  } catch (err) {
    console.warn("[Gemini] JSON parse failed, falling back to text:", err.message);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^here are/i.test(l));

  const items = [];
  for (const l of lines) {
    const clean = l.replace(/^[-*•]\s*/, "");
    let m = clean.match(/^\*\*([^*]+)\*\*\s*[-—–:]\s*(.+)$/);
    if (!m) m = clean.match(/^\**([^*]+?)\**\s*[-—–:]\s*(.+)$/);

    if (m) items.push({ title: m[1].trim(), reason: m[2].trim(), vibe: "" });
    else items.push({ title: clean, reason: "", vibe: "" });
  }
  return items.slice(0, 8);
}

async function renderRecommendationsWithImages(items = [], category = "personalized") {
  if (!items.length) {
    return `
      <div class="insights-empty">
        <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
        <p class="empty-title">No recommendations available</p>
        <p class="empty-subtitle">Try adjusting your preferences or check back later</p>
      </div>
    `;
  }

  // Fetch images for all recommendations (with rate limiting)
  const itemsWithImages = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Rate limit: wait 333ms between requests (3 per second)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 333));
    }
    
    const imageUrl = await fetchAnimeImage(item.title);
    itemsWithImages.push({ ...item, imageUrl });
  }

  return `
    <div class="rec-grid">
      ${itemsWithImages
        .map(
          (item) => `
        <div class="rec-card">
          <div class="rec-card-image">
            ${
              item.imageUrl
                ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
                : `<div class="rec-card-placeholder">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                     </svg>
                   </div>`
            }
            ${item.vibe ? `<span class="rec-vibe-badge">${escapeHtml(item.vibe)}</span>` : ""}
          </div>
          <div class="rec-card-content">
            <h4 class="rec-card-title">${escapeHtml(item.title)}</h4>
            ${item.reason ? `<p class="rec-card-reason">${escapeHtml(item.reason)}</p>` : ""}
            <div class="rec-card-actions">
              <button class="rec-action-btn rec-search-btn" data-title="${escapeHtml(item.title)}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Search
              </button>
              <button class="rec-action-btn rec-add-btn" data-title="${escapeHtml(item.title)}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add to PTW
              </button>
            </div>
          </div>
        </div>`
        )
        .join("")}
    </div>
  `;
}

// --- Personal Insights Generator ---
export function generatePersonalInsights(stats) {
  const container = document.getElementById('insights-personal-stats');
  if (!container) return;

  const totalAnime = num(stats?.totalAnime || stats?.totalSeries, 0);
  const totalEpisodes = num(stats?.totalEpisodes, 0);
  const meanScore = num(stats?.meanScore, 0);
  const genreCounts = stats?.genreCounts || {};

  // Find favorite genre
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  const favoriteGenre = topGenres[0]?.[0] || 'Unknown';
  const favoriteGenreCount = topGenres[0]?.[1] || 0;

  // Calculate genre diversity
  const uniqueGenres = Object.keys(genreCounts).length;
  const genreDiversity = uniqueGenres > 15 ? 'Adventurous' : uniqueGenres > 8 ? 'Balanced' : 'Focused';

  // Rating tendencies
  const ratingTendency = meanScore >= 8 ? 'Enthusiastic' : 
                         meanScore >= 7 ? 'Positive' : 
                         meanScore >= 6 ? 'Moderate' : 'Critical';

  // Episodes per anime
  const avgEpisodesPerAnime = totalAnime > 0 ? (totalEpisodes / totalAnime).toFixed(1) : 0;

  const insights = [
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
             </svg>`,
      label: 'Favorite Genre',
      value: favoriteGenre,
      subtext: `${favoriteGenreCount} anime`
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
               <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>`,
      label: 'Taste Profile',
      value: genreDiversity,
      subtext: `${uniqueGenres} unique genres`
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
             </svg>`,
      label: 'Rating Style',
      value: ratingTendency,
      subtext: `${meanScore.toFixed(2)} avg score`
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
             </svg>`,
      label: 'Watch Pattern',
      value: `${avgEpisodesPerAnime} eps/anime`,
      subtext: avgEpisodesPerAnime > 20 ? 'Long-form fan' : 'Series sampler'
    }
  ];

  container.innerHTML = `
    <div class="insights-header">
      <h3 class="insights-section-title">Your Anime Profile</h3>
      <p class="insights-section-subtitle">Based on ${totalAnime} anime and ${totalEpisodes.toLocaleString()} episodes</p>
    </div>
    <div class="insights-stats-grid">
      ${insights.map(insight => `
        <div class="insight-stat-card">
          <div class="insight-stat-icon">${insight.icon}</div>
          <div class="insight-stat-content">
            <div class="insight-stat-label">${insight.label}</div>
            <div class="insight-stat-value">${insight.value}</div>
            <div class="insight-stat-subtext">${insight.subtext}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// --- Public APIs ---
export async function getGeminiRecommendations(stats, apiKey, category = 'personalized') {
  const loadingContainer = document.getElementById('insights-loading');
  const contentContainer = document.getElementById('insights-content');
  
  if (loadingContainer) loadingContainer.classList.remove('hidden');
  if (contentContainer) contentContainer.innerHTML = '';

  try {
    let prompt;
    
    switch (category) {
      case 'hidden-gems':
        prompt = buildHiddenGemsPrompt(stats);
        break;
      case 'top-5':
        prompt = buildTop5Prompt(stats);
        break;
      default:
        prompt = buildRecommendationPrompt(stats);
    }
    
    const text = await callGeminiWithFallbacks(prompt, apiKey || window.CONFIG?.GEMINI_API_KEY);
    const items = parseRecommendations(text);
    
    if (loadingContainer) loadingContainer.classList.add('hidden');
    if (contentContainer) {
      contentContainer.innerHTML = await renderRecommendationsWithImages(items, category);
      attachRecommendationListeners();
    }
  } catch (err) {
    console.error("[Gemini] Recommendation error:", err);
    if (loadingContainer) loadingContainer.classList.add('hidden');
    if (contentContainer) {
      contentContainer.innerHTML = `
        <div class="insights-error">
          <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p class="error-title">Unable to generate recommendations</p>
          <p class="error-message">${escapeHtml(err.message)}</p>
          <button class="btn-primary retry-btn" onclick="window.refreshInsights()">
            Try Again
          </button>
        </div>
      `;
    }
  }
}

// Attach listeners to recommendation buttons
function attachRecommendationListeners() {
  // Search buttons
  document.querySelectorAll('.rec-search-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.title;
      window.open(`https://anilist.co/search/anime?search=${encodeURIComponent(title)}`, '_blank');
    });
  });

  // Add to PTW buttons
  document.querySelectorAll('.rec-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.title;
      // You could implement actual PTW functionality here
      alert(`"${title}" would be added to your Plan to Watch list!\n\n(This feature requires AniList API integration)`);
    });
  });
}

// Similar anime (existing function, updated with images)
export async function getSimilarAnime(anime, apiKey) {
  const modal = document.getElementById('similar-modal-backdrop');
  const modalTitle = document.getElementById('similar-modal-title');
  const modalBody = document.getElementById('similar-modal-body');
  
  if (!modal || !modalBody) {
    console.error('Similar modal elements not found');
    return;
  }

  modal.classList.add('show');
  if (modalTitle) {
    modalTitle.textContent = `Finding anime similar to "${anime.title}"...`;
  }
  modalBody.innerHTML = `
    <div class="flex flex-col items-center justify-center py-8">
      <svg class="animate-spin h-8 w-8 text-indigo-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm text-gray-500">Analyzing genres and themes...</p>
    </div>
  `;

  const key = apiKey || window.CONFIG?.GEMINI_API_KEY;

  if (key) {
    try {
      const prompt = buildSimilarPrompt(anime);
      const text = await callGeminiWithFallbacks(prompt, key);
      const items = parseRecommendations(text);
      
      if (modalTitle) {
        modalTitle.textContent = `Anime similar to "${anime.title}"`;
      }
      modalBody.innerHTML = await renderRecommendationsWithImages(items, 'similar');
      attachRecommendationListeners();
      return;
    } catch (err) {
      console.warn('[Gemini] Similar failed, using local fallback:', err.message);
    }
  }

  // Local fallback
  const list = Array.isArray(window.animeData) ? window.animeData : [];
  const baseGenres = new Set((anime.genres || []).map(g => g.toLowerCase()));
  const scored = [];

  for (const a of list) {
    if (!a || a.title === anime.title) continue;
    
    const genres = new Set((a.genres || []).map(x => x.toLowerCase()));
    const intersection = [...genres].filter(x => baseGenres.has(x)).length;
    const union = new Set([...genres, ...baseGenres]).size || 1;
    const jaccard = intersection / union;
    const scoreBias = (num(a.score) / 100) * 0.1;
    const finalScore = jaccard * 0.9 + scoreBias;
    
    if (finalScore > 0.1) {
      scored.push({ a, s: finalScore });
    }
  }

  scored.sort((x, y) => y.s - x.s);
  
  const top = scored.slice(0, 5).map(({ a }) => {
    const shared = Array.from(new Set([...(a.genres || [])].filter(g => 
      baseGenres.has(g.toLowerCase())
    )));
    
    return {
      title: a.title,
      reason: shared.length > 0 
        ? `Shares ${shared.slice(0, 2).join(', ')} genre${shared.length > 1 ? 's' : ''}` 
        : 'Similar themes',
      vibe: a.score >= 8 ? 'Highly Rated' : ''
    };
  });

  if (modalTitle) {
    modalTitle.textContent = `Anime similar to "${anime.title}"`;
  }
  
  if (top.length === 0) {
    modalBody.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <p class="text-lg font-semibold mb-2">No similar anime found</p>
        <p class="text-sm">Try adding more anime with similar genres!</p>
      </div>
    `;
  } else {
    modalBody.innerHTML = await renderRecommendationsWithImages(top, 'similar');
    attachRecommendationListeners();
  }
}

// --- Prompt Builders ---
function buildRecommendationPrompt(stats) {
  const total = num(stats?.totalSeries || stats?.totalAnime, 0);
  const avg = num(stats?.meanScore, 0).toFixed(2);
  const topGenres = stats?.genreCounts
    ? Object.entries(stats.genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g, c]) => `${g}(${c})`)
        .join(", ")
    : "N/A";

  return `Suggest 6 anime in JSON format: [{"title":"","reason":"","vibe":""}]
Avoid shows I've completed. Focus on popular and well-regarded anime that match my preferences.

Stats:
- Series: ${total}
- Mean score: ${avg}
- Top genres: ${topGenres}

Provide diverse recommendations with different vibes (tags like "Action-Packed", "Emotional", "Mind-Bending", etc).`;
}

function buildHiddenGemsPrompt(stats) {
  const topGenres = stats?.genreCounts
    ? Object.entries(stats.genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g)
        .join(", ")
    : "N/A";

  return `Suggest 6 lesser-known but highly-rated anime as JSON: [{"title":"","reason":"","vibe":""}]

Focus on hidden gems that are critically acclaimed but not mainstream. User enjoys: ${topGenres}

Criteria:
- Not among top 100 most popular
- High quality storytelling
- Unique or innovative concepts
- Strong ratings from those who've watched`;
}

function buildTop5Prompt(stats) {
  const list = Array.isArray(window.animeData) ? window.animeData : [];
  const top5 = list
    .filter(a => a.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(a => a.title)
    .join(', ');

  if (!top5) {
    return buildRecommendationPrompt(stats);
  }

  return `Based on these highly-rated anime: ${top5}

Suggest 6 similar anime as JSON: [{"title":"","reason":"","vibe":""}]

Find anime with similar:
- Themes and storytelling style
- Tone and atmosphere  
- Character dynamics
- Genre blend`;
}

function buildSimilarPrompt(anime) {
  const title = anime?.title || 'Unknown';
  const genres = Array.isArray(anime?.genres) ? anime.genres.join(', ') : 'N/A';
  const synopsis = (anime?.synopsis || anime?.description || '').slice(0, 400);

  return `Suggest 5 anime similar to "${title}" as JSON: [{"title":"","reason":"","vibe":""}]

Genres: ${genres}
${synopsis ? `Synopsis: ${synopsis}` : ''}

Focus on thematic similarities, art style, and tone. Provide vibe tags like "Dark Fantasy", "Slice of Life", "Action-Packed", etc.`;
}