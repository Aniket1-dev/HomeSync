// ============================================================
// Rule-based compatibility scoring engine
// Mirrors Section 3.3 of the HomeSync AI project report:
// Score_rule = sum(w_i * sim_i), budget & location as hard filters.
// ============================================================

const WEIGHTS = {
  sleep_schedule: 0.20,
  cleanliness: 0.22,
  guest_frequency: 0.12,
  personality: 0.14,
  smoking_drinking: 0.14,
  cooking_habits: 0.10,
  conflict_style: 0.08,
};

const CATEGORICAL_TABLES = {
  smoking_drinking: {
    never: { never: 1.0, social: 0.55, regular: 0.15 },
    social: { never: 0.55, social: 1.0, regular: 0.6 },
    regular: { never: 0.15, social: 0.6, regular: 1.0 },
  },
  cooking_habits: {
    self_cook: { self_cook: 1.0, order_in: 0.5, shared: 0.75 },
    order_in: { self_cook: 0.5, order_in: 1.0, shared: 0.6 },
    shared: { self_cook: 0.75, order_in: 0.6, shared: 1.0 },
  },
  conflict_style: {
    avoids: { avoids: 0.7, discusses: 0.55, confronts: 0.25 },
    discusses: { avoids: 0.55, discusses: 1.0, confronts: 0.65 },
    confronts: { avoids: 0.25, discusses: 0.65, confronts: 0.7 },
  },
};

function simNumeric(a, b, scaleMax = 5) {
  if (a == null || b == null) return 0.5; // unknown -> neutral
  return 1 - Math.abs(a - b) / (scaleMax - 1);
}

function simCategorical(field, a, b) {
  if (!a || !b) return 0.5;
  const table = CATEGORICAL_TABLES[field];
  if (!table) return a === b ? 1 : 0.3;
  return table[a]?.[b] ?? 0.3;
}

function budgetOverlaps(pA, pB) {
  if (!pA.budget_min || !pB.budget_min) return true; // insufficient data, don't hard-filter
  return pA.budget_min <= pB.budget_max && pB.budget_min <= pA.budget_max;
}

/**
 * Computes the structured rule-based score for a pair of profiles.
 * Returns { score: 0-100, breakdown: {field: sim 0-1} } or null if filtered out.
 */
function computeRuleScore(a, b) {
  if (!budgetOverlaps(a, b)) return null;

  const breakdown = {
    sleep_schedule: simNumeric(a.sleep_schedule, b.sleep_schedule),
    cleanliness: simNumeric(a.cleanliness, b.cleanliness),
    guest_frequency: simNumeric(a.guest_frequency, b.guest_frequency),
    personality: simNumeric(a.personality, b.personality),
    smoking_drinking: simCategorical("smoking_drinking", a.smoking_drinking, b.smoking_drinking),
    cooking_habits: simCategorical("cooking_habits", a.cooking_habits, b.cooking_habits),
    conflict_style: simCategorical("conflict_style", a.conflict_style, b.conflict_style),
  };

  let score = 0;
  for (const key in WEIGHTS) {
    score += WEIGHTS[key] * (breakdown[key] ?? 0.5);
  }

  return { score: Math.round(score * 100), breakdown };
}

/**
 * Hybrid score per Section 3.5: Score_hybrid = alpha*rule + (1-alpha)*llm
 * If no LLM score is available yet, hybrid falls back to the rule score
 * (alpha effectively 1) so the app is fully usable without the optional
 * Edge Function being deployed.
 */
function computeHybridScore(ruleScore, llmScore, alpha = 0.6) {
  if (llmScore == null) return ruleScore;
  return Math.round(alpha * ruleScore + (1 - alpha) * llmScore);
}

/**
 * Ranks all candidate profiles against the current user, returning the
 * top-N shortlist by rule score (this shortlist is what would be sent to
 * the LLM re-ranking step, per Section 4's cost-control design).
 */
function rankMatches(me, candidates, topN = 20) {
  const scored = candidates
    .map((c) => {
      const result = computeRuleScore(me, c);
      if (!result) return null;
      return { profile: c, ruleScore: result.score, breakdown: result.breakdown };
    })
    .filter(Boolean)
    .sort((x, y) => y.ruleScore - x.ruleScore);

  return scored.slice(0, topN);
}
