// ============================================================================
// Smitten — confirmation page ("It's a date")
// Loads the real invitation by token and builds real calendar/maps links.
// ============================================================================
(function () {
  const emojis = ["💛", "💕", "✨", "💌", "🎀"];
  const wrap = document.getElementById("confetti");
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("span");
    s.textContent = emojis[i % emojis.length];
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.transform = "rotate(" + (Math.random() * 40 - 20) + "deg)";
    wrap.appendChild(s);
  }

  function qs(name) { return new URLSearchParams(window.location.search).get(name); }

  function googleCalendarUrl(inv) {
    if (!inv.scheduled_date) return null;
    const [h, m] = (inv.scheduled_time || "19:00:00").split(":");
    const start = new Date(inv.scheduled_date);
    start.setHours(parseInt(h, 10) || 19, parseInt(m, 10) || 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2hr block
    const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: inv.title || "A date",
      dates: `${fmt(start)}/${fmt(end)}`,
      location: inv.venue_name || "",
      details: `Planned via Smitten${inv.creator_display_name ? " by " + inv.creator_display_name : ""}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function mapsUrl(inv) {
    if (inv.venue_map_url) return inv.venue_map_url;
    const q = [inv.venue_name, inv.venue_address].filter(Boolean).join(", ");
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  async function load() {
    const token = qs("t");
    const body = document.getElementById("conf-body");
    if (!token) { body.innerHTML = `<p style="color:var(--ink-soft);">Missing link details.</p>`; return; }
    try {
      const inv = await API.getInvitationByToken(token);
      if (!inv || inv.revoked || inv.expired) {
        body.innerHTML = `<p style="color:var(--ink-soft);">This note is no longer available.</p>`;
        return;
      }
      const details = [];
      if (inv.scheduled_date) {
        const d = new Date(inv.scheduled_date);
        details.push(`📅 ${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${inv.scheduled_time ? " · " + UI.fmtTime(inv.scheduled_time) : ""}`);
      }
      if (inv.venue_name) details.push(`📍 ${UI.esc(inv.venue_name)}`);
      if (inv.dress_code) details.push(`👗 ${UI.esc(inv.dress_code)}`);

      const cal = googleCalendarUrl(inv);
      const maps = mapsUrl(inv);

      body.innerHTML = `
        <div class="names">${UI.esc(inv.recipient_name || "You")} × ${UI.esc(inv.creator_display_name || inv.creator_full_name || "")}</div>
        <ul class="details">${details.map((d) => `<li>${d}</li>`).join("") || "<li>Details to follow.</li>"}</ul>
        <div class="btn-row">
          ${cal ? `<a href="${cal}" target="_blank" rel="noopener" class="pill-btn pink">＋ Add to calendar</a>` : ""}
          ${maps ? `<a href="${maps}" target="_blank" rel="noopener" class="pill-btn">🗺 Open maps</a>` : ""}
        </div>`;
    } catch (err) {
      body.innerHTML = `<p style="color:#C92A2A;">${UI.esc(UI.friendlyError(err))}</p>`;
    }
  }
  load();
})();
