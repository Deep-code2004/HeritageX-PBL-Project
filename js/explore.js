/* ---------------------------
   HeritageX — explore.js
   --------------------------- */

const PERIOD_MAP = {
    1: "sultanate", 2: "sultanate", 3: "sultanate", 4: "sultanate", 5: "sultanate",
    9: "sultanate", 10: "sultanate",
    17: "mughal",
    7: "colonial", 8: "colonial", 14: "colonial", 18: "colonial",
    16: "independence"
};

const PAGE_SIZE = 6;
let currentPage = 1;
let currentView = "card";

function populateCategoryOptions() {
    const sel = document.getElementById("categoryFilter");
    getCategories().forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

function renderCategoryChips() {
    const chipWrap = document.getElementById("categoryChips");
    const cats = getCategories();
    const active = document.getElementById("categoryFilter").value;
    chipWrap.innerHTML = cats.map((c) => `<button type="button" class="chip ${c === active ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
    chipWrap.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const sel = document.getElementById("categoryFilter");
            sel.value = sel.value === chip.dataset.cat ? "" : chip.dataset.cat;
            currentPage = 1;
            applyFilters();
        });
    });
}

function durationMinutes(str) {
    // pulls the first number out of strings like "45–60 min" or "90–120 min"
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

function applyFilters() {
    const q = (document.getElementById("searchInput").value || "").toLowerCase().trim();
    const category = document.getElementById("categoryFilter").value;
    const period = document.getElementById("periodFilter").value;
    const durationBand = document.getElementById("durationFilter").value;
    const minRating = parseFloat(document.getElementById("ratingFilter").value || "0");
    const sort = document.getElementById("sortSelect").value;

    let results = getAllSites().filter((s) => {
        const haystack = `${s.name} ${s.category} ${s.tags.join(" ")} ${s.shortDescription}`.toLowerCase();
        const matchesQ = !q || haystack.includes(q);
        const matchesCat = !category || s.category === category;
        const matchesPeriod = !period || PERIOD_MAP[s.id] === period;
        const mins = durationMinutes(s.duration);
        const matchesDuration =
            !durationBand ||
            (durationBand === "short" && mins < 30) ||
            (durationBand === "medium" && mins >= 30 && mins <= 60) ||
            (durationBand === "long" && mins > 60);
        const matchesRating = s.rating >= minRating;
        return matchesQ && matchesCat && matchesPeriod && matchesDuration && matchesRating;
    });

    results.sort((a, b) => {
        if (sort === "rating") return b.rating - a.rating;
        if (sort === "reviews") return b.reviewCount - a.reviewCount;
        if (sort === "name") return a.name.localeCompare(b.name);
        return 0;
    });

    renderResults(results);
    renderCategoryChips();
}

function renderResults(results) {
    const grid = document.getElementById("resultsGrid");
    const empty = document.getElementById("emptyState");
    const countEl = document.getElementById("resultsCount");
    const loadMoreBtn = document.getElementById("loadMoreBtn");

    countEl.textContent = `${results.length} heritage site${results.length === 1 ? "" : "s"} found`;

    if (results.length === 0) {
        grid.innerHTML = "";
        empty.classList.remove("d-none");
        loadMoreBtn.classList.add("d-none");
        return;
    }
    empty.classList.add("d-none");

    const visible = results.slice(0, currentPage * PAGE_SIZE);
    loadMoreBtn.classList.toggle("d-none", visible.length >= results.length);

    if (currentView === "card") {
        grid.className = "row g-4";
        grid.innerHTML = visible.map((s) => `<div class="col-sm-6 col-lg-4">${siteCardHTML(s)}</div>`).join("");
    } else {
        grid.className = "row g-3";
        grid.innerHTML = visible.map((s) => `
      <div class="col-12">
        <div class="hx-card">
          <div class="row g-0">
            <div class="col-4 col-md-3">
              <div class="card-img-wrap" style="aspect-ratio:1/1;"><a href="detail.html?slug=${s.slug}"><img src="${s.image}" alt="${s.name}" loading="lazy"></a></div>
            </div>
            <div class="col-8 col-md-9">
              <div class="card-body-custom h-100 d-flex flex-column justify-content-center">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <span class="card-cat-badge" style="position:static;display:inline-block;margin-bottom:0.4rem;">${s.category}</span>
                    <h3 class="h5 mb-1"><a href="detail.html?slug=${s.slug}" class="text-maroon">${s.name}</a></h3>
                  </div>
                  <button class="btn btn-sm btn-outline-maroon rounded-circle" style="width:38px;height:38px;" onclick="toggleBookmark(${s.id})" aria-label="Save ${s.name}"><i class="bi ${isBookmarked(s.id) ? "bi-bookmark-fill" : "bi-bookmark"}"></i></button>
                </div>
                <p class="text-charcoal-soft small mb-2 d-none d-md-block">${s.shortDescription}</p>
                <div class="d-flex gap-3 small text-charcoal-soft">
                  <span><i class="bi bi-star-fill text-warning"></i> ${s.rating.toFixed(1)}</span>
                  <span><i class="bi bi-clock"></i> ${s.duration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateCategoryOptions();

    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) document.getElementById("searchInput").value = params.get("q");
    if (params.get("category")) document.getElementById("categoryFilter").value = params.get("category");
    if (params.get("interest")) document.getElementById("searchInput").value = params.get("interest");

    ["searchInput"].forEach((id) => document.getElementById(id).addEventListener("input", () => { currentPage = 1; applyFilters(); }));
    ["categoryFilter", "periodFilter", "durationFilter", "ratingFilter", "locationFilter", "sortSelect"].forEach((id) =>
        document.getElementById(id).addEventListener("change", () => { currentPage = 1; applyFilters(); })
    );

    document.getElementById("clearFilters").addEventListener("click", () => {
        document.getElementById("searchInput").value = "";
        ["categoryFilter", "periodFilter", "durationFilter", "ratingFilter", "locationFilter"].forEach((id) => (document.getElementById(id).value = ""));
        currentPage = 1;
        applyFilters();
    });
    document.getElementById("emptyClearBtn").addEventListener("click", () => document.getElementById("clearFilters").click());

    document.getElementById("loadMoreBtn").addEventListener("click", () => { currentPage++; applyFilters(); });

    document.getElementById("viewCardBtn").addEventListener("click", () => {
        currentView = "card";
        document.getElementById("viewCardBtn").classList.add("active");
        document.getElementById("viewListBtn").classList.remove("active");
        applyFilters();
    });
    document.getElementById("viewListBtn").addEventListener("click", () => {
        currentView = "list";
        document.getElementById("viewListBtn").classList.add("active");
        document.getElementById("viewCardBtn").classList.remove("active");
        applyFilters();
    });

    applyFilters();
});