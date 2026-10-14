/* =========================================================================
   HeritageX — admin.js  (v2 — fully dynamic, no data.js dependency)
   Wired to the PostgreSQL backend API.
   Works with: dashboard.html / sites.html / reviews.html / analytics.html
   ========================================================================= */

const ADMIN_API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "/api";

/* ---------- Self-contained toast (works even if main.js is absent) ---------- */
function showToast(title, icon = "bi-check-circle-fill", subtitle = "") {
  let container = document.querySelector(".hx-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "hx-toast-container";
    container.style.cssText =
      "position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;min-width:260px;";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = "toast align-items-center border-0 mb-2 show";
  el.style.cssText = "background:#2A2420;color:#F8F3E8;border-radius:12px;";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <div class="d-flex align-items-center px-3 py-2">
      <i class="bi ${icon} me-2" style="color:#CBA75A;font-size:1.1rem;"></i>
      <div class="me-3">
        <div style="font-weight:600;font-size:0.92rem;">${title}</div>
        ${subtitle ? `<div style="font-size:0.78rem;opacity:0.75;">${subtitle}</div>` : ""}
      </div>
      <button type="button" class="btn-close btn-close-white ms-auto" aria-label="Close"></button>
    </div>`;
  el.querySelector(".btn-close").addEventListener("click", () => el.remove());
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ---------- Core fetch wrapper ---------- */
async function adminFetch(path, options = {}) {
  const { method = "GET", body } = options;
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "HeritageX",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem("heritagex_admin_session");
      window.location.href = "login.html";
    }
    throw new Error(json?.error?.message || `Request failed: ${res.status}`);
  }
  return json.data;
}

/* ---------- Loading / error helpers ---------- */
function setLoadingRow(tbodyId, colSpan = 5) {
  const el = document.getElementById(tbodyId);
  if (el) {
    el.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-secondary">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading…</td></tr>`;
  }
}
function setErrorRow(tbodyId, msg, colSpan = 5) {
  const el = document.getElementById(tbodyId);
  if (el) {
    el.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-danger">
      <i class="bi bi-exclamation-triangle me-1"></i>${msg}</td></tr>`;
  }
}

// In-memory cache of loaded sites
let cachedAdminSites = [];

/* ─────────────────────────────────────────────────────────────────────────────
   STATS (every admin page)
───────────────────────────────────────────────────────────────────────────── */
async function renderStats() {
  const totalEl = document.getElementById("statTotal");
  if (!totalEl) return;

  try {
    const data = await adminFetch("/admin/analytics");
    if (!data?.stats) return;
    totalEl.textContent = data.stats.total;
    const verEl = document.getElementById("statVerified");
    if (verEl) verEl.textContent = data.stats.verified;
    const catEl = document.getElementById("statCategories");
    if (catEl) catEl.textContent = data.stats.categories;
    const penEl = document.getElementById("statPending");
    if (penEl) penEl.textContent = data.stats.pending;
  } catch (e) {
    console.warn("Stats fetch failed:", e);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SITES TABLE  (sites.html)
───────────────────────────────────────────────────────────────────────────── */
async function renderSitesTable() {
  const tbody = document.getElementById("sitesTableBody");
  if (!tbody) return;

  setLoadingRow("sitesTableBody");

  try {
    const sites = await adminFetch("/admin/heritage?limit=100");
    cachedAdminSites = Array.isArray(sites) ? sites : [];

    if (!cachedAdminSites.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-secondary">
        <i class="bi bi-bank fs-1 d-block mb-2"></i>No heritage sites yet. Click <strong>Add Heritage Site</strong> to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedAdminSites
      .map(
        (s) => `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            <img src="${s.image || 'https://via.placeholder.com/40'}" alt=""
              style="width:40px;height:40px;object-fit:cover;border-radius:6px;"
              onerror="this.src='https://via.placeholder.com/40'">
            <div>
              <div class="fw-semibold">${s.name}</div>
              <div class="small text-secondary">${s.duration || ""}</div>
            </div>
          </div>
        </td>
        <td><span class="badge bg-light text-dark border">${s.categoryName || s.category?.name || "—"}</span></td>
        <td><i class="bi bi-star-fill text-warning"></i> ${(s.rating || 0).toFixed(1)}
          <span class="small text-secondary">(${s.reviewCount || 0})</span></td>
        <td>
          ${
            s.verified
              ? `<span class="badge bg-success-subtle text-success-emphasis"><i class="bi bi-patch-check me-1"></i>Verified</span>`
              : `<span class="badge bg-warning-subtle text-warning-emphasis"><i class="bi bi-clock me-1"></i>Pending</span>`
          }
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary edit-site-btn me-1" data-id="${s.id}" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-site-btn" data-id="${s.id}" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll(".edit-site-btn").forEach((btn) =>
      btn.addEventListener("click", () => openSiteModal(Number(btn.dataset.id)))
    );
    tbody.querySelectorAll(".delete-site-btn").forEach((btn) =>
      btn.addEventListener("click", () => deleteSite(Number(btn.dataset.id)))
    );
  } catch (e) {
    setErrorRow("sitesTableBody", "Failed to load sites: " + e.message);
  }
}

async function populateCategorySelect() {
  const sel = document.getElementById("siteFormCategory");
  if (!sel) return;
  try {
    const categories = await adminFetch("/categories");
    if (Array.isArray(categories) && categories.length) {
      sel.innerHTML = categories
        .map((c) => `<option value="${c.name}">${c.name}</option>`)
        .join("");
      return;
    }
  } catch (_) { /* fall through */ }
  // Fallback list in case API is unavailable
  const fallback = [
    "Historical Monuments", "Sultanate Heritage", "Religious Heritage",
    "Pols & Havelis", "Museums", "Markets", "Living Heritage",
  ];
  sel.innerHTML = fallback.map((c) => `<option value="${c}">${c}</option>`).join("");
}

async function openSiteModal(id) {
  const form = document.getElementById("siteForm");
  const modalTitle = document.getElementById("siteModalLabel");
  if (!form) return;
  form.reset();

  await populateCategorySelect();

  if (id) {
    const site = cachedAdminSites.find((s) => s.id === id);
    if (!site) return;
    modalTitle.textContent = "Edit Heritage Site";
    document.getElementById("siteFormId").value = site.id;
    document.getElementById("siteFormName").value = site.name;
    document.getElementById("siteFormCategory").value =
      site.categoryName || site.category?.name || "";
    document.getElementById("siteFormDesc").value = site.shortDescription || "";
    document.getElementById("siteFormImage").value = site.image || "";
    document.getElementById("siteFormTimings").value = site.timings || "";
    document.getElementById("siteFormFee").value = site.entryFee || "";
    document.getElementById("siteFormLat").value = site.latitude || "";
    document.getElementById("siteFormLng").value = site.longitude || "";
    document.getElementById("siteFormVerified").value = String(site.verified);
  } else {
    modalTitle.textContent = "Add Heritage Site";
    document.getElementById("siteFormId").value = "";
    document.getElementById("siteFormVerified").value = "true";
    // Default coordinates: Ahmedabad old city centre
    document.getElementById("siteFormLat").value = "23.0225";
    document.getElementById("siteFormLng").value = "72.5827";
  }

  bootstrap.Modal.getOrCreateInstance(document.getElementById("siteModal")).show();
}

async function deleteSite(id) {
  const site = cachedAdminSites.find((s) => s.id === id);
  if (!site) return;
  if (!confirm(`Delete "${site.name}" permanently from the database?`)) return;

  try {
    await adminFetch(`/admin/heritage/${id}`, { method: "DELETE" });
    showToast("Site deleted", "bi-trash", site.name);
    await Promise.all([renderStats(), renderSitesTable()]);
    await safeRenderCharts();
    await safeRenderAnalyticsTable();
  } catch (err) {
    showToast("Error deleting site", "bi-x-circle", err.message);
  }
}

