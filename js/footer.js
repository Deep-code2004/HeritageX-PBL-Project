/* Shared footer, injected into #siteFooter on every page */
document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("siteFooter");
    if (!el) return;
    el.innerHTML = `
    <div class="container">
      <div class="row g-4">
        <div class="col-lg-4">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="brand-mark" style="background:var(--gold);"><i class="bi bi-bank2" aria-hidden="true"></i></span>
            <span class="display-font" style="color:#fff;font-size:1.3rem;">HeritageX</span>
          </div>
          <p class="small mb-3" style="opacity:0.85;">Discover. Experience. Preserve.<br>A digital tourism &amp; cultural heritage prototype for Ahmedabad, India's first World Heritage City.</p>
          <span class="verified-badge" style="background:rgba(248,243,232,0.12); color:var(--sandstone-tint);"><i class="bi bi-patch-check-fill"></i> Verified Heritage Information</span>
        </div>
        <div class="col-6 col-lg-2">
          <h6>Discover</h6>
          <ul class="list-unstyled small">
            <li class="mb-2"><a href="explore.html">Explore</a></li>
            <li class="mb-2"><a href="map.html">Map</a></li>
            <li class="mb-2"><a href="heritage-walks.html">Heritage Walks</a></li>
            <li class="mb-2"><a href="recommendations.html">Smart Recommendations</a></li>
          </ul>
        </div>
        <div class="col-6 col-lg-2">
          <h6>Learn</h6>
          <ul class="list-unstyled small">
            <li class="mb-2"><a href="culture.html">Culture</a></li>
            <li class="mb-2"><a href="about.html">About Ahmedabad</a></li>
            <li class="mb-2"><a href="responsible-tourism.html">Responsible Tourism</a></li>
          </ul>
        </div>
        <div class="col-6 col-lg-2">
          <h6>Plan</h6>
          <ul class="list-unstyled small">
            <li class="mb-2"><a href="itinerary.html">Plan Trip</a></li>
            <li class="mb-2"><a href="saved.html">Saved Places</a></li>
          </ul>
        </div>
        <div class="col-6 col-lg-2">
          <h6>Project</h6>
          <ul class="list-unstyled small">
            <li class="mb-2">B.Tech CE — Silver Oak University</li>
            <li class="mb-2">SDG 8 · SDG 11 · SDG 12</li>
            <li class="mb-2">Viksit Bharat @2047</li>
          </ul>
        </div>
      </div>
      <hr style="border-color:rgba(248,243,232,0.15); margin:2rem 0 1.25rem;">
      <div class="d-flex flex-wrap justify-content-between small" style="opacity:0.75;">
        <span>&copy; <span class="current-year"></span> HeritageX — B.Tech Computer Engineering PBL prototype. Not an official tourism service.</span>
        <span>Built for Smart Tourism &amp; Cultural Heritage Preservation, Viksit Bharat @2047</span>
      </div>
    </div>`;
});