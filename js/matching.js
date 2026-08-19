// ============================================================
// HomeSync compatibility scoring engine
// The 15-question Lifestyle MCQ is the source of truth for
// compatibility. Legacy profile fields remain as a fallback.
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

// All 15 Lifestyle questions are scored. Higher weight = more important
// roommate signal. The total is exactly 1.00.
const QUESTION_WEIGHTS = {
  sleep_time: 0.10,
  wake_time: 0.07,
  study_work_schedule: 0.05,
  clean_room: 0.10,
  dishes: 0.06,
  shared_cleaning: 0.05,
  guest_frequency: 0.08,
  social_energy: 0.06,
  noise_conflict: 0.07,
  smoking_home: 0.10,
  cooking_frequency: 0.06,
  personal_space: 0.06,
  move_in_timing: 0.05,
  commute_priority: 0.05,
  verification_priority: 0.04,
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
  if (a == null || b == null) return 0.5;
  return 1 - Math.abs(Number(a) - Number(b)) / (scaleMax - 1);
}

function simCategorical(field, a, b) {
  if (!a || !b) return 0.5;
  const table = CATEGORICAL_TABLES[field];
  if (!table) return a === b ? 1 : 0.3;
  return table[a]?.[b] ?? 0.3;
}

function budgetOverlaps(pA, pB) {
  if (!pA.budget_min || !pB.budget_min) return true;
  return pA.budget_min <= pB.budget_max && pB.budget_min <= pA.budget_max;
}

function questionnaireSimilarity(a, b) {
  const aa = a.compatibility_answers;
  const bb = b.compatibility_answers;
  if (!aa || !bb || typeof aa !== "object" || typeof bb !== "object") return null;

  const keys = Object.keys(QUESTION_WEIGHTS);
  const available = keys.filter((key) => aa[key] != null && bb[key] != null);
  if (available.length < 8) return null;

  // A user's "Must match" questions are true dealbreakers. If either side
  // marked a question as a dealbreaker and the answers differ, don't match.
  const da = Array.isArray(a.compatibility_dealbreakers) ? a.compatibility_dealbreakers : [];
  const db = Array.isArray(b.compatibility_dealbreakers) ? b.compatibility_dealbreakers : [];
  const dealbreakers = new Set([...da, ...db]);
  for (const key of dealbreakers) {
    if (aa[key] != null && bb[key] != null && Number(aa[key]) !== Number(bb[key])) return null;
  }

  let weighted = 0;
  let weightTotal = 0;
  const details = {};
  for (const key of available) {
    const similarity = 1 - Math.abs(Number(aa[key]) - Number(bb[key])) / 3;
    const weight = QUESTION_WEIGHTS[key];
    weighted += weight * similarity;
    weightTotal += weight;
    details[key] = similarity;
  }

  return {
    score: weightTotal ? weighted / weightTotal : 0.5,
    details,
    matchedQuestions: available.length,
    totalQuestions: keys.length,
  };
}

function legacyRuleScore(a, b) {
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
  for (const key in WEIGHTS) score += WEIGHTS[key] * (breakdown[key] ?? 0.5);
  return { score, breakdown, source: "legacy" };
}

/**
 * Computes compatibility from all 15 Lifestyle MCQs whenever both profiles
 * have them. This fixes the old bug where changing an MCQ only updated the
 * questionnaire table while the matcher continued reading stale profile fields.
 */
function computeRuleScore(a, b) {
  if (!budgetOverlaps(a, b)) return null;

  const questionnaire = questionnaireSimilarity(a, b);
  if (questionnaire) {
    // Keep the familiar breakdown keys for the existing match-card UI.
    const d = questionnaire.details;
    const breakdown = {
      sleep_schedule: d.sleep_time ?? 0.5,
      cleanliness: d.clean_room ?? 0.5,
      guest_frequency: d.guest_frequency ?? 0.5,
      personality: d.social_energy ?? 0.5,
      smoking_drinking: d.smoking_home ?? 0.5,
      cooking_habits: d.cooking_frequency ?? 0.5,
      conflict_style: d.noise_conflict ?? 0.5,
      ...d,
    };
    return {
      score: Math.round(questionnaire.score * 100),
      breakdown,
      source: "15-question-lifestyle",
      matchedQuestions: questionnaire.matchedQuestions,
      totalQuestions: questionnaire.totalQuestions,
    };
  }

  const legacy = legacyRuleScore(a, b);
  return { score: Math.round(legacy.score * 100), breakdown: legacy.breakdown, source: legacy.source };
}

function computeHybridScore(ruleScore, llmScore, alpha = 0.6) {
  if (llmScore == null) return ruleScore;
  return Math.round(alpha * ruleScore + (1 - alpha) * llmScore);
}

function rankMatches(me, candidates, topN = 20) {
  const scored = candidates
    .map((c) => {
      const result = computeRuleScore(me, c);
      if (!result) return null;
      return {
        profile: c,
        ruleScore: result.score,
        breakdown: result.breakdown,
        scoreSource: result.source,
        matchedQuestions: result.matchedQuestions,
        totalQuestions: result.totalQuestions,
      };
    })
    .filter(Boolean)
    .sort((x, y) => y.ruleScore - x.ruleScore);

  return scored.slice(0, topN);
}
