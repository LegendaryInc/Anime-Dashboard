// =====================================================================
// ai.js – Google Gemini helpers + Clean AI Card Output (v2.5-flash ready)
// =====================================================================

const DEFAULT_MODEL =
  (window.CONFIG && window.CONFIG.GEMINI_MODEL) || "gemini-1.5-flash";
const FALLBACK_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"];
const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

// --- Utilities ---
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Safe number coercion
function num(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// --- Core Gemini Callers ---
async function geminiGenerate(prompt, apiKey, modelId) {
  if (!apiKey) throw new Error("Missing Gemini API key.");

  const url = `${API_ROOT}/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
  const tryOrder = [DEFAULT_MODEL, ...FALLBACK_MODELS].filter(
    (m, i, a) => a.indexOf(m) === i
  );
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

// --- Formatting Helpers ---
function parseRecommendations(text = "") {
  if (!text) return [];

  // 1) Strip markdown code fences like ```json ... ```
  text = text
    .replace(/```(?:json)?/gi, "") // opening fences
    .replace(/```/g, "") // closing fences
    .replace(/^`+|`+$/g, "") // stray backticks
    .trim();

  // 2) Try to extract a JSON array if present
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

  // 3) Fallback: parse bullet / plain text lines
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^here are/i.test(l));

  const items = [];
  for (const l of lines) {
    const clean = l.replace(/^[-*•]\s*/, "");
    // **Title** – reason
    let m = clean.match(/^\*\*([^*]+)\*\*\s*[-—–:]\s*(.+)$/);
    // Title – reason  |  Title - reason  |  Title: reason
    if (!m) m = clean.match(/^\**([^*]+?)\**\s*[-—–:]\s*(.+)$/);

    if (m) items.push({ title: m[1].trim(), reason: m[2].trim(), vibe: "" });
    else items.push({ title: clean, reason: "", vibe: "" });
  }
  return items.slice(0, 8);
}

function renderRecommendations(items = []) {
  if (!items.length) return `<p class="insights-empty">No recommendations found.</p>`;
  return `
    <ul class="rec-list">
      ${items
        .map(
          (it) => `
        <li class="rec-item">
          <div class="rec-title">
            <span class="rec-dot"></span>
            <span>${escapeHtml(it.title)}</span>
            ${it.vibe ? `<span class="rec-badge">${escapeHtml(it.vibe)}</span>` : ""}
          </div>
          ${it.reason ? `<div class="rec-reason">${escapeHtml(it.reason)}</div>` : ""}
        </li>`
        )
        .join("")}
    </ul>`;
}

// --- Public APIs ---
export async function getGeminiRecommendations(stats, apiKey) {
  const out = document.getElementById("gemini-response");
  if (out) out.innerHTML = '<div class="text-sm text-gray-500">Thinking...</div>';

  try {
    const prompt = buildRecommendationPrompt(stats);
    const text = await callGeminiWithFallbacks(
      prompt,
      apiKey || window.CONFIG?.GEMINI_API_KEY
    );
    const items = parseRecommendations(text);
    out.innerHTML = renderRecommendations(items);
  } catch (err) {
    console.error("[Gemini] Recommendation error:", err);
    if (out)
      out.innerHTML = `<div class="text-red-600 text-sm font-medium">Gemini error: ${escapeHtml(
        err.message
      )}</div>`;
  }
}

/**
 * Find similar anime to the given one
 * ✅ FIXED: Now targets the correct modal elements and shows the modal
 */
export async function getSimilarAnime(anime, apiKey) {
  // Get modal elements
  const modal = document.getElementById('similar-modal-backdrop');
  const modalTitle = document.getElementById('similar-modal-title');
  const modalBody = document.getElementById('similar-modal-body');
  
  if (!modal || !modalBody) {
    console.error('Similar modal elements not found');
    return;
  }

  // Show modal with loading state
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

  // Try AI recommendations first
  if (key) {
    try {
      const prompt = buildSimilarPrompt(anime);
      const text = await callGeminiWithFallbacks(prompt, key);
      const items = parseRecommendations(text);
      
      if (modalTitle) {
        modalTitle.textContent = `Anime similar to "${anime.title}"`;
      }
      modalBody.innerHTML = renderRecommendations(items);
      return;
    } catch (err) {
      console.warn('[Gemini] Similar failed, using local fallback:', err.message);
    }
  }

  // Local heuristic fallback (no API needed)
  const list = Array.isArray(window.animeData) ? window.animeData : [];
  const baseGenres = new Set((anime.genres || []).map(g => g.toLowerCase()));
  const scored = [];

  for (const a of list) {
    if (!a || a.title === anime.title) continue;
    
    const genres = new Set((a.genres || []).map(x => x.toLowerCase()));
    const intersection = [...genres].filter(x => baseGenres.has(x)).length;
    const union = new Set([...genres, ...baseGenres]).size || 1;
    const jaccard = intersection / union;
    
    // Bonus for higher scores
    const scoreBias = (num(a.score) / 100) * 0.1;
    
    // Small bonus for recent anime
    const recencyBonus = a.year ? (Math.max(0, num(a.year) - 1990) / 40) * 0.05 : 0;
    
    const finalScore = jaccard * 0.85 + scoreBias + recencyBonus;
    
    if (finalScore > 0.1) { // Only include reasonably similar anime
      scored.push({ a, s: finalScore, intersection });
    }
  }

  scored.sort((x, y) => y.s - x.s);
  
  const top = scored.slice(0, 5).map(({ a, intersection }) => {
    const shared = Array.from(new Set([...(a.genres || [])].filter(g => 
      baseGenres.has(g.toLowerCase())
    )));
    
    return {
      title: a.title,
      reason: shared.length > 0 
        ? `Shares ${shared.join(', ')} genre${shared.length > 1 ? 's' : ''}` 
        : 'Similar themes and style',
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
        <p class="text-sm">Try adding more anime with similar genres to your list!</p>
      </div>
    `;
  } else {
    modalBody.innerHTML = renderRecommendations(top);
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

  return `Suggest 5 anime in JSON format: [{"title":"","reason":"","vibe":""}]
Avoid shows I've completed or started. Focus on fantasy/isekai and hidden gems.

Stats:
- Series: ${total}
- Mean score: ${avg}
- Top genres: ${topGenres}`;
}

function buildSimilarPrompt(anime) {
  const title = anime?.title || 'Unknown';
  const genres = Array.isArray(anime?.genres) ? anime.genres.join(', ') : 'N/A';
  const synopsis = (anime?.synopsis || anime?.description || '').slice(0, 400);

  return `Suggest 5 anime similar to "${title}" as JSON: [{"title":"","reason":"","vibe":""}]

Genres: ${genres}
${synopsis ? `Synopsis: ${synopsis}` : ''}

Focus on thematic similarities, art style, and tone. Provide the vibe field with tags like "Dark Fantasy", "Slice of Life", "Action-Packed", etc.`;
}