// =====================================================================
// --- AI MODULE (ai.js) ---
// =====================================================================
// Handles all API calls to the Google Gemini AI
// for recommendations and insights.
// =====================================================================

/**
 * Fetches recommendations for anime similar to a given one.
 * @param {object} anime - The anime object to find similar ones for.
 * @param {string} GEMINI_API_KEY - The user's Gemini API key.
 */
import { showToast, showConfirm } from './toast.js';
export async function getSimilarAnime(anime, GEMINI_API_KEY) {
  const similarModalBody = document.getElementById('similar-modal-body');
  const similarModalBackdrop = document.getElementById('similar-modal-backdrop');
  const similarModalTitle = document.getElementById('similar-modal-title');

  if (!GEMINI_API_KEY) {
    if (similarModalBody) similarModalBody.innerHTML = `<p class="text-red-500">AI features disabled. Please set your key in Settings ⚙️.</p>`;
    if (similarModalBackdrop) similarModalBackdrop.classList.add('show');
    return;
  }

  if (similarModalTitle) similarModalTitle.textContent = `Anime similar to "${anime.title}"`;
  if (similarModalBody) similarModalBody.innerHTML = `<svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
  if (similarModalBackdrop) similarModalBackdrop.classList.add('show');

  const genresText = anime.genres && anime.genres.length > 0 ? `which has the genres: ${anime.genres.join(', ')}` : "which has unknown genres";
  const prompt = `I enjoyed the anime "${anime.title}", ${genresText}. Please recommend three other anime series that have a similar theme, tone, or style. For each, provide a title and a one-sentence synopsis. Format the response as simple HTML with <h4> for titles and <p> for the synopsis. Do not include markdown like \`\`\`html.`;

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
    // --- THIS IS THE MISSING PART ---
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    // ---------------------------------
    if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
    const result = await response.json();

    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
      throw new Error("Invalid response structure from Gemini API.");
    }

    const text = result.candidates[0].content.parts[0].text;
    if (similarModalBody) {
      if (text) similarModalBody.innerHTML = text.replace(/\n/g, '<br>');
      else throw new Error("No content from API.");
    }
  } catch (error) {
    console.error("Gemini Similar Anime Error:", error);
    if (similarModalBody) similarModalBody.innerHTML = `<p class="text-red-500">Sorry, could not get recommendations. ${error.message}</p>`;
  }
}

/**
 * Fetches personalized recommendations based on the user's top genres.
 * @param {object | null} lastStats - The calculated statistics object.
 * @param {string} GEMINI_API_KEY - The user's Gemini API key.
 */
export async function getGeminiRecommendations(lastStats, GEMINI_API_KEY) {
  const geminiResponse = document.getElementById('gemini-response');
  const geminiLoading = document.getElementById('gemini-loading');
  const geminiButton = document.getElementById('gemini-button');

  if (!GEMINI_API_KEY) {
    if (geminiResponse) geminiResponse.innerHTML = `<p class="text-red-500"><strong>Error:</strong> AI features disabled. Please set your key in Settings ⚙️.</p>`;
    return;
  }

  if (!lastStats || !lastStats.genreCounts || Object.keys(lastStats.genreCounts).length === 0) {
    if (geminiResponse) geminiResponse.innerHTML = `<p>Please sync your anime list first to get personalized recommendations.</p>`;
    return;
  }

  const topGenres = Object.entries(lastStats.genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, window.CONFIG.CHART_GENRE_LIMIT || 10);

  if (topGenres.length === 0) {
    if (geminiResponse) geminiResponse.innerHTML = `<p>Your anime list doesn't contain enough genre information for recommendations.</p>`;
    return;
  }

  const prompt = `Based on my favorite anime genres (${topGenres.map(g => g[0]).join(', ')}), recommend three other anime series I might enjoy. For each, provide a title and a one-sentence synopsis explaining why I might like it based on my genres. Format as simple HTML with <h4> for titles and <p> for the synopsis. Do not include markdown like \`\`\`html.`;

  if (geminiLoading) geminiLoading.classList.remove('hidden');
  if (geminiButton) geminiButton.disabled = true;
  if (geminiResponse) geminiResponse.innerHTML = '';

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
    const result = await response.json();

    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
      throw new Error("Invalid response structure from Gemini API.");
    }
    const text = result.candidates[0].content.parts[0].text;
    if (geminiResponse) {
      if (text) geminiResponse.innerHTML = text.replace(/\n/g, '<br>');
      else throw new Error("No content from API.");
    }
  } catch (error) {
    console.error("Gemini API Recommendations Error:", error);
    if (geminiResponse) geminiResponse.innerHTML = `<p class="text-red-500">Sorry, could not get recommendations. ${error.message}</p>`;
  } finally {
    if (geminiLoading) geminiLoading.classList.add('hidden');
    if (geminiButton) geminiButton.disabled = false;
  }
}