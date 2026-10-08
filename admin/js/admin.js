/* =========================================================================
   HeritageX — admin.js
   Split across dashboard.html / sites.html / reviews.html / analytics.html.
   Every render/wire function checks that its target elements exist before
   touching them, so this single shared file works safely across every
   admin page without throwing errors for elements that live elsewhere.
   ========================================================================= */

const ADMIN_KEY = LS_KEYS.admin; // "heritagex_admin_sites"

function getAdminOverlay() {
    return lsGet(ADMIN_KEY, { added: [], edited: {}, deleted: [] });
}
function setAdminOverlay(overlay) {
    lsSet(ADMIN_KEY, overlay);
}

/* Merge base dataset + admin overlay into one working list */
function getAdminSiteList() {
    const overlay = getAdminOverlay();
    const base = getAllSites()
        .filter((s) => !overlay.deleted.includes(s.id))
        .map((s) => ({ ...s, ...(overlay.edited[s.id] || {}) }));
    return [...base, ...overlay.added];
}

function nextAdminId() {
    const overlay = getAdminOverlay();
    const allIds = [...getAllSites().map((s) => s.id), ...overlay.added.map((s) => s.id)];
    return Math.max(0, ...allIds) + 1;
}

/* ---------- Stats (rendered on every admin page that has the stat cards) ---------- */
function renderStats() {
    const totalEl = document.getElementById("statTotal");
    if (!totalEl) return;

    const sites = getAdminSiteList();
    totalEl.textContent = sites.length;
    document.getElementById("statVerified").textContent = sites.filter((s) => s.verified).length;
    document.getElementById("statCategories").textContent = new Set(sites.map((s) => s.category)).size;

    let pendingCount = 0;
    sites.forEach((s) => {
        const userReviews = lsGet(`${LS_KEYS.reviews}_${s.id}`, []);
        pendingCount += userReviews.filter((r) => r.pending).length;
    });
    document.getElementById("statPending").textContent = pendingCount;
}

/* ---------- Sites management (sites.html only) ---------- */
function renderSitesTable() {
    const tbody = document.getElementById("sitesTableBody");
    if (!tbody) return;

    const sites = getAdminSiteList();
    tbody.innerHTML = sites.map((s) => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          <img src="${s.image}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">
          <span class="fw-semibold">${s.name}</span>
        </div>
      </td>
      <td>${s.category}</td>
      <td><i class="bi bi-star-fill text-warning"></i> ${s.rating.toFixed(1)}</td>
      <td>${s.verified
            ? `<span class="badge bg-success-subtle text-success-emphasis"><i class="bi bi-patch-check-fill"></i> Verified</span>`
            : `<span class="badge bg-secondary">Pending verification</span>`}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary me-1 edit-site-btn" data-id="${s.id}" aria-label="Edit ${s.name}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-site-btn" data-id="${s.id}" aria-label="Delete ${s.name}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join("");

    tbody.querySelectorAll(".edit-site-btn").forEach((btn) =>
        btn.addEventListener("click", () => openSiteModal(Number(btn.dataset.id)))
    );
    tbody.querySelectorAll(".delete-site-btn").forEach((btn) =>
        btn.addEventListener("click", () => deleteSite(Number(btn.dataset.id)))
    );
}

function populateCategorySelect() {
    const sel = document.getElementById("siteFormCategory");
    if (!sel) return;
    sel.innerHTML = getCategories().map((c) => `<option value="${c}">${c}</option>`).join("");
}

function openSiteModal(id) {
    populateCategorySelect();
    const modalTitle = document.getElementById("siteModalLabel");
    const form = document.getElementById("siteForm");
    if (!form) return;
    form.reset();

    if (id) {
        const site = getAdminSiteList().find((s) => s.id === id);
        modalTitle.textContent = "Edit Heritage Site";
        document.getElementById("siteFormId").value = site.id;
        document.getElementById("siteFormName").value = site.name;
        document.getElementById("siteFormCategory").value = site.category;
        document.getElementById("siteFormDesc").value = site.shortDescription;
        document.getElementById("siteFormVerified").value = String(site.verified);
    } else {
        modalTitle.textContent = "Add Heritage Site";
        document.getElementById("siteFormId").value = "";
        document.getElementById("siteFormVerified").value = "false";
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("siteModal")).show();
}

function deleteSite(id) {
    const site = getAdminSiteList().find((s) => s.id === id);
    if (!confirm(`Delete "${site.name}"? This only affects this browser's demo data.`)) return;

    const overlay = getAdminOverlay();
    const isBaseSite = getAllSites().some((s) => s.id === id);
    if (isBaseSite) {
        overlay.deleted.push(id);
        delete overlay.edited[id];
    } else {
        overlay.added = overlay.added.filter((s) => s.id !== id);
    }
    setAdminOverlay(overlay);
    showToast("Site removed", "bi-trash", site.name);
    renderStats();
    renderSitesTable();
    renderCharts();
    renderAnalyticsTable();
}

function wireSitesPage() {
    const addBtn = document.getElementById("addSiteBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", () => openSiteModal(null));

    document.getElementById("siteForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const idVal = document.getElementById("siteFormId").value;
        const name = document.getElementById("siteFormName").value.trim();
        const category = document.getElementById("siteFormCategory").value;
        const shortDescription = document.getElementById("siteFormDesc").value.trim();
        const verified = document.getElementById("siteFormVerified").value === "true";

        const overlay = getAdminOverlay();

        if (idVal) {
            const id = Number(idVal);
            const isBaseSite = getAllSites().some((s) => s.id === id);
            const patch = { name, category, shortDescription, verified };
            if (isBaseSite) {
                overlay.edited[id] = { ...(overlay.edited[id] || {}), ...patch };
            } else {
                overlay.added = overlay.added.map((s) => (s.id === id ? { ...s, ...patch } : s));
            }
            showToast("Site updated", "bi-check-circle-fill", name);
        } else {
            const newSite = {
                id: nextAdminId(),
                name,
                slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                category,
                tags: ["Admin Added"],
                interests: ["history"],
                shortDescription,
                history: shortDescription,
                culturalSignificance: shortDescription,
                architecture: "Details to be added by admin.",
                image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1200&auto=format&fit=crop",
                gallery: ["https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=1200&auto=format&fit=crop"],
                latitude: 23.03,
                longitude: 72.58,
                rating: 4.0,
                reviewCount: 0,
                duration: "30 min",
                timings: "To be confirmed",
                entryFee: "To be confirmed",
                nearbyPlaces: [],
                responsibleGuidelines: ["Follow general heritage-site etiquette."],
                verified,
                source: "Added via admin demo — pending official verification"
            };
            overlay.added.push(newSite);
            showToast("Site added", "bi-plus-circle-fill", name);
        }

        setAdminOverlay(overlay);
        bootstrap.Modal.getInstance(document.getElementById("siteModal")).hide();
        renderStats();
        renderSitesTable();
        renderCharts();
        renderAnalyticsTable();
    });
}

