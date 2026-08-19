/* Compatibility bank generated from the market-informed 15-question flow. */
window.HOMESYNC_QUESTION_BANK = (window.HOMESYNC_QUESTIONS || []).flatMap(section =>
  section.questions.map(q => ({...q, section: section.id, sectionTitle: section.title}))
);