function wireSitesPage() {
  const addBtn = document.getElementById("addSiteBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => openSiteModal(null));
  }

  const form = document.getElementById("siteForm");
  if (!form) return;

  const saveBtn = document.getElementById("saveSiteBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

    const idVal = document.getElementById("siteFormId").value;
    const name = document.getElementById("siteFormName").value.trim();
    const category = document.getElementById("siteFormCategory").value;
    const shortDescription = document.getElementById("siteFormDesc").value.trim();
    const image = document.getElementById("siteFormImage")?.value.trim() || undefined;
    const timings = document.getElementById("siteFormTimings")?.value.trim() || undefined;
    const entryFee = document.getElementById("siteFormFee")?.value.trim() || undefined;
    const latRaw = document.getElementById("siteFormLat")?.value;
    const lngRaw = document.getElementById("siteFormLng")?.value;
    const latitude = latRaw ? parseFloat(latRaw) : 23.0225;
    const longitude = lngRaw ? parseFloat(lngRaw) : 72.5827;
    const verified = document.getElementById("siteFormVerified").value === "true";

    const payload = {
      name, category, shortDescription, verified,
      latitude, longitude,
      ...(image && { image }),
      ...(timings && { timings }),
      ...(entryFee && { entryFee }),
    };

    try {
      if (idVal) {
        await adminFetch(`/admin/heritage/${idVal}`, { method: "PUT", body: payload });
        showToast("Site updated", "bi-check-circle-fill", name);
      } else {
        await adminFetch("/admin/heritage", { method: "POST", body: payload });
        showToast("Site added", "bi-plus-circle-fill", name);
      }
      bootstrap.Modal.getInstance(document.getElementById("siteModal"))?.hide();
      await Promise.all([renderStats(), renderSitesTable()]);
      await safeRenderCharts();
      await safeRenderAnalyticsTable();
    } catch (err) {
      showToast("Save failed", "bi-x-circle", err.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save site"; }
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   REVIEWS  (reviews.html)
───────────────────────────────────────────────────────────────────────────── */
async function renderPendingReviews() {
  const list = document.getElementById("pendingReviewsList");
  if (!list) return;

  const emptyEl = document.getElementById("noPendingReviews");
  list.innerHTML = `<div class="text-center text-secondary py-4">
    <div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading reviews…</div>`;

  try {
    const reviews = await adminFetch("/admin/reviews?status=PENDING");
    const arr = Array.isArray(reviews) ? reviews : [];

    if (!arr.length) {
      list.innerHTML = "";
      emptyEl?.classList.remove("d-none");
      return;
    }
    emptyEl?.classList.add("d-none");

    list.innerHTML = arr
      .map(
        (r) => `
      <div class="admin-panel-card p-3 mb-3" id="review-${r.id}">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <strong>${r.site?.name || "Heritage Site"}</strong>
              <span class="text-warning">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
            </div>
            <p class="small text-secondary mb-1">${r.comment || "(no comment)"}</p>
            <span class="small text-secondary">
              By <strong>${r.user?.name || "Anonymous"}</strong>
              ${r.user?.email ? `(${r.user.email})` : ""}
              · ${new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div class="d-flex gap-2 flex-shrink-0">
            <button class="btn btn-sm btn-admin-primary approve-review-btn" data-id="${r.id}">
              <i class="bi bi-check-lg me-1"></i>Approve
            </button>
            <button class="btn btn-sm btn-outline-danger reject-review-btn" data-id="${r.id}">
              <i class="bi bi-x-lg me-1"></i>Reject
            </button>
          </div>
        </div>
      </div>`
      )
      .join("");

    list.querySelectorAll(".approve-review-btn").forEach((btn) =>
      btn.addEventListener("click", () => moderateReview(btn.dataset.id, "approve"))
    );
    list.querySelectorAll(".reject-review-btn").forEach((btn) =>
      btn.addEventListener("click", () => moderateReview(btn.dataset.id, "reject"))
    );
  } catch (err) {
    list.innerHTML = `<div class="text-center text-danger py-4">
      <i class="bi bi-exclamation-triangle me-1"></i>Failed to load reviews: ${err.message}</div>`;
  }
}

async function moderateReview(id, action) {
  const card = document.getElementById(`review-${id}`);
  const status = action === "approve" ? "APPROVED" : "REJECTED";
  try {
    // Optimistically hide the card
    if (card) card.style.opacity = "0.4";
    await adminFetch(`/admin/reviews/${id}`, { method: "PATCH", body: { status } });
    showToast(
      action === "approve" ? "Review approved" : "Review rejected",
      action === "approve" ? "bi-check-circle-fill" : "bi-x-circle"
    );
    await Promise.all([renderStats(), renderPendingReviews()]);
  } catch (err) {
    if (card) card.style.opacity = "1";
    showToast("Action failed", "bi-x-circle", err.message);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANALYTICS CHARTS  (analytics.html)
───────────────────────────────────────────────────────────────────────────── */
let categoryChartInstance, ratingChartInstance;

async function renderCharts() {
  const catCanvas = document.getElementById("categoryChart");
  const ratingCanvas = document.getElementById("ratingChart");
  if (!catCanvas || !ratingCanvas) return;

  if (window.ChartDataLabels && !Chart.registry.plugins.get("datalabels")) {
    Chart.register(window.ChartDataLabels);
  }

  try {
    const analytics = await adminFetch("/admin/analytics");
    if (!analytics) return;

    const { categoryChart, ratingChart } = analytics;

    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(catCanvas, {
      type: "doughnut",
      data: {
        labels: categoryChart.labels,
        datasets: [{
          data: categoryChart.data,
          backgroundColor: categoryChart.colors,
          borderColor: "#ffffff",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 }, color: "#1f2430" } },
          datalabels: {
            color: "#ffffff",
            font: { weight: "700", size: 12 },
            formatter: (value) => (value > 0 ? value : ""),
          },
        },
      },
    });

    if (ratingChartInstance) ratingChartInstance.destroy();
    ratingChartInstance = new Chart(ratingCanvas, {
      type: "bar",
      data: {
        labels: ratingChart.labels,
        datasets: [{
          label: "Avg. rating",
          data: ratingChart.data,
          backgroundColor: "#C17A45",
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0, max: 5,
            ticks: { color: "#1f2430", stepSize: 1 },
            grid: { color: "rgba(31,36,48,0.08)" },
          },
          x: {
            ticks: { color: "#1f2430", font: { size: 10 } },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: "end", align: "top",
            color: "#1f2430",
            font: { weight: "700", size: 11 },
            formatter: (value) => (value > 0 ? value.toFixed(1) : ""),
          },
        },
      },
    });
  } catch (err) {
    console.error("Charts error:", err);
  }
}

// Safe wrappers — no-op if elements don't exist on current page
async function safeRenderCharts() {
  if (document.getElementById("categoryChart")) await renderCharts();
}
async function safeRenderAnalyticsTable() {
  if (document.getElementById("analyticsTableBody")) await renderAnalyticsTable();
}

async function renderAnalyticsTable() {
  const tbody = document.getElementById("analyticsTableBody");
  if (!tbody) return;

  setLoadingRow("analyticsTableBody", 5);

  try {
    const analytics = await adminFetch("/admin/analytics");
    if (!analytics?.breakdown?.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-4">No heritage sites yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = analytics.breakdown
      .map(
        (row) => `
      <tr>
        <td class="fw-semibold">${row.category}</td>
        <td class="text-end">${row.sites}</td>
        <td class="text-end">${row.verified} / ${row.sites}</td>
        <td class="text-end"><i class="bi bi-star-fill text-warning"></i> ${row.avgRating.toFixed(1)}</td>
        <td class="text-end">${row.totalReviews.toLocaleString()}</td>
      </tr>`
      )
      .join("");
  } catch (err) {
    setErrorRow("analyticsTableBody", "Failed to load analytics: " + err.message, 5);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SIDEBAR  (mobile)
───────────────────────────────────────────────────────────────────────────── */
function wireSidebar() {
  const sidebar = document.getElementById("adminSidebar");
  const toggleBtn = document.getElementById("sidebarToggle");
  const closeBtn = document.getElementById("sidebarCloseBtn");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar || !toggleBtn) return;

  const open = () => {
    sidebar.classList.add("open");
    backdrop?.classList.add("show");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    sidebar.classList.remove("open");
    backdrop?.classList.remove("show");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  toggleBtn.addEventListener("click", () =>
    sidebar.classList.contains("open") ? close() : open()
  );
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  sidebar.querySelectorAll(".admin-nav-link, .sidebar-footer button").forEach((el) =>
    el.addEventListener("click", close)
  );
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  window.addEventListener("resize", () => { if (window.innerWidth >= 992) close(); });
}

/* ─────────────────────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  wireSidebar();
  wireSitesPage();

  // Load everything in parallel for speed
  await Promise.allSettled([
    renderStats(),
    renderSitesTable(),
    renderPendingReviews(),
    safeRenderCharts(),
    safeRenderAnalyticsTable(),
  ]);

  document.getElementById("logoutBtn")?.addEventListener("click", () => logoutAdmin());
});