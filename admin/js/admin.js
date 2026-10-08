/* =========================================================================
   HeritageX — admin.js
   Split across dashboard.html / sites.html / reviews.html / analytics.html.
   Fully wired to the PostgreSQL backend API while maintaining 100% of the
   existing DOM element IDs, classes, and UI structures.
   ========================================================================= */

const ADMIN_API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "/api";

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
      window.location.href = "login.html";
    }
    throw new Error(json?.error?.message || `Request failed with status ${res.status}`);
  }
  return json.data;
}

// In-memory cache of currently loaded admin sites for modals
let cachedAdminSites = [];

/* ---------- Stats (rendered on every admin page that has the stat cards) ---------- */
async function renderStats() {
  const totalEl = document.getElementById("statTotal");
  if (!totalEl) return;

  try {
    const data = await adminFetch("/admin/analytics");
    if (!data || !data.stats) return;

    totalEl.textContent = data.stats.total;
    const verifiedEl = document.getElementById("statVerified");
    if (verifiedEl) verifiedEl.textContent = data.stats.verified;

    const catsEl = document.getElementById("statCategories");
    if (catsEl) catsEl.textContent = data.stats.categories;

    const pendingEl = document.getElementById("statPending");
    if (pendingEl) pendingEl.textContent = data.stats.pending;
  } catch (e) {
    console.warn("Unable to fetch admin stats:", e);
  }
}

