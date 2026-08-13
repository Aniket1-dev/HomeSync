// ============================================================================
// Smitten — Studio (the invitation builder)
// Fully wired to Supabase: loads a real invitation + its sections, edits
// persist to invitation_sections.content, and Publish flips invitations.status.
// ============================================================================
(function () {
  let invitation = null;
  let sections = []; // invitation_sections rows, each with .section_definitions
  let allSectionDefs = [];
  let selectedId = null;

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function setSaveIndicator(text) {
    const el = document.getElementById("save-indicator");
    el.textContent = text;
    if (text === "Saved") setTimeout(() => { if (el.textContent === "Saved") el.textContent = ""; }, 1500);
  }

  // ---- rendering ------------------------------------------------------------
  function renderSectionsList() {
    const el = document.getElementById("sections-list");
    if (!sections.length) {
      el.innerHTML = `<div style="padding:16px 4px;font-size:12.5px;color:var(--ink-soft);">No sections yet — add one below.</div>`;
      return;
    }
    el.innerHTML = sections.map((s, i) => `
      <div class="sec-item ${s.id === selectedId ? "active" : ""} ${s.visible ? "" : "hidden-sec"}" data-id="${s.id}">
        <span class="drag" data-up="${i}" title="Move up (shift-click to move down)" style="cursor:pointer;">⠿</span>
        <span class="name">${UI.esc(s.section_definitions.label)}</span>
        <span class="icn" data-toggle="${s.id}" title="${s.visible ? "Hide" : "Show"}">${s.visible ? "👁" : "🚫"}</span>
        <span class="icn" data-remove="${s.id}" title="Remove">✕</span>
      </div>`).join("");

    el.querySelectorAll(".sec-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest("[data-toggle],[data-remove],[data-up]")) return;
        selectSection(item.dataset.id);
      });
    });
    el.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); toggleVisible(btn.dataset.toggle); })
    );
    el.querySelectorAll("[data-remove]").forEach((btn) =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); removeSection(btn.dataset.remove); })
    );
    el.querySelectorAll("[data-up]").forEach((btn) =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); nudgeSection(parseInt(btn.dataset.up, 10), e.shiftKey ? 1 : -1); })
    );
  }

  function fmtContentPreview(key, content) {
    content = content || {};
    switch (key) {
      case "hero": return `<h2>${UI.esc(content.title || "Untitled note")}</h2><p>${UI.esc(content.subtitle || "")}</p>`;
      case "photo": return `<div class="ph">${content.image ? `<img src="${UI.esc(content.image)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : `<svg viewBox="0 0 100 92" style="width:40px;height:40px;stroke:var(--pink);stroke-width:5;fill:var(--card);"><use href="#d-heart"/></svg>`}</div>`;
      case "gallery": return `<p>${(content.images || []).length} photo(s)</p>`;
      case "message": case "love_letter": return `<p>${UI.esc(content.body || "Write your message…")}</p>`;
      case "date": return `<p>${content.date ? UI.fmtDate(content.date) : "Pick a date"}${content.time ? " · " + UI.fmtTime(content.time) : ""}</p>`;
      case "venue": return `<p>📍 ${UI.esc(content.venue || "Add a venue")}</p>`;
      case "food": return `<p>🍝 ${UI.esc(content.question || "Add a question")}</p><div class="opts">${(content.options || []).map(o => `<span>${UI.esc(o)}</span>`).join("")}</div>`;
      case "activity": return `<div class="opts">${(content.options || []).map(o => `<span>${UI.esc(o)}</span>`).join("") || "<span>No options yet</span>"}</div>`;
      case "question": return `<p>${UI.esc(content.prompt || "Ask something")}</p><div class="opts">${(content.options || []).map(o => `<span>${UI.esc(o)}</span>`).join("")}</div>`;
      case "countdown": return `<p>⏳ Counting down to ${content.target_datetime ? new Date(content.target_datetime).toLocaleString() : "…"}</p>`;
      case "bouquet": return `<p>💐 ${UI.esc(content.bouquet_type || "Choose a bouquet")}</p>`;
      case "card": return `<p>💌 ${UI.esc(content.message || "Write a card message")}</p>`;
      case "reveal": return `<p>✨ ${(content.steps || []).length} reveal step(s)</p>`;
      case "final_response": return `<h3>Will you join me?</h3><div class="yn"><span>Yes, I'd love to</span><span>Maybe</span><span>No</span></div>`;
      default: return `<p>${UI.esc(JSON.stringify(content))}</p>`;
    }
  }

  function renderCanvas() {
    const canvas = document.getElementById("canvas");
    const visible = sections.filter((s) => s.visible);
    if (!visible.length) {
      canvas.innerHTML = `<div style="padding:60px 20px;text-align:center;color:var(--ink-soft);">No visible sections — add or unhide one from the left panel.</div>`;
      return;
    }
    canvas.innerHTML = visible.map((s) => `
      <div class="cv-block ${s.id === selectedId ? "active" : ""}" data-id="${s.id}">
        <div class="lbl">${UI.esc(s.section_definitions.label)}</div>
        ${fmtContentPreview(s.section_definitions.key, s.content)}
      </div>`).join("");
    canvas.querySelectorAll(".cv-block").forEach((b) =>
      b.addEventListener("click", () => selectSection(b.dataset.id))
    );
  }

  const FIELD_TYPE = {
    date: "date", time: "time", target_datetime: "datetime-local",
    body: "textarea", subtitle: "textarea", message: "textarea",
    alignment: "select:Left,Center,Right",
    animation: "select:Fade up,Blur to focus,Scale in,None",
    type: "select:single,multiple,text",
    options: "list", images: "imagelist", steps: "list",
    image: "text", map_link: "text",
  };

  function renderProperties() {
    const titleEl = document.getElementById("prop-title");
    const fieldsEl = document.getElementById("prop-fields");
    const sec = sections.find((s) => s.id === selectedId);
    if (!sec) {
      titleEl.textContent = "Select a section";
      fieldsEl.innerHTML = "";
      return;
    }
    titleEl.textContent = sec.section_definitions.label;
    const fields = (sec.section_definitions.config_schema && sec.section_definitions.config_schema.fields) || [];
    const content = sec.content || {};

    fieldsEl.innerHTML = fields.map((f) => {
      const kind = FIELD_TYPE[f] || "text";
      const label = f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const val = content[f];
      if (kind === "textarea") {
        return `<div class="field"><label>${label}</label><textarea rows="3" data-field="${f}">${UI.esc(val || "")}</textarea></div>`;
      }
      if (kind.startsWith("select:")) {
        const opts = kind.split(":")[1].split(",");
        return `<div class="field"><label>${label}</label><select data-field="${f}">${opts.map(o => `<option ${val === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
      }
      if (kind === "list") {
        return `<div class="field"><label>${label} <span class="opt">comma-separated</span></label><input type="text" data-field="${f}" data-list="1" value="${UI.esc((val || []).join(", "))}"></div>`;
      }
      if (kind === "imagelist") {
        return `<div class="field"><label>${label} <span class="opt">image URLs, comma-separated</span></label><input type="text" data-field="${f}" data-list="1" value="${UI.esc((val || []).join(", "))}"></div>`;
      }
      return `<div class="field"><label>${label}</label><input type="${kind}" data-field="${f}" value="${UI.esc(val || "")}"></div>`;
    }).join("") || `<div style="font-size:12.5px;color:var(--ink-soft);">This section type has no editable fields yet.</div>`;

    fieldsEl.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", () => onFieldChange(sec, input));
    });
  }

  function render() {
    renderSectionsList();
    renderCanvas();
    renderProperties();
  }

  // ---- mutation handlers -----------------------------------------------------
  async function onFieldChange(sec, input) {
    const field = input.dataset.field;
    let value = input.value;
    if (input.dataset.list) value = value.split(",").map((s) => s.trim()).filter(Boolean);
    const newContent = { ...(sec.content || {}), [field]: value };
    sec.content = newContent;
    setSaveIndicator("Saving…");
    try {
      await API.updateInvitationSection(sec.id, { content: newContent });
      const key = sec.section_definitions.key;
      if (key === "date" && (field === "date" || field === "time")) {
        await API.updateInvitation(invitation.id, {
          scheduled_date: newContent.date || null,
          scheduled_time: newContent.time || null,
        });
      }
      if (key === "venue" && ["venue", "address", "map_link"].includes(field)) {
        await API.updateInvitation(invitation.id, {
          venue_name: newContent.venue || null,
          venue_address: newContent.address || null,
          venue_map_url: newContent.map_link || null,
        });
      }
      setSaveIndicator("Saved");
    } catch (err) {
      setSaveIndicator("");
      UI.toast(UI.friendlyError(err), "error");
    }
    renderCanvas();
  }

  function selectSection(id) {
    selectedId = id;
    render();
  }

  async function toggleVisible(id) {
    const sec = sections.find((s) => s.id === id);
    if (!sec) return;
    sec.visible = !sec.visible;
    render();
    try {
      await API.updateInvitationSection(id, { visible: sec.visible });
    } catch (err) {
      UI.toast(UI.friendlyError(err), "error");
    }
  }

  async function removeSection(id) {
    if (!confirm("Remove this section? This can't be undone.")) return;
    try {
      await API.deleteInvitationSection(id);
      sections = sections.filter((s) => s.id !== id);
      if (selectedId === id) selectedId = sections[0]?.id || null;
      render();
      UI.toast("Section removed", "success");
    } catch (err) {
      UI.toast(UI.friendlyError(err), "error");
    }
  }

  async function nudgeSection(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    render();
    try {
      await API.reorderInvitationSections(sections.map((s) => s.id));
    } catch (err) {
      UI.toast(UI.friendlyError(err), "error");
    }
  }

  function renderAddSectionMenu() {
    const menu = document.getElementById("add-section-menu");
    const usedDefIds = new Set(sections.map((s) => s.section_definitions.id));
    const available = allSectionDefs.filter((d) => !usedDefIds.has(d.id));
    if (!available.length) {
      menu.innerHTML = `<div style="padding:14px;font-size:12.5px;color:var(--ink-soft);">All section types are already in this note.</div>`;
      return;
    }
    menu.innerHTML = available.map((d) =>
      `<div class="sec-item" data-add="${d.id}" style="cursor:pointer;"><span class="name">${UI.esc(d.label)}</span></div>`
    ).join("");
    menu.querySelectorAll("[data-add]").forEach((item) =>
      item.addEventListener("click", () => addSection(item.dataset.add))
    );
  }

  async function addSection(defId) {
    document.getElementById("add-section-menu").style.display = "none";
    try {
      const order = sections.length;
      const newSec = await API.addInvitationSection(invitation.id, defId, order);
      sections.push(newSec);
      selectedId = newSec.id;
      render();
    } catch (err) {
      UI.toast(UI.friendlyError(err), "error");
    }
  }

  // ---- top-level actions -----------------------------------------------------
  async function saveTitleAndRecipient() {
    const title = document.getElementById("note-title-input").value.trim() || "Untitled note";
    const recipient_name = document.getElementById("recipient-name").value.trim() || null;
    const recipient_email = document.getElementById("recipient-email").value.trim() || null;
    setSaveIndicator("Saving…");
    try {
      invitation = await API.updateInvitation(invitation.id, { title, recipient_name, recipient_email });
      setSaveIndicator("Saved");
    } catch (err) {
      setSaveIndicator("");
      UI.toast(UI.friendlyError(err), "error");
    }
  }

  async function publish() {
    if (!document.getElementById("recipient-name").value.trim()) {
      UI.toast("Add a recipient name before publishing.", "error");
      document.getElementById("recipient-name").focus();
      return;
    }
    await saveTitleAndRecipient();
    const btn = document.getElementById("btn-publish");
    const original = btn.textContent;
    btn.textContent = "Publishing…";
    btn.disabled = true;
    try {
      invitation = await API.publishInvitation(invitation.id);
      const link = API.inviteUrl(invitation.public_token);
      try { await navigator.clipboard.writeText(link); } catch (_) {}
      alert(`Published! 🎉\n\nYour private link (copied to clipboard):\n${link}\n\nSend this to ${invitation.recipient_name}.`);
      window.location.href = "invitations.html";
    } catch (err) {
      UI.toast(UI.friendlyError(err), "error");
      btn.textContent = original;
      btn.disabled = false;
    }
  }

  // ---- init -------------------------------------------------------------------
  async function init() {
    const id = qs("id");
    if (!id) {
      window.location.href = "templates.html";
      return;
    }
    try {
      const [inv, secs, defs] = await Promise.all([
        API.getMyInvitation(id),
        API.getMyInvitationSections(id),
        API.listSectionDefinitions(),
      ]);
      if (!inv) {
        document.querySelector(".studio").innerHTML = UI.errorBlock("This note doesn't exist or isn't yours.");
        return;
      }
      invitation = inv;
      sections = secs;
      allSectionDefs = defs;
      selectedId = sections[0]?.id || null;

      document.getElementById("note-title-input").value = inv.title || "Untitled note";
      document.getElementById("recipient-name").value = inv.recipient_name || "";
      document.getElementById("recipient-email").value = inv.recipient_email || "";
      document.getElementById("btn-preview").href = `invite-preview.html?id=${inv.id}`;

      render();
      renderAddSectionMenu();
    } catch (err) {
      document.querySelector(".studio").innerHTML = UI.errorBlock(UI.friendlyError(err), init);
    }
  }

  document.getElementById("note-title-input").addEventListener("blur", saveTitleAndRecipient);
  document.getElementById("recipient-name").addEventListener("blur", saveTitleAndRecipient);
  document.getElementById("recipient-email").addEventListener("blur", saveTitleAndRecipient);
  document.getElementById("btn-save-draft").addEventListener("click", async () => {
    await saveTitleAndRecipient();
    UI.toast("Draft saved", "success");
  });
  document.getElementById("btn-publish").addEventListener("click", publish);
  document.getElementById("btn-add-section").addEventListener("click", () => {
    const menu = document.getElementById("add-section-menu");
    const showing = menu.style.display !== "none";
    if (!showing) renderAddSectionMenu();
    menu.style.display = showing ? "none" : "block";
  });

  init();
})();
