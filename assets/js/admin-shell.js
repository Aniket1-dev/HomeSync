// ============================================================================
// Smitten — shared admin chrome: reflects the signed-in admin's real role
// (not a hardcoded "Super Admin") in the sidebar badge on every /admin page.
// ============================================================================
(function () {
  const ROLE_LABEL = {
    super_admin: "✦ Super Admin · Full Access",
    content_admin: "✦ Content Admin",
    support_admin: "✦ Support Admin",
    finance_admin: "✦ Finance Admin",
    moderator: "✦ Moderator",
  };

  async function paintBadge() {
    const badge = document.querySelector(".god-badge");
    try {
      const session = await AUTH.getSession();
      if (!session) return;
      const { data } = await sb.from("admin_users").select("role").eq("user_id", session.user.id).maybeSingle();
      if (badge) badge.textContent = (data && ROLE_LABEL[data.role]) || "✦ Admin";
    } catch (_) {
      // requireAdmin() already gates the page; a failure here is cosmetic only.
    }
  }
  paintBadge();
})();
