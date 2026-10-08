/* ---------------------------
   HeritageX — recommendations.js
   A transparent, rule-based scoring engine (NOT an AI model). Every score
   is the sum of four weighted factors so results can be explained in
   plain language, per the project brief.
   --------------------------- */

const INTEREST_OPTIONS = [
    { key: "history", label: "History", icon: "bi-hourglass-split" },
    { key: "architecture", label: "Architecture", icon: "bi-columns-gap" },
    { key: "food", label: "Food", icon: "bi-egg-fried" },
    { key: "art", label: "Art", icon: "bi-palette" },
    { key: "culture", label: "Culture", icon: "bi-people" },
    { key: "religion", label: "Religion", icon: "bi-moon-stars" },
    { key: "photography", label: "Photography", icon: "bi-camera" },
    { key: "shopping", label: "Shopping", icon: "bi-bag" },
    { key: "festivals", label: "Festivals", icon: "bi-stars" }
];

const TIME_OPTIONS = [
    { key: "1h", label: "1 hour", minutes: 60, icon: "bi-clock" },
    { key: "2h", label: "2 hours", minutes: 120, icon: "bi-clock-history" },
    { key: "half", label: "Half day", minutes: 240, icon: "bi-sun" },
    { key: "full", label: "Full day", minutes: 480, icon: "bi-calendar3" }
];

const STYLE_OPTIONS = [
    { key: "walking", label: "Walking", icon: "bi-person-walking", radiusKm: 2 },
    { key: "transit", label: "Public transport", icon: "bi-bus-front", radiusKm: 6 },
    { key: "bikecar", label: "Bike / Car", icon: "bi-car-front", radiusKm: 15 }
];

const AREA_OPTIONS = [
    { key: "bhadra", label: "Bhadra Fort / Old City Core", icon: "bi-geo-alt", latitude: 23.0225, longitude: 72.5825 },
    { key: "kalupur", label: "Kalupur (Swaminarayan Temple)", icon: "bi-geo-alt", latitude: 23.0294, longitude: 72.5906 },
    { key: "riverfront", label: "Riverfront (Sabarmati Ashram side)", icon: "bi-geo-alt", latitude: 23.061, longitude: 72.5806 },
    { key: "station", label: "Railway Station area", icon: "bi-geo-alt", latitude: 23.0258, longitude: 72.5972 }
];

const state = { interests: [], time: null, style: null, area: null };
let currentStep = 1;

function renderChoiceTiles(containerId, options, multi, stateKey, colClass = "col-6 col-md-4") {
    const container = document.getElementById(containerId);
    container.innerHTML = options.map((opt) => `
    <div class="${colClass}">
      <div class="choice-tile" data-key="${opt.key}" role="button" tabindex="0" aria-pressed="false">
        <i class="bi ${opt.icon}" aria-hidden="true"></i>
        <div class="fw-semibold">${opt.label}</div>
      </div>
    </div>`).join("");

    function select(tile) {
        const key = tile.dataset.key;
        if (multi) {
            if (state[stateKey].includes(key)) {
                state[stateKey] = state[stateKey].filter((k) => k !== key);
                tile.classList.remove("selected");
                tile.setAttribute("aria-pressed", "false");
            } else {
                state[stateKey].push(key);
                tile.classList.add("selected");
                tile.setAttribute("aria-pressed", "true");
            }
        } else {
            container.querySelectorAll(".choice-tile").forEach((t) => { t.classList.remove("selected"); t.setAttribute("aria-pressed", "false"); });
            tile.classList.add("selected");
            tile.setAttribute("aria-pressed", "true");
            state[stateKey] = key;
        }
        updateContinueButtons();
    }

    container.querySelectorAll(".choice-tile").forEach((tile) => {
        tile.addEventListener("click", () => select(tile));
        tile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(tile); } });
    });
}

function updateContinueButtons() {
    document.getElementById("next1").disabled = state.interests.length === 0;
    document.getElementById("next2").disabled = !state.time;
    document.getElementById("next3").disabled = !state.style;
    document.getElementById("generateBtn").disabled = !state.area;
}

function goToStep(n) {
    currentStep = n;
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`panel${i}`).classList.toggle("d-none", i !== n);
        const dot = document.querySelector(`.step-dot[data-step="${i}"]`);
        dot.classList.toggle("active", i === n);
        dot.classList.toggle("done", i < n);
    }
    document.getElementById("resultsPanel").classList.add("d-none");
}

/* ---------- Scoring engine ---------- */
function scoreSite(site, area, timeMinutes, styleRadiusKm) {
    // 1) Category / interest match — up to 45 points
    const matchedInterests = site.interests.filter((i) => state.interests.includes(i));
    const interestScore = state.interests.length ? (matchedInterests.length / state.interests.length) * 45 : 0;

    // 2) Distance — up to 25 points, decays with distance relative to travel-style radius
    const dist = distanceKm(area.latitude, area.longitude, site.latitude, site.longitude);
    const distanceScore = Math.max(0, 25 * (1 - dist / (styleRadiusKm * 1.6)));

    // 3) Available time fit — up to 20 points (site duration must reasonably fit the time budget)
    const siteMinutes = durationMidpointMinutes(site.duration);
    let timeScore;
    if (siteMinutes <= timeMinutes) timeScore = 20;
    else if (siteMinutes <= timeMinutes * 1.3) timeScore = 10;
    else timeScore = 2;

    // 4) Rating — up to 10 points
    const ratingScore = (site.rating / 5) * 10;

    const total = interestScore + distanceScore + timeScore + ratingScore;
    return { total: Math.round(total), dist, matchedInterests, siteMinutes };
}