/* ---------- Review moderation (reviews.html only) ---------- */
function renderPendingReviews() {
    const list = document.getElementById("pendingReviewsList");
    if (!list) return;

    const emptyEl = document.getElementById("noPendingReviews");
    const sites = getAdminSiteList();

    let rows = [];
    sites.forEach((site) => {
        const key = `${LS_KEYS.reviews}_${site.id}`;
        const userReviews = lsGet(key, []);
        userReviews.forEach((r, idx) => {
            if (r.pending) rows.push({ site, review: r, idx, key });
        });
    });

    if (!rows.length) {
        list.innerHTML = "";
        emptyEl.classList.remove("d-none");
        return;
    }
    emptyEl.classList.add("d-none");

    list.innerHTML = rows.map(({ site, review, idx, key }) => `
    <div class="admin-panel-card p-3 mb-3">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong>${site.name}</strong>
          <span class="text-warning small ms-2">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
          <p class="small text-secondary mb-1 mt-1">${review.text}</p>
          <span class="small text-secondary">By ${review.author} · ${review.date}</span>
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="btn btn-sm btn-admin-primary approve-review-btn" data-key="${key}" data-idx="${idx}">Approve</button>
          <button class="btn btn-sm btn-outline-danger reject-review-btn" data-key="${key}" data-idx="${idx}">Reject</button>
        </div>
      </div>
    </div>`).join("");

    list.querySelectorAll(".approve-review-btn").forEach((btn) =>
        btn.addEventListener("click", () => moderateReview(btn.dataset.key, Number(btn.dataset.idx), "approve"))
    );
    list.querySelectorAll(".reject-review-btn").forEach((btn) =>
        btn.addEventListener("click", () => moderateReview(btn.dataset.key, Number(btn.dataset.idx), "reject"))
    );
}

function moderateReview(key, idx, action) {
    const reviews = lsGet(key, []);
    if (action === "approve") {
        reviews[idx].pending = false;
        showToast("Review approved", "bi-check-circle-fill");
    } else {
        reviews.splice(idx, 1);
        showToast("Review rejected", "bi-x-circle");
    }
    lsSet(key, reviews);
    renderStats();
    renderPendingReviews();
}

