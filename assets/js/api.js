// ============================================================================
// Smitten — Data layer
// Loaded after auth.js. Every real read/write in the app goes through here —
// no page should touch window.sb directly. Every function returns real data
// from Postgres (via supabase-js) or throws; callers handle loading/error UI.
// ============================================================================
const API = (() => {
  function client() {
    if (!window.sb) throw new Error("Supabase client not initialized");
    return window.sb;
  }

  // ---- profile -------------------------------------------------------------
  async function getMyProfile() {
    const user = await AUTH.getUser();
    if (!user) return null;
    const { data, error } = await client()
      .from("profiles")
      .select("*, users:user_id(email, mobile, email_verified, mobile_verified, status, created_at)")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function upsertMyProfile(fields) {
    const user = await AUTH.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await client()
      .from("profiles")
      .upsert({ user_id: user.id, ...fields }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateMySettings(patch) {
    const profile = await getMyProfile();
    const merged = { ...(profile?.settings || {}), ...patch };
    return upsertMyProfile({ settings: merged, full_name: profile?.full_name || "" });
  }

  async function deleteMyAccount() {
    const { error } = await client().rpc("delete_own_account");
    if (error) throw error;
  }

  // ---- dashboard / stats ----------------------------------------------------
  async function myInvitationStats() {
    const { data, error } = await client().rpc("my_invitation_stats");
    if (error) throw error;
    return data || { sent: 0, drafts: 0, opened: 0, pending: 0, accepted: 0, declined: 0, total: 0 };
  }

  // ---- templates --------------------------------------------------------
  async function listPublishedTemplates() {
    const { data, error } = await client()
      .from("templates")
      .select("id, name, slug, description, theme, is_published")
      .eq("is_published", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getTemplate(idOrSlug) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const q = client().from("templates").select("*").limit(1);
    const { data, error } = await (isUuid ? q.eq("id", idOrSlug) : q.eq("slug", idOrSlug));
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }

  async function getTemplateSections(templateId) {
    const { data, error } = await client()
      .from("template_sections")
      .select("id, order, visible, content, style, section_definitions:section_def_id(id, key, label, config_schema)")
      .eq("template_id", templateId)
      .order("order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function listSectionDefinitions() {
    const { data, error } = await client()
      .from("section_definitions")
      .select("*")
      .eq("is_active", true)
      .order("label", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ---- invitations (the creator's side) -------------------------------------
  async function listMyInvitations() {
    const user = await AUTH.getUser();
    const { data, error } = await client()
      .from("invitations")
      .select("*, templates:template_id(name, slug, theme)")
      .eq("creator_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getMyInvitation(id) {
    const { data, error } = await client()
      .from("invitations")
      .select("*, templates:template_id(name, slug, theme)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getMyInvitationSections(invitationId) {
    const { data, error } = await client()
      .from("invitation_sections")
      .select("*, section_definitions:section_def_id(id, key, label, config_schema)")
      .eq("invitation_id", invitationId)
      .order("order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Create a fresh draft invitation, optionally cloning a template's sections.
  async function createInvitation({ templateId = null, title = "Untitled note" } = {}) {
    const user = await AUTH.getUser();
    if (!user) throw new Error("Not signed in");
    const { data: inv, error } = await client()
      .from("invitations")
      .insert({ creator_id: user.id, template_id: templateId, title, status: "draft" })
      .select()
      .single();
    if (error) throw error;

    if (templateId) {
      const tplSections = await getTemplateSections(templateId);
      if (tplSections.length) {
        const rows = tplSections.map((s) => ({
          invitation_id: inv.id,
          section_def_id: s.section_definitions.id,
          order: s.order,
          visible: s.visible,
          content: s.content || {},
          style: s.style || {},
        }));
        const { error: secErr } = await client().from("invitation_sections").insert(rows);
        if (secErr) throw secErr;
      }
    }
    return inv;
  }

  async function updateInvitation(id, patch) {
    const { data, error } = await client()
      .from("invitations")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateInvitationSection(sectionId, patch) {
    const { data, error } = await client()
      .from("invitation_sections")
      .update(patch)
      .eq("id", sectionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function addInvitationSection(invitationId, sectionDefId, order) {
    const { data, error } = await client()
      .from("invitation_sections")
      .insert({ invitation_id: invitationId, section_def_id: sectionDefId, order, content: {} })
      .select("*, section_definitions:section_def_id(id, key, label, config_schema)")
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteInvitationSection(sectionId) {
    const { error } = await client().from("invitation_sections").delete().eq("id", sectionId);
    if (error) throw error;
  }

  async function reorderInvitationSections(orderedIds) {
    // orderedIds: array of section ids in their new display order
    const updates = orderedIds.map((id, idx) =>
      client().from("invitation_sections").update({ order: idx }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
  }

  async function publishInvitation(id) {
    return updateInvitation(id, { status: "sent", published_at: new Date().toISOString() });
  }

  async function deleteInvitation(id) {
    const { error } = await client().from("invitations").delete().eq("id", id);
    if (error) throw error;
  }

  function inviteUrl(publicToken) {
    return new URL(`invite.html?t=${encodeURIComponent(publicToken)}`, window.location.href).toString();
  }

  // ---- public invite flow (token-based, works for signed-out recipients) ----
  async function getInvitationByToken(token) {
    const { data, error } = await client().rpc("get_invitation_by_token", { p_token: token });
    if (error) throw error;
    return data;
  }

  async function submitInvitationResponse(token, choice, answers = []) {
    const { data, error } = await client().rpc("submit_invitation_response", {
      p_token: token,
      p_choice: choice,
      p_answers: answers,
    });
    if (error) throw error;
    return data;
  }

  // ---- notifications ----------------------------------------------------
  async function listMyNotifications() {
    const user = await AUTH.getUser();
    const { data, error } = await client()
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  async function markNotificationRead(id) {
    const { error } = await client()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  // ---- ADMIN ---------------------------------------------------------------
  const admin = {
    async stats() {
      const { data, error } = await client().rpc("admin_platform_stats");
      if (error) throw error;
      return data;
    },

    async listUsers({ search = "", page = 0, pageSize = 20 } = {}) {
      let q = client()
        .from("users")
        .select("id, email, mobile, status, created_at, profiles:profiles(full_name, display_name), admin_users(role)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (search) q = q.ilike("email", `%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },

    async setUserStatus(userId, status) {
      const { error } = await client().from("users").update({ status }).eq("id", userId);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: `set_status:${status}`, p_target_type: "user", p_target_id: userId,
        p_result: "success", p_metadata: {},
      });
    },

    async deleteUser(userId) {
      const { error } = await client().from("users").delete().eq("id", userId);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "delete_user", p_target_type: "user", p_target_id: userId,
        p_result: "success", p_metadata: {},
      });
    },

    async setUserRole(userId, role) {
      // role: one of admin_role enum, or null to revoke admin access
      if (role === null) {
        const { error } = await client().from("admin_users").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await client()
          .from("admin_users")
          .upsert({ user_id: userId, role }, { onConflict: "user_id" });
        if (error) throw error;
      }
      await client().rpc("admin_log_action", {
        p_action: role ? `grant_role:${role}` : "revoke_role", p_target_type: "user", p_target_id: userId,
        p_result: "success", p_metadata: {},
      });
    },

    async listInvitations({ page = 0, pageSize = 20, status = null } = {}) {
      let q = client()
        .from("invitations")
        .select("*, templates:template_id(name), creator:creator_id(email)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (status) q = q.eq("status", status);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },

    async revokeInvitation(id) {
      const { error } = await client()
        .from("invitations")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      const user = await AUTH.getUser();
      await client().from("invitations").update({ revoked_by: user.id }).eq("id", id);
      await client().rpc("admin_log_action", {
        p_action: "revoke_invitation", p_target_type: "invitation", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async regenerateInvitationToken(id) {
      const { data, error } = await client().rpc("admin_regenerate_invitation_token", { p_invitation_id: id });
      if (error) throw error;
      return data;
    },

    async listTemplates() {
      const { data, error } = await client()
        .from("templates")
        .select("*, template_sections(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async createTemplate(fields) {
      const { data, error } = await client().from("templates").insert(fields).select().single();
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "create_template", p_target_type: "template", p_target_id: data.id,
        p_result: "success", p_metadata: {},
      });
      return data;
    },

    async updateTemplate(id, patch) {
      const { data, error } = await client().from("templates").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "update_template", p_target_type: "template", p_target_id: id,
        p_result: "success", p_metadata: patch,
      });
      return data;
    },

    async deleteTemplate(id) {
      const { error } = await client().from("templates").delete().eq("id", id);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "delete_template", p_target_type: "template", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async listSectionDefinitions() {
      const { data, error } = await client()
        .from("section_definitions")
        .select("*, template_sections(count)")
        .order("label", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async createSectionDefinition(fields) {
      const { data, error } = await client().from("section_definitions").insert(fields).select().single();
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "create_section_definition", p_target_type: "section_definition", p_target_id: data.id,
        p_result: "success", p_metadata: {},
      });
      return data;
    },

    async updateSectionDefinition(id, patch) {
      const { data, error } = await client().from("section_definitions").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "update_section_definition", p_target_type: "section_definition", p_target_id: id,
        p_result: "success", p_metadata: patch,
      });
      return data;
    },

    async deleteSectionDefinition(id) {
      const { error } = await client().from("section_definitions").delete().eq("id", id);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "delete_section_definition", p_target_type: "section_definition", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async listReports({ status = "open" } = {}) {
      let q = client()
        .from("reports")
        .select("*, invitations:invitation_id(public_token), reported_user:reported_user_id(email)")
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async resolveReport(id) {
      const user = await AUTH.getUser();
      const { data: adminRow } = await client()
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = await client()
        .from("reports")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: adminRow?.id || null })
        .eq("id", id);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "resolve_report", p_target_type: "report", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async escalateReport(id) {
      const { error } = await client().from("reports").update({ status: "escalated" }).eq("id", id);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "escalate_report", p_target_type: "report", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async listOrders() {
      const { data, error } = await client()
        .from("orders")
        .select("*, buyer:buyer_id(email), invitations:invitation_id(recipient_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async setOrderStatus(id, status) {
      const { error } = await client().from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: `set_order_status:${status}`, p_target_type: "order", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async listPayments() {
      const { data, error } = await client()
        .from("payments")
        .select("*, users:user_id(email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async refundPayment(id) {
      const { error } = await client().from("payments").update({ status: "refunded" }).eq("id", id);
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "refund_payment", p_target_type: "payment", p_target_id: id,
        p_result: "success", p_metadata: {},
      });
    },

    async listAuditLogs({ page = 0, pageSize = 25 } = {}) {
      const { data, error, count } = await client()
        .from("audit_logs")
        .select("*, admin_users:admin_id(user_id, role, users:user_id(email))", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },

    async getSettings() {
      const { data, error } = await client().from("platform_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },

    async updateSettings(patch) {
      const { data, error } = await client()
        .from("platform_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1)
        .select()
        .single();
      if (error) throw error;
      await client().rpc("admin_log_action", {
        p_action: "update_platform_settings", p_target_type: "platform_settings", p_target_id: "1",
        p_result: "success", p_metadata: patch,
      });
      return data;
    },
  };

  return {
    getMyProfile, upsertMyProfile, updateMySettings, deleteMyAccount,
    myInvitationStats,
    listPublishedTemplates, getTemplate, getTemplateSections, listSectionDefinitions,
    listMyInvitations, getMyInvitation, getMyInvitationSections,
    createInvitation, updateInvitation, updateInvitationSection,
    addInvitationSection, deleteInvitationSection, reorderInvitationSections,
    publishInvitation, deleteInvitation, inviteUrl,
    getInvitationByToken, submitInvitationResponse,
    listMyNotifications, markNotificationRead,
    admin,
  };
})();