function durationMidpointMinutes(str) {
    const nums = str.match(/\d+/g);
    if (!nums) return 30;
    const vals = nums.map(Number);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function buildReason(site, scored, area) {
    const parts = [];
    if (scored.matchedInterests.length) {
        parts.push(`you selected ${scored.matchedInterests.join(" & ")}`);
    }
    parts.push(`it's ${scored.dist.toFixed(1)} km from ${area.label.split("(")[0].trim()}`);
    if (scored.siteMinutes <= 60) parts.push("it fits easily in your available time");
    return `Recommended because ${parts.join(", and ")}.`;
}

function generateRecommendations() {
    const timeOpt = TIME_OPTIONS.find((t) => t.key === state.time);
    const styleOpt = STYLE_OPTIONS.find((s) => s.key === state.style);
    const areaOpt = AREA_OPTIONS.find((a) => a.key === state.area);

    const scored = getAllSites().map((site) => {
        const result = scoreSite(site, areaOpt, timeOpt.minutes, styleOpt.radiusKm);
        return { site, ...result };
    });

    scored.sort((a, b) => b.total - a.total);
    const top = scored.slice(0, 6);
    const maxScore = Math.max(...top.map((t) => t.total), 1);

    document.getElementById("resultsGrid").innerHTML = top.map((r) => {
        const matchPct = Math.min(99, Math.round((r.total / (maxScore + 5)) * 100));
        return `
    <div class="col-md-6">
      <div class="hx-card">
        <div class="card-img-wrap">
          <a href="detail.html?slug=${r.site.slug}"><img src="${r.site.image}" alt="${r.site.name}" loading="lazy"></a>
          <span class="match-badge" style="position:absolute;top:12px;right:12px;">${matchPct}% match</span>
          <span class="card-cat-badge">${r.site.category}</span>
        </div>
        <div class="card-body-custom">
          <h3 class="h5 mb-1"><a href="detail.html?slug=${r.site.slug}" class="text-maroon">${r.site.name}</a></h3>
          <p class="small text-charcoal-soft mb-2">${buildReason(r.site, r, areaOpt)}</p>
          <div class="d-flex gap-3 small text-charcoal-soft mb-3">
            <span><i class="bi bi-star-fill text-warning"></i> ${r.site.rating.toFixed(1)}</span>
            <span><i class="bi bi-signpost-2"></i> ${r.dist.toFixed(1)} km</span>
            <span><i class="bi bi-clock"></i> ${r.site.duration}</span>
          </div>
          <div class="d-flex gap-2">
            <a href="detail.html?slug=${r.site.slug}" class="btn btn-outline-maroon btn-sm flex-fill">View details</a>
            <button class="btn btn-maroon btn-sm flex-fill add-trip-btn" data-id="${r.site.id}">Add to Trip</button>
          </div>
        </div>
      </div>
    </div>`;
    }).join("");

    document.querySelectorAll(".add-trip-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = Number(btn.dataset.id);
            const itinerary = lsGet(LS_KEYS.itinerary, []);
            if (!itinerary.find((i) => i.siteId === id)) {
                itinerary.push({ siteId: id, time: "" });
                lsSet(LS_KEYS.itinerary, itinerary);
            }
            const site = getSiteById(id);
            showToast("Added to your trip", "bi-map", site.name);
        });
    });

    document.querySelectorAll(".step-panel").forEach((p) => p.classList.add("d-none"));
    document.getElementById("resultsPanel").classList.remove("d-none");
}

document.addEventListener("DOMContentLoaded", () => {
    renderChoiceTiles("interestChoices", INTEREST_OPTIONS, true, "interests");
    renderChoiceTiles("timeChoices", TIME_OPTIONS, false, "time", "col-6 col-md-3");
    renderChoiceTiles("styleChoices", STYLE_OPTIONS, false, "style", "col-6 col-md-4");
    renderChoiceTiles("areaChoices", AREA_OPTIONS, false, "area", "col-12 col-md-6");

    document.getElementById("next1").addEventListener("click", () => goToStep(2));
    document.getElementById("back2").addEventListener("click", () => goToStep(1));
    document.getElementById("next2").addEventListener("click", () => goToStep(3));
    document.getElementById("back3").addEventListener("click", () => goToStep(2));
    document.getElementById("next3").addEventListener("click", () => goToStep(4));
    document.getElementById("back4").addEventListener("click", () => goToStep(3));
    document.getElementById("generateBtn").addEventListener("click", generateRecommendations);
    document.getElementById("restartBtn").addEventListener("click", () => {
        state.interests = []; state.time = null; state.style = null; state.area = null;
        document.querySelectorAll(".choice-tile").forEach((t) => { t.classList.remove("selected"); t.setAttribute("aria-pressed", "false"); });
        updateContinueButtons();
        document.getElementById("resultsPanel").classList.add("d-none");
        goToStep(1);
    });
});