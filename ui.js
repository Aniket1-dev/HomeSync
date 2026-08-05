// Shared UI helpers used across pages

/**
 * Renders the "Sync Dial" — the app's signature visual: a circular
 * progress ring representing a compatibility score, drawn as inline SVG
 * so it can be dropped anywhere (hero, dashboard, match cards).
 */
function renderSyncDial(container, score, { size = 220, label = "Compatibility" } = {}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color =
    clamped >= 75 ? "var(--sage)" : clamped >= 50 ? "var(--gold)" : "var(--danger)";

  container.style.setProperty("--dial-size", size + "px");
  container.classList.add("sync-dial");
  container.innerHTML = `
    <svg viewBox="0 0 100 100">
      <circle class="sync-dial-ring-bg" cx="50" cy="50" r="${radius}"></circle>
      <circle class="sync-dial-ring" cx="50" cy="50" r="${radius}"
        stroke="${color}"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${circumference}"></circle>
    </svg>
    <div class="sync-dial-center">
      <div class="sync-dial-score">${Math.round(clamped)}%</div>
      <div class="sync-dial-label">${label}</div>
    </div>
  `;
  // animate on next frame
  requestAnimationFrame(() => {
    const ring = container.querySelector(".sync-dial-ring");
    ring.style.strokeDashoffset = offset;
  });
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function avatarColor(seed) {
  const palette = ["#7A2E4A", "#55764F", "#C9973B", "#5E2038"];
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return palette[hash % palette.length];
}

function showMsg(el, text, type = "error") {
  el.textContent = text;
  el.className = `msg msg-${type === "error" ? "error" : "ok"}`;
  el.classList.remove("hidden");
}

function hideMsg(el) {
  el.classList.add("hidden");
}

function setLoading(btn, loading, labelWhenIdle) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Working...`
    : labelWhenIdle;
}
