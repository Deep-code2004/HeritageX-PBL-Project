/* API-backed catalogue browsing with local-only legacy facets. */
const PERIOD_MAP = {
    1: "sultanate", 2: "sultanate", 3: "sultanate", 4: "sultanate", 5: "sultanate",
    9: "sultanate", 10: "sultanate", 17: "mughal",
    7: "colonial", 8: "colonial", 14: "colonial", 18: "colonial", 16: "independence"
};
const PAGE_SIZE = 6;
const API_PAGE_SIZE = 50;
let currentPage = 1;
let currentView = "card";
let catalogueSites = [];
let catalogueMeta = { total: 0, totalPages: 1 };
let requestSequence = 0;
let searchTimer;

function durationMinutes(value) {
    if (typeof value === "number") return value;
    const match = String(value || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
}

function getLocalFacets() {
    return {
        period: document.getElementById("periodFilter").value,
        durationBand: document.getElementById("durationFilter").value
    };
}

function getVisibleResults() {
    const { period, durationBand } = getLocalFacets();
    return catalogueSites.filter((site) => {
        if (period && PERIOD_MAP[site.id] !== period) return false;
        const duration = durationMinutes(site.duration);
        if (durationBand === "short" && duration >= 30) return false;
        if (durationBand === "medium" && (duration < 30 || duration > 60)) return false;
        if (durationBand === "long" && duration <= 60) return false;
        const location = document.getElementById("locationFilter").value;
        if (location && Number.isFinite(site.latitude) && Number.isFinite(site.longitude)) {
            const inOldCityCore = distanceKm(site.latitude, site.longitude, 23.0225, 72.5825) <= 2.5;
            if ((location === "walled") !== inOldCityCore) return false;
        }
        return true;
    });
}

function populateCategories(categories) {
    const select = document.getElementById("categoryFilter");
    const selected = select.value;
    select.innerHTML = `<option value="">All categories</option>`;
    categories.forEach((item) => {
        const category = typeof item === "string" ? item : item.name;
        if (!category) return;
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
    select.value = selected;
}

function renderCategoryChips() {
    const wrapper = document.getElementById("categoryChips");
    const categories = [...new Set(catalogueSites.map((site) => site.category).filter(Boolean))];
    const active = document.getElementById("categoryFilter").value;
    wrapper.replaceChildren();
    categories.forEach((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `chip${category === active ? " active" : ""}`;
        button.textContent = category;
        button.addEventListener("click", () => {
            const select = document.getElementById("categoryFilter");
            select.value = select.value === category ? "" : category;
            currentPage = 1;
            loadCatalogue();
        });
        wrapper.appendChild(button);
    });
}

function renderResults(results) {
    const grid = document.getElementById("resultsGrid");
    const empty = document.getElementById("emptyState");
    const countEl = document.getElementById("resultsCount");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    const visible = results.slice(0, currentPage * PAGE_SIZE);

    countEl.textContent = catalogueSites.length < catalogueMeta.total
        ? `${results.length} matching sites in ${catalogueSites.length} of ${catalogueMeta.total} loaded`
        : `${results.length} heritage site${results.length === 1 ? "" : "s"} found`;
    if (!results.length) {
        grid.innerHTML = "";
        empty.classList.remove("d-none");
        const moreRemote = catalogueSites.length < catalogueMeta.total;
        loadMoreBtn.classList.toggle("d-none", !moreRemote);
        loadMoreBtn.textContent = moreRemote ? "Load more results" : "Load more sites";
        return;
    }
    empty.classList.add("d-none");

    if (currentView === "card") {
        grid.className = "row g-4";
        grid.innerHTML = visible.map((site) =>
            `<div class="col-sm-6 col-lg-4">${siteCardHTML(site)}</div>`
        ).join("");
    } else {
        grid.className = "row g-3";
        grid.innerHTML = visible.map((site) => `
            <div class="col-12">
                <div class="hx-card">
                    <div class="row g-0">
                        <div class="col-4 col-md-3">
                            <div class="card-img-wrap" style="aspect-ratio:1/1;">
                                <a href="detail.html?slug=${encodeURIComponent(site.slug)}"><img src="${escapeHTML(site.image)}" alt="${escapeHTML(site.name)}" loading="lazy"></a>
                            </div>
                        </div>
                        <div class="col-8 col-md-9">
                            <div class="card-body-custom h-100 d-flex flex-column justify-content-center">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <span class="card-cat-badge" style="position:static;display:inline-block;margin-bottom:0.4rem;">${escapeHTML(site.category)}</span>
                                        <h3 class="h5 mb-1"><a href="detail.html?slug=${encodeURIComponent(site.slug)}" class="text-maroon">${escapeHTML(site.name)}</a></h3>
                                    </div>
                                    <button class="btn btn-sm btn-outline-maroon rounded-circle" data-site-id="${site.id}" aria-pressed="${isBookmarked(site.id)}" style="width:38px;height:38px;" onclick="toggleBookmark(${site.id})" aria-label="Save ${escapeHTML(site.name)}"><i class="bi ${isBookmarked(site.id) ? "bi-bookmark-fill" : "bi-bookmark"}"></i></button>
                                </div>
                                <p class="text-charcoal-soft small mb-2 d-none d-md-block">${escapeHTML(site.shortDescription)}</p>
                                <div class="d-flex gap-3 small text-charcoal-soft">
                                    <span><i class="bi bi-star-fill text-warning"></i> ${Number(site.rating).toFixed(1)}</span>
                                    <span><i class="bi bi-clock"></i> ${escapeHTML(site.duration)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`).join("");
    }

    const moreLocal = visible.length < results.length;
    const moreRemote = catalogueSites.length < catalogueMeta.total;
    loadMoreBtn.classList.toggle("d-none", !moreLocal && !moreRemote);
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = moreLocal ? "Load more sites" : "Load more sites";
}

async function loadCatalogue(append = false) {
    const sequence = ++requestSequence;
    const params = {
        q: document.getElementById("searchInput").value.trim(),
        category: document.getElementById("categoryFilter").value,
        minRating: document.getElementById("ratingFilter").value,
        sort: document.getElementById("sortSelect").value,
        page: append ? Math.floor(catalogueSites.length / API_PAGE_SIZE) + 1 : 1,
        limit: API_PAGE_SIZE
    };
    const grid = document.getElementById("resultsGrid");
    const loadMore = document.getElementById("loadMoreBtn");
    if (!append) {
        catalogueSites = [];
        catalogueMeta = { total: 0, totalPages: 1 };
        grid.setAttribute("aria-busy", "true");
        grid.innerHTML = `<div class="col-12 text-charcoal-soft" role="status">Loading heritage sites…</div>`;
        loadMore.classList.add("d-none");
    } else {
        loadMore.disabled = true;
        loadMore.textContent = "Loading…";
    }

    try {
        const result = await api.getSites(params);
        if (sequence !== requestSequence) return;
        catalogueSites = append ? catalogueSites.concat(result.data) : result.data;
        catalogueMeta = result.meta || catalogueMeta;
        grid.removeAttribute("aria-busy");
        renderCategoryChips();
        renderResults(getVisibleResults());
    } catch (error) {
        if (sequence !== requestSequence) return;
        grid.removeAttribute("aria-busy");
        grid.innerHTML = `<div class="col-12"><div class="alert alert-warning mb-0" role="alert">${escapeHTML(error.message)} <button type="button" class="btn btn-sm btn-outline-maroon ms-2" id="retryCatalogue">Retry</button></div></div>`;
        document.getElementById("retryCatalogue").addEventListener("click", () => loadCatalogue());
        document.getElementById("resultsCount").textContent = "Catalogue unavailable";
        document.getElementById("emptyState").classList.add("d-none");
        loadMore.classList.add("d-none");
    }
}

function scheduleCatalogueLoad() {
    currentPage = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCatalogue(), 250);
}

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) document.getElementById("searchInput").value = params.get("q");
    if (params.get("category")) document.getElementById("categoryFilter").value = params.get("category");
    if (params.get("interest")) document.getElementById("searchInput").value = params.get("interest");

    try {
        const categories = await api.getCategories();
        populateCategories(categories);
        if (params.get("category")) document.getElementById("categoryFilter").value = params.get("category");
    } catch (error) {
        console.warn("Unable to load categories from the API:", error.message);
    }

    document.getElementById("searchInput").addEventListener("input", scheduleCatalogueLoad);
    ["categoryFilter", "ratingFilter", "sortSelect"].forEach((id) =>
        document.getElementById(id).addEventListener("change", scheduleCatalogueLoad)
    );
    ["periodFilter", "durationFilter", "locationFilter"].forEach((id) =>
        document.getElementById(id).addEventListener("change", () => {
            currentPage = 1;
            renderResults(getVisibleResults());
        })
    );
    document.getElementById("clearFilters").addEventListener("click", () => {
        document.getElementById("searchInput").value = "";
        ["categoryFilter", "periodFilter", "durationFilter", "ratingFilter", "locationFilter"].forEach((id) => {
            document.getElementById(id).value = "";
        });
        currentPage = 1;
        loadCatalogue();
    });
    document.getElementById("emptyClearBtn").addEventListener("click", () =>
        document.getElementById("clearFilters").click()
    );
    document.getElementById("loadMoreBtn").addEventListener("click", async () => {
        if (currentPage * PAGE_SIZE < getVisibleResults().length) {
            currentPage++;
            renderResults(getVisibleResults());
        } else if (catalogueSites.length < catalogueMeta.total) {
            currentPage++;
            await loadCatalogue(true);
        }
    });
    document.getElementById("viewCardBtn").addEventListener("click", () => {
        currentView = "card";
        document.getElementById("viewCardBtn").classList.add("active");
        document.getElementById("viewListBtn").classList.remove("active");
        renderResults(getVisibleResults());
    });
    document.getElementById("viewListBtn").addEventListener("click", () => {
        currentView = "list";
        document.getElementById("viewListBtn").classList.add("active");
        document.getElementById("viewCardBtn").classList.remove("active");
        renderResults(getVisibleResults());
    });
    await (window.hxAuthReady || Promise.resolve());
    await loadCatalogue();
});
