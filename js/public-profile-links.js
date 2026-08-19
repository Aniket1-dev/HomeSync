document.addEventListener('DOMContentLoaded', () => {
  if (typeof renderMatchCard !== 'function') return;
  const original = renderMatchCard;
  window.renderMatchCard = function(list, match) {
    original(list, match);
    const card = list.lastElementChild;
    if (!card || !match?.profile?.id) return;
    const info = card.children[1];
    if (!info || info.querySelector('[data-action="view-profile"]')) return;
    const row = document.createElement('div');
    row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
    row.innerHTML=`<a class="btn btn-ghost" data-action="view-profile" href="public-profile.html?id=${encodeURIComponent(match.profile.id)}">👤 View profile</a>`;
    info.appendChild(row);
  };
});
