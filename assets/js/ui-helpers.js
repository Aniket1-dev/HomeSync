// ============================================================================
// Smitten — tiny shared UI helpers (formatting + loading/error/empty states)
// ============================================================================
const UI = (() => {
  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
  }

  function fmtDate(d) {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date)) return "";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtDateShort(d) {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date)) return "";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function fmtTime(t) {
    // t is a Postgres "time" string like "19:30:00"
    if (!t) return "";
    const [h, m] = t.split(":");
    const hh = parseInt(h, 10);
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${m} ${ampm}`;
  }

  function fmtRelative(d) {
    if (!d) return "";
    const date = new Date(d);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return fmtDate(d);
  }

  function fmtMoney(cents, currency = "INR") {
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
    return symbol + (Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function loadingRow(colspan, label = "Loading…") {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:36px;color:var(--ink-soft);">⏳ ${esc(label)}</td></tr>`;
  }

  function errorRow(colspan, message) {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:36px;color:#C92A2A;">⚠️ ${esc(message)}</td></tr>`;
  }

  function emptyRow(colspan, label) {
    return `<tr><td colspan="${colspan}" style="text-align:center;padding:36px;color:var(--ink-soft);">${esc(label)}</td></tr>`;
  }

  function loadingBlock(label = "Loading…") {
    return `<div style="text-align:center;padding:60px 20px;color:var(--ink-soft);">⏳ ${esc(label)}</div>`;
  }

  function errorBlock(message, retryFn) {
    const id = "err-retry-" + Math.random().toString(36).slice(2);
    setTimeout(() => {
      const btn = document.getElementById(id);
      if (btn && retryFn) btn.addEventListener("click", retryFn);
    }, 0);
    return `<div style="text-align:center;padding:60px 20px;color:#C92A2A;">
      ⚠️ ${esc(message)}
      ${retryFn ? `<div style="margin-top:12px;"><button id="${id}" class="pill-btn ghost" type="button">Try again</button></div>` : ""}
    </div>`;
  }

  function emptyBlock(title, subtitle) {
    return `<div style="text-align:center;padding:60px 20px;color:var(--ink-soft);">
      <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:4px;">${esc(title)}</div>
      ${subtitle ? `<div style="font-size:13px;">${esc(subtitle)}</div>` : ""}
    </div>`;
  }

  function friendlyError(err) {
    if (!err) return "Something went wrong.";
    if (typeof err === "string") return err;
    return err.message || "Something went wrong.";
  }

  function toast(message, kind = "info") {
    const el = document.createElement("div");
    el.textContent = message;
    const bg = kind === "error" ? "#ffe3e3" : kind === "success" ? "#e3fff0" : "#fff7e3";
    const fg = kind === "error" ? "#7a1f1f" : kind === "success" ? "#1F8E68" : "#7a5c1f";
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;
      background:${bg};color:${fg};font:600 13px/1.4 Quicksand,system-ui,sans-serif;padding:12px 22px;
      border-radius:100px;border:2px solid ${fg}33;box-shadow:0 6px 20px rgba(0,0,0,.12);max-width:90vw;text-align:center;`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .4s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }, 2600);
  }

  return { esc, initials, fmtDate, fmtDateShort, fmtTime, fmtRelative, fmtMoney,
    loadingRow, errorRow, emptyRow, loadingBlock, errorBlock, emptyBlock, friendlyError, toast };
})();