/* ---------- Analytics charts (analytics.html only) ---------- */
let categoryChartInstance, ratingChartInstance;

function renderCharts() {
    const catCanvas = document.getElementById("categoryChart");
    const ratingCanvas = document.getElementById("ratingChart");
    if (!catCanvas || !ratingCanvas) return;

    if (window.ChartDataLabels && !Chart.registry.plugins.get("datalabels")) {
        Chart.register(window.ChartDataLabels);
    }

    const sites = getAdminSiteList();
    const categories = [...new Set(sites.map((s) => s.category))];
    const countsByCategory = categories.map((c) => sites.filter((s) => s.category === c).length);
    const avgRatingByCategory = categories.map((c) => {
        const inCat = sites.filter((s) => s.category === c);
        return inCat.reduce((sum, s) => sum + s.rating, 0) / inCat.length;
    });

    const palette = ["#6E1E24", "#C17A45", "#A9822C", "#2f7a4d", "#3a5a8c", "#B5533C", "#8a3037", "#4A1015", "#CBA75A", "#574F47", "#DBA679"];

    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(catCanvas, {
        type: "doughnut",
        data: {
            labels: categories,
            datasets: [{ data: countsByCategory, backgroundColor: palette, borderColor: "#ffffff", borderWidth: 2 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, color: "#1f2430" } },
                datalabels: {
                    color: "#ffffff",
                    font: { weight: "700", size: 12 },
                    formatter: (value) => (value > 0 ? value : "")
                }
            }
        }
    });

    if (ratingChartInstance) ratingChartInstance.destroy();
    ratingChartInstance = new Chart(ratingCanvas, {
        type: "bar",
        data: {
            labels: categories,
            datasets: [{ label: "Avg. rating", data: avgRatingByCategory, backgroundColor: "#C17A45", borderRadius: 6 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 5, ticks: { color: "#1f2430", stepSize: 1 }, grid: { color: "rgba(31,36,48,0.08)" } },
                x: { ticks: { color: "#1f2430", font: { size: 10 } }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: "end", align: "top", color: "#1f2430",
                    font: { weight: "700", size: 11 },
                    formatter: (value) => value.toFixed(1)
                }
            }
        }
    });
}

/* ---------- Category breakdown table (analytics.html only) ---------- */
function renderAnalyticsTable() {
    const tbody = document.getElementById("analyticsTableBody");
    if (!tbody) return; // not on this page

    const sites = getAdminSiteList();
    const categories = [...new Set(sites.map((s) => s.category))].sort();

    if (!categories.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-4">No heritage sites yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = categories.map((cat) => {
        const inCat = sites.filter((s) => s.category === cat);
        const verified = inCat.filter((s) => s.verified).length;
        const avgRating = inCat.reduce((sum, s) => sum + s.rating, 0) / inCat.length;
        const totalReviews = inCat.reduce((sum, s) => sum + s.reviewCount, 0);
        return `
      <tr>
        <td class="fw-semibold">${cat}</td>
        <td class="text-end">${inCat.length}</td>
        <td class="text-end">${verified} / ${inCat.length}</td>
        <td class="text-end"><i class="bi bi-star-fill text-warning"></i> ${avgRating.toFixed(1)}</td>
        <td class="text-end">${totalReviews.toLocaleString()}</td>
      </tr>`;
    }).join("");
}

/* ---------- Mobile sidebar open/close ---------- */
function wireSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const toggleBtn = document.getElementById("sidebarToggle");
    const closeBtn = document.getElementById("sidebarCloseBtn");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!sidebar || !toggleBtn) return;

    function openSidebar() {
        sidebar.classList.add("open");
        backdrop.classList.add("show");
        toggleBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }
    function closeSidebar() {
        sidebar.classList.remove("open");
        backdrop.classList.remove("show");
        toggleBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    });
    closeBtn?.addEventListener("click", closeSidebar);
    backdrop?.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll(".admin-nav-link, .sidebar-footer button").forEach((el) => {
        el.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSidebar();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth >= 992) closeSidebar();
    });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
    wireSidebar();
    populateCategorySelect();
    wireSitesPage();
    renderStats();
    renderSitesTable();
    renderPendingReviews();
    renderCharts();
    renderAnalyticsTable();

    document.getElementById("logoutBtn")?.addEventListener("click", () => logoutAdmin());
});