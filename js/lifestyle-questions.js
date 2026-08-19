/* HomeSync AI — 15-question MCQ Lifestyle compatibility flow.
 * The Lifestyle step is the ONLY place where compatibility questions appear.
 * Dashboard does not render any of these questions.
 */
(() => {
  const QUESTIONS = [
    {id:'sleep_time',section:'Daily Routine',label:'Sleep time',text:'What time do you usually go to bed?',options:['Before 10 PM','10 PM–12 AM','12–2 AM','After 2 AM']},
    {id:'wake_time',section:'Daily Routine',label:'Wake up time',text:'What time do you usually wake up?',options:['Before 6 AM','6–8 AM','8–10 AM','After 10 AM']},
    {id:'study_work_schedule',section:'Daily Routine',label:'Evening routine',text:'How do you usually spend your evenings at home?',options:['Quiet study/work','Mostly relaxing','Socializing / entertainment','Mixed depending on the day']},
    {id:'clean_room',section:'Home & Cleanliness',label:'Cleanliness',text:'How tidy should shared spaces be?',options:['Relaxed','Moderately tidy','Very tidy','Spotless']},
    {id:'dishes',section:'Home & Cleanliness',label:'Dishes',text:'How quickly should dishes be washed?',options:['Immediately','Same day','Within 24 hours','Whenever needed']},
    {id:'shared_cleaning',section:'Home & Cleanliness',label:'Chores responsibility',text:'How should chores be divided?',options:['Equal rotation','Weekly rotation','Split by preference','Discuss each task']},
    {id:'guest_frequency',section:'Social Life & Boundaries',label:'Guest frequency',text:'How often are you comfortable having friends over?',options:['Rarely','Occasionally','A few times a week','Very often']},
    {id:'social_energy',section:'Social Life & Boundaries',label:'Home personality',text:'Which best describes your home personality?',options:['Very private','Quiet but friendly','Social','Very outgoing']},
    {id:'noise_conflict',section:'Social Life & Boundaries',label:'Noise & conflict',text:'If your roommate is making too much noise, what would you do?',options:['Avoid confrontation','Politely discuss it','Address it directly','Set a clear house rule']},
    {id:'smoking_home',section:'Lifestyle & Shared Living',label:'Smoking / vaping',text:'What is your preference about smoking or vaping inside the home?',options:['Absolutely not','Only outside','Occasionally is okay','I don’t mind']},
    {id:'cooking_frequency',section:'Lifestyle & Shared Living',label:'Cooking habits',text:'How often do you cook at home?',options:['Almost never','1–2 times a week','Most days','Daily']},
    {id:'personal_space',section:'Lifestyle & Shared Living',label:'Personal space',text:'How much personal space do you prefer?',options:['A lot of privacy','Balanced privacy','I enjoy shared time','Very social / shared']},
    {id:'move_in_timing',section:'Search Priorities',label:'Move-in timing',text:'How soon do you need to move in?',options:['Just exploring','Within 2–3 months','Within 1 month','ASAP']},
    {id:'commute_priority',section:'Search Priorities',label:'Commute',text:'How important is a short commute to college or work?',options:['Not important','Nice to have','Very important','Must be within ~30 minutes']},
    {id:'verification_priority',section:'Search Priorities',label:'Verification',text:'How important is it that a roommate/profile is verified?',options:['Not a deciding factor','Prefer verified','Very important','I only want verified profiles']}
  ];

  const state = { index: 0, answers: {}, dealbreakers: new Set() };
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function injectStyle() {
    if (document.getElementById('hs-lifestyle-mcq-style')) return;
    const style = document.createElement('style');
    style.id = 'hs-lifestyle-mcq-style';
    style.textContent = `
      .hs-lifestyle-mcq{max-width:960px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:34px;box-shadow:0 20px 60px rgba(0,0,0,.08)}
      .hs-mcq-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.hs-mcq-section{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:var(--sage)}.hs-mcq-count{font-size:1rem;font-weight:800}
      .hs-mcq-progress{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin-bottom:34px}.hs-mcq-progress span{display:block;height:100%;background:var(--sage);border-radius:99px;transition:width .25s ease}
      .hs-mcq-title{font-size:1.55rem;line-height:1.25;margin:0 0 8px}.hs-mcq-help{margin:0 0 20px;color:var(--muted)}
      .hs-mcq-options{display:grid;gap:12px}.hs-mcq-option{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:16px;padding:18px 20px;background:var(--card);cursor:pointer;transition:border-color .15s,background .15s,transform .15s}.hs-mcq-option:hover{border-color:var(--sage);transform:translateY(-1px)}.hs-mcq-option.selected{border-color:var(--sage);background:color-mix(in srgb,var(--sage) 11%,var(--card))}.hs-mcq-radio{width:20px;height:20px;border:1.5px solid var(--muted);border-radius:50%;display:grid;place-items:center;flex:none}.hs-mcq-option.selected .hs-mcq-radio{border-color:var(--sage)}.hs-mcq-option.selected .hs-mcq-radio:after{content:'';width:10px;height:10px;border-radius:50%;background:var(--sage)}.hs-mcq-option input{position:absolute;opacity:0;pointer-events:none}.hs-mcq-text{font-weight:650}
      .hs-mcq-deal{margin-top:18px;border:1px dashed var(--line);border-radius:16px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start;cursor:pointer}.hs-mcq-deal input{width:18px;height:18px;margin-top:2px;accent-color:var(--sage)}.hs-mcq-deal strong{display:block}.hs-mcq-deal small{display:block;color:var(--muted);margin-top:3px}
      .hs-mcq-nav{display:flex;justify-content:space-between;gap:12px;margin-top:28px}.hs-mcq-nav .btn:disabled{opacity:.45;cursor:not-allowed}.hs-mcq-note{text-align:center;color:var(--muted);font-size:.82rem;margin-top:14px}
      body.light .hs-lifestyle-mcq{box-shadow:0 20px 60px rgba(40,35,20,.08)}
      @media(max-width:700px){.hs-lifestyle-mcq{padding:22px}.hs-mcq-title{font-size:1.3rem}.hs-mcq-option{padding:15px 16px}.hs-mcq-nav .btn{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function getMount() {
    return document.getElementById('lifestyle-question-mount') || document.querySelector('.wizard-panel[data-panel="3"]');
  }

  function render() {
    const mount = getMount();
    if (!mount) return;
    injectStyle();
    const q = QUESTIONS[state.index];
    const selected = state.answers[q.id];
    const progress = ((state.index + 1) / QUESTIONS.length) * 100;

    mount.innerHTML = `
      <div class="hs-lifestyle-mcq">
        <div class="hs-mcq-head"><span class="hs-mcq-section">${escape(q.section)}</span><span class="hs-mcq-count">${state.index + 1} / ${QUESTIONS.length}</span></div>
        <div class="hs-mcq-progress"><span style="width:${progress}%"></span></div>
        <h3 class="hs-mcq-title">${escape(q.text)}</h3>
        <p class="hs-mcq-help">Choose the answer that best represents you.</p>
        <div class="hs-mcq-options">
          ${q.options.map((option, i) => `
            <label class="hs-mcq-option ${selected === i ? 'selected' : ''}">
              <input type="radio" name="hs-mcq-answer" value="${i}" ${selected === i ? 'checked' : ''} />
              <span class="hs-mcq-radio" aria-hidden="true"></span>
              <span class="hs-mcq-text">${escape(option)}</span>
            </label>`).join('')}
        </div>
        <label class="hs-mcq-deal">
          <input type="checkbox" id="hs-mcq-dealbreaker" ${state.dealbreakers.has(q.id) ? 'checked' : ''} />
          <span><strong>Must match</strong><small>Treat this preference as a dealbreaker when comparing roommates.</small></span>
        </label>
        <div class="hs-mcq-nav">
          <button type="button" class="btn btn-ghost" id="hs-mcq-back">← Back</button>
          <button type="button" class="btn btn-primary" id="hs-mcq-next">${state.index === QUESTIONS.length - 1 ? 'Finish lifestyle ✓' : 'Next →'}</button>
        </div>
        <div class="hs-mcq-note">15 questions · about 2 minutes · you can change answers later</div>
      </div>`;

    mount.querySelectorAll('input[name="hs-mcq-answer"]').forEach(input => {
      input.addEventListener('change', () => {
        state.answers[q.id] = Number(input.value);
        mount.querySelectorAll('.hs-mcq-option').forEach(el => el.classList.remove('selected'));
        input.closest('.hs-mcq-option')?.classList.add('selected');
      });
    });

    mount.querySelector('#hs-mcq-dealbreaker')?.addEventListener('change', e => {
      if (e.target.checked) state.dealbreakers.add(q.id); else state.dealbreakers.delete(q.id);
    });

    mount.querySelector('#hs-mcq-back')?.addEventListener('click', () => {
      if (state.index === 0) { goToStep(2); return; }
      state.index -= 1; render(); window.scrollTo({top:0, behavior:'smooth'});
    });

    mount.querySelector('#hs-mcq-next')?.addEventListener('click', () => {
      if (state.answers[q.id] === undefined) {
        const msg = document.getElementById('onboarding-msg');
        if (typeof showMsg === 'function') showMsg(msg, 'Choose an answer to continue.');
        return;
      }
      const msg = document.getElementById('onboarding-msg');
      if (typeof hideMsg === 'function') hideMsg(msg);
      if (state.index === QUESTIONS.length - 1) {
        window.homesyncCompatibilityAnswers = {
          answers: {...state.answers},
          dealbreakers: [...state.dealbreakers],
          version: 2,
          completed_at: new Date().toISOString()
        };
        goToStep(4);
        return;
      }
      state.index += 1; render(); window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  function start() {
    const mount = getMount();
    if (!mount) return;
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
