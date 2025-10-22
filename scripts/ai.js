// =====================================================================
// ai.js — Google Gemini helpers + Clean AI Card Output (v2.5-flash ready)
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
    // **Title** — reason
    let m = clean.match(/^\*\*([^*]+)\*\*\s*[-–—:]\s*(.+)$/);
    // Title — reason  |  Title - reason  |  Title: reason
    if (!m) m = clean.match(/^\**([^*]+?)\**\s*[-–—:]\s*(.+)$/);

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

export async function getSimilarAnime(anime, apiKey) {
  const out = document.getElementById("similar-response");
  if (out) out.innerHTML = '<div class="text-sm text-gray-500">Finding similar titles...</div>';

  const key = apiKey || window.CONFIG?.GEMINI_API_KEY;

  if (key) {
    try {
      const prompt = buildSimilarPrompt(anime);
      const text = await callGeminiWithFallbacks(prompt, key);
      const items = parseRecommendations(text);
      out.innerHTML = renderRecommendations(items);
      return;
    } catch (err) {
      console.warn("[Gemini] Similar failed, using local fallback:", err.message);
    }
  }

  // Local heuristic fallback (no API needed)
  const list = Array.isArray(window.animeData) ? window.animeData : [];
  const base = new Set((anime.genres || []).map((g) => g.toLowerCase()));
  const scored = [];

  for (const a of list) {
    if (!a || a.title === anime.title) continue;
    const g = new Set((a.genres || []).map((x) => x.toLowerCase()));
    const inter = [...g].filter((x) => base.has(x)).length;
    const union = new Set([...g, ...base]).size || 1;
    const jaccard = inter / union;
    const bias = (num(a.score) / 100) * 0.1;
    const rec = a.year ? (Math.max(0, num(a.year) - 1990) / 40) * 0.05 : 0;
    const score = jaccard * 0.85 + bias + rec;
    if (score > 0) scored.push({ a, s: score });
  }

  scored.sort((x, y) => y.s - x.s);
  const top = scored
    .slice(0, 5)
    .map(({ a }) => ({ title: a.title, reason: "shares similar genres." }));
  out.innerHTML = renderRecommendations(top);
}

// --- Prompt Builders ---
function buildRecommendationPrompt(stats) {
  const total = num(stats?.totalSeries, 0);
  const avg = num(stats?.meanScore, 0).toFixed(2);
  const topGenres = stats?.genreCounts
    ? Object.entries(stats.genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g, c]) => `${g}(${c})`)
        .join(", ")
    : "N/A";

  return `Suggest 5 anime in JSON format: [{"title":"","reason":"","vibe":""}]
Avoid shows I’ve completed. Focus on fantasy/isekai and hidden gems.

Stats:
- Series: ${total}
- Mean score: ${avg}
- Top genres: ${topGenres}`;
}

function buildSimilarPrompt(anime) {
  const title = anime?.title || "Unknown";
  const genres = Array.isArray(anime?.genres) ? anime.genres.join(", ") : "N/A";
  const synopsis = (anime?.synopsis || "").slice(0, 400);

  return `Suggest 5 anime similar to "${title}" as JSON: [{"title":"","reason":""}]
Genres: ${genres}
Synopsis: ${synopsis}`;
}
