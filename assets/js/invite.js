// ============================================================================
// Smitten — recipient invite flow (anonymous, token-gated)
// Reads ?t=<public_token>, fetches real invitation data via the
// get_invitation_by_token RPC (see schema), and submits a real response via
// submit_invitation_response. No mock data, no localStorage.
// ============================================================================
(function () {
  function qs(name) { return new URLSearchParams(window.location.search).get(name); }
  const token = qs("t");
  const stage = document.getElementById("stagewrap");
  let invite = null;

  function sectionByKey(key) {
    return (invite.sections || []).find((s) => s.key === key);
  }

  function showStep(html) {
    stage.innerHTML = `<div class="step active">${html}</div>`;
  }

  function heartSvg(cls) {
    return `<svg class="${cls || "heart"}" viewBox="0 0 100 92"><use href="#d-heart"/></svg>`;
  }

  function renderError(title, body) {
    showStep(`${heartSvg()}<h1>${UI.esc(title)}</h1><p style="color:var(--ink-soft);font-size:14px;">${UI.esc(body)}</p>`);
  }

  function renderTeaser() {
    const dateSec = sectionByKey("date");
    const dateStr = invite.scheduled_date
      ? new Date(invite.scheduled_date).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, " · ")
      : "";
    showStep(`
      ${heartSvg()}
      ${dateStr ? `<div class="eyebrow">${dateStr}</div>` : ""}
      <h1>A private note,<br>just for you.</h1>
      <p class="for">for ${UI.esc(invite.recipient_name || "you")} 💌</p>
      <div class="tap-hint" id="tap-open">tap anywhere to open ✨</div>
    `);
    document.querySelector(".step").addEventListener("click", renderDetails);
  }

  function renderDetails() {
    const items = [];
    if (invite.scheduled_date) {
      const d = new Date(invite.scheduled_date);
      const dateFmt = d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      items.push(`📅 ${dateFmt}${invite.scheduled_time ? " · " + UI.fmtTime(invite.scheduled_time) : ""}`);
    }
    if (invite.venue_name) items.push(`📍 ${UI.esc(invite.venue_name)}`);
    const food = sectionByKey("food");
    if (food && food.content && food.content.question) items.push(`🍝 ${UI.esc(food.content.question)}`);
    if (invite.dress_code) items.push(`👗 ${UI.esc(invite.dress_code)}`);

    // Any Message / Love Letter section reads as free-form body text.
    const message = sectionByKey("message") || sectionByKey("love_letter");

    showStep(`
      <div class="eyebrow">from ${UI.esc(invite.creator_display_name || invite.creator_full_name || "someone")}</div>
      <h1>I have something<br>planned for you.</h1>
      ${message && message.content && message.content.body ? `<p style="color:var(--ink-soft);font-size:14px;margin-bottom:18px;">${UI.esc(message.content.body)}</p>` : ""}
      ${items.length ? `<div class="details-card"><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></div>` : ""}
      <button class="pill-btn pink" id="keep-reading-btn">Keep reading →</button>
    `);
    document.getElementById("keep-reading-btn").addEventListener("click", renderQuestion);
  }

  function renderQuestion() {
    if (invite.already_responded) {
      renderThankYou("You've already answered this one — thanks again!");
      return;
    }
    showStep(`
      <div class="eyebrow">one last thing</div>
      <h1>Will you join me?</h1>
      <div class="options">
        <button class="opt-btn yes" id="opt-yes">Yes, I'd love to 💛</button>
        <button class="opt-btn" id="opt-maybe">Maybe</button>
        <button class="opt-btn" id="opt-no">No, not this time</button>
      </div>
    `);
    document.getElementById("opt-yes").addEventListener("click", () => respond("yes"));
    document.getElementById("opt-maybe").addEventListener("click", () => respond("maybe"));
    document.getElementById("opt-no").addEventListener("click", () => respond("no"));
  }

  async function respond(choice) {
    document.querySelectorAll(".opt-btn").forEach((b) => (b.disabled = true));
    try {
      await API.submitInvitationResponse(token, choice, []);
      if (choice === "yes") {
        window.location.href = `confirmation.html?t=${encodeURIComponent(token)}`;
      } else {
        renderThankYou("Aniket will get your answer right away.".replace("Aniket", invite.creator_display_name || invite.creator_full_name || "They"));
      }
    } catch (err) {
      UI.toast(UI.friendlyError(err), "error");
      document.querySelectorAll(".opt-btn").forEach((b) => (b.disabled = false));
    }
  }

  function renderThankYou(sub) {
    showStep(`${heartSvg()}<h1>Thanks for<br>letting me know.</h1><p style="color:var(--ink-soft);font-size:14px;">${UI.esc(sub)}</p>`);
  }

  async function init() {
    if (!token) {
      renderError("This link isn't valid.", "Double-check the link you were sent.");
      return;
    }
    try {
      invite = await API.getInvitationByToken(token);
    } catch (err) {
      renderError("Something went wrong.", UI.friendlyError(err));
      return;
    }
    if (!invite) {
      renderError("This note isn't available.", "It may not have been sent yet, or the link is incorrect.");
      return;
    }
    if (invite.revoked) {
      renderError("This note was revoked.", "Reach out to the sender if you think that's a mistake.");
      return;
    }
    if (invite.expired) {
      renderError("This note has expired.", "Reach out to the sender for a fresh link.");
      return;
    }
    document.title = `A private note from ${invite.creator_display_name || invite.creator_full_name || "someone"} — Smitten`;
    renderTeaser();
  }

  init();
})();