/* ---------- Sites management (sites.html only) ---------- */
async function renderSitesTable() {
  const tbody = document.getElementById("sitesTableBody");
  if (!tbody) return;

  try {
    const sites = await adminFetch("/admin/heritage?limit=100");
    cachedAdminSites = sites || [];

    tbody.innerHTML = cachedAdminSites
      .map(
        (s) => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          <img src="${s.image}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
          <div>
            <div class="fw-semibold">${s.name}</div>
            <div class="small text-secondary">${s.duration}</div>
          </div>
        </div>
      </td>
      <td><span class="badge bg-light text-dark border">${s.categoryName || s.category?.name}</span></td>
      <td><i class="bi bi-star-fill text-warning"></i> ${(s.rating || 0).toFixed(1)} <span class="small text-secondary">(${s.reviewCount || 0})</span></td>
      <td>
        ${
          s.verified
            ? `<span class="badge bg-success-subtle text-success-emphasis"><i class="bi bi-patch-check me-1"></i>Verified</span>`
            : `<span class="badge bg-warning-subtle text-warning-emphasis"><i class="bi bi-clock me-1"></i>Pending</span>`
        }
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary edit-site-btn me-1" data-id="${s.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger delete-site-btn" data-id="${s.id}"><i class="bi bi-trash"></i></button>
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
    console.error("Error loading sites table:", e);
  }
}

async function populateCategorySelect() {
  const sel = document.getElementById("siteFormCategory");
  if (!sel) return;
  try {
    const categories = await adminFetch("/categories");
    sel.innerHTML = categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");
  } catch {
    const fallbackCats = [
      "Historical Monuments",
      "Sultanate Heritage",
      "Religious Heritage",
      "Pols & Havelis",
      "Museums",
      "Markets",
      "Living Heritage",
    ];
    sel.innerHTML = fallbackCats.map((c) => `<option value="${c}">${c}</option>`).join("");
  }
}

async function openSiteModal(id) {
  await populateCategorySelect();
  const modalTitle = document.getElementById("siteModalLabel");
  const form = document.getElementById("siteForm");
  if (!form) return;
  form.reset();

  if (id) {
    const site = cachedAdminSites.find((s) => s.id === id);
    if (!site) return;
    modalTitle.textContent = "Edit Heritage Site";
    document.getElementById("siteFormId").value = site.id;
    document.getElementById("siteFormName").value = site.name;
    document.getElementById("siteFormCategory").value = site.categoryName || site.category?.name;
    document.getElementById("siteFormDesc").value = site.shortDescription;
    document.getElementById("siteFormVerified").value = String(site.verified);
  } else {
    modalTitle.textContent = "Add Heritage Site";
    document.getElementById("siteFormId").value = "";
    document.getElementById("siteFormVerified").value = "true";
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById("siteModal")).show();
}

async function deleteSite(id) {
  const site = cachedAdminSites.find((s) => s.id === id);
  if (!site) return;
  if (!confirm(`Delete "${site.name}" from database?`)) return;

  try {
    await adminFetch(`/admin/heritage/${id}`, { method: "DELETE" });
    if (typeof showToast === "function") {
      showToast("Site removed", "bi-trash", site.name);
    }
    await renderStats();
    await renderSitesTable();
    await renderCharts();
    await renderAnalyticsTable();
  } catch (err) {
    alert("Error deleting site: " + err.message);
  }
}

function wireSitesPage() {
  const addBtn = document.getElementById("addSiteBtn");
  if (!addBtn) return;

  addBtn.addEventListener("click", () => openSiteModal(null));

  const form = document.getElementById("siteForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idVal = document.getElementById("siteFormId").value;
    const name = document.getElementById("siteFormName").value.trim();
    const category = document.getElementById("siteFormCategory").value;
    const shortDescription = document.getElementById("siteFormDesc").value.trim();
    const verified = document.getElementById("siteFormVerified").value === "true";

    const payload = { name, category, shortDescription, verified };

    try {
      if (idVal) {
        await adminFetch(`/admin/heritage/${idVal}`, {
          method: "PUT",
          body: payload,
        });
        if (typeof showToast === "function") {
          showToast("Site updated", "bi-check-circle-fill", name);
        }
      } else {
        await adminFetch("/admin/heritage", {
          method: "POST",
          body: payload,
        });
        if (typeof showToast === "function") {
          showToast("Site added", "bi-plus-circle-fill", name);
        }
      }

      bootstrap.Modal.getInstance(document.getElementById("siteModal")).hide();
      await renderStats();
      await renderSitesTable();
      await renderCharts();
      await renderAnalyticsTable();
    } catch (err) {
      alert("Error saving site: " + err.message);
    }
  });
}

/* ---------- Review moderation (reviews.html only) ---------- */
async function renderPendingReviews() {
  const list = document.getElementById("pendingReviewsList");
  if (!list) return;

  const emptyEl = document.getElementById("noPendingReviews");

  try {
    const reviews = await adminFetch("/admin/reviews?status=PENDING");

    if (!reviews || !reviews.length) {
      list.innerHTML = "";
      emptyEl.classList.remove("d-none");
      return;
    }
    emptyEl.classList.add("d-none");

    list.innerHTML = reviews
      .map(
        (review) => `
    <div class="admin-panel-card p-3 mb-3">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong>${review.site?.name || "Heritage Site"}</strong>
          <span class="text-warning small ms-2">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
          <p class="small text-secondary mb-1 mt-1">${review.comment}</p>
          <span class="small text-secondary">By ${review.author} · ${new Date(review.createdAt).toISOString().slice(0, 10)}</span>
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="btn btn-sm btn-admin-primary approve-review-btn" data-id="${review.id}">Approve</button>
          <button class="btn btn-sm btn-outline-danger reject-review-btn" data-id="${review.id}">Reject</button>
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
    console.error("Error loading reviews:", err);
  }
}

async function moderateReview(id, action) {
  try {
    const status = action === "approve" ? "APPROVED" : "REJECTED";
    await adminFetch(`/admin/reviews/${id}`, {
      method: "PATCH",
      body: { status },
    });

    if (typeof showToast === "function") {
      showToast(
        action === "approve" ? "Review approved" : "Review rejected",
        action === "approve" ? "bi-check-circle-fill" : "bi-x-circle"
      );
    }

    await renderStats();
    await renderPendingReviews();
  } catch (err) {
    alert("Error moderating review: " + err.message);
  }
}

/* ---------- Analytics charts (analytics.html only) ---------- */
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
        datasets: [
          {
            data: categoryChart.data,
            backgroundColor: categoryChart.colors,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 11 }, color: "#1f2430" },
          },
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
        datasets: [
          {
            label: "Avg. rating",
            data: ratingChart.data,
            backgroundColor: "#C17A45",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 5,
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
            anchor: "end",
            align: "top",
            color: "#1f2430",
            font: { weight: "700", size: 11 },
            formatter: (value) => value.toFixed(1),
          },
        },
      },
    });
  } catch (err) {
    console.error("Error rendering charts:", err);
  }
}

/* ---------- Category breakdown table (analytics.html only) ---------- */
async function renderAnalyticsTable() {
  const tbody = document.getElementById("analyticsTableBody");
  if (!tbody) return;

  try {
    const analytics = await adminFetch("/admin/analytics");
    if (!analytics || !analytics.breakdown || !analytics.breakdown.length) {
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
    console.error("Error loading analytics table:", err);
  }
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
document.addEventListener("DOMContentLoaded", async () => {
  wireSidebar();
  await populateCategorySelect();
  wireSitesPage();
  await renderStats();
  await renderSitesTable();
  await renderPendingReviews();
  await renderCharts();
  await renderAnalyticsTable();

  document.getElementById("logoutBtn")?.addEventListener("click", () => logoutAdmin());
});