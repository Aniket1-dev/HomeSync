/* HomeSync AI — 15-question MCQ Lifestyle compatibility flow. */
(() => {
  const QUESTIONS = [
    ['sleep_time','Daily Routine','What time do you usually go to bed?',['Before 10 PM','10 PM–12 AM','12–2 AM','After 2 AM']],
    ['wake_time','Daily Routine','What time do you usually wake up?',['Before 6 AM','6–8 AM','8–10 AM','After 10 AM']],
    ['study_work_schedule','Daily Routine','How do you usually spend your evenings at home?',['Quiet study/work','Mostly relaxing','Socializing / entertainment','Mixed depending on the day']],
    ['clean_room','Home & Cleanliness','How tidy should shared spaces be?',['Relaxed','Moderately tidy','Very tidy','Spotless']],
    ['dishes','Home & Cleanliness','How quickly should dishes be washed?',['Immediately','Same day','Within 24 hours','Whenever needed']],
    ['shared_cleaning','Home & Cleanliness','How should chores be divided?',['Equal rotation','Weekly rotation','Split by preference','Discuss each task']],
    ['guest_frequency','Social Life & Boundaries','How often are you comfortable having friends over?',['Rarely','Occasionally','A few times a week','Very often']],
    ['social_energy','Social Life & Boundaries','Which best describes your home personality?',['Very private','Quiet but friendly','Social','Very outgoing']],
    ['noise_conflict','Social Life & Boundaries','If your roommate is making too much noise, what would you do?',['Avoid confrontation','Politely discuss it','Address it directly','Set a clear house rule']],
    ['smoking_home','Lifestyle & Shared Living','What is your preference about smoking or vaping inside the home?',['Absolutely not','Only outside','Occasionally is okay','I don’t mind']],
    ['cooking_frequency','Lifestyle & Shared Living','How often do you cook at home?',['Almost never','1–2 times a week','Most days','Daily']],
    ['personal_space','Lifestyle & Shared Living','How much personal space do you prefer?',['A lot of privacy','Balanced privacy','I enjoy shared time','Very social / shared']],
    ['move_in_timing','Search Priorities','How soon do you need to move in?',['Just exploring','Within 2–3 months','Within 1 month','ASAP']],
    ['commute_priority','Search Priorities','How important is a short commute to college or work?',['Not important','Nice to have','Very important','Must be within ~30 minutes']],
    ['verification_priority','Search Priorities','How important is it that a roommate/profile is verified?',['Not a deciding factor','Prefer verified','Very important','I only want verified profiles']]
  ].map(([id,section,text,options]) => ({id,section,text,options}));

  const state = { index: 0, answers: {}, dealbreakers: new Set() };
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mount() { return document.getElementById('lifestyle-question-mount'); }

  function goStep3() {
    if (typeof window.goToStep === 'function') window.goToStep(3);
    else document.querySelector('.wizard-panel[data-panel="3"]')?.classList.add('active');
    setTimeout(render, 0);
  }

  function render() {
    const el = mount();
    if (!el) return;
    const q = QUESTIONS[state.index];
    const selected = state.answers[q.id];
    const pct = ((state.index + 1) / QUESTIONS.length) * 100;
    el.innerHTML = `
      <div class="hs-mcq-card">
        <div class="hs-mcq-top"><span>${esc(q.section)}</span><strong>${state.index + 1} / ${QUESTIONS.length}</strong></div>
        <div class="hs-mcq-bar"><i style="width:${pct}%"></i></div>
        <h3>${esc(q.text)}</h3>
        <p>Choose the answer that best represents you.</p>
        <div class="hs-mcq-options">
          ${q.options.map((o,i)=>`<label class="hs-mcq-option ${selected===i?'selected':''}"><input type="radio" name="hs-answer" value="${i}" ${selected===i?'checked':''}><span class="radio"></span><b>${esc(o)}</b></label>`).join('')}
        </div>
        <label class="hs-mcq-deal"><input id="hs-deal" type="checkbox" ${state.dealbreakers.has(q.id)?'checked':''}><span><b>Must match</b><small>Treat this preference as a dealbreaker when comparing roommates.</small></span></label>
        <div class="hs-mcq-actions"><button type="button" class="btn btn-ghost" id="hs-back">← Back</button><button type="button" class="btn btn-primary" id="hs-next">${state.index===14?'Finish lifestyle ✓':'Next →'}</button></div>
        <div class="hs-mcq-note">15 questions · about 2 minutes</div>
      </div>`;

    el.querySelectorAll('input[name="hs-answer"]').forEach(input => input.addEventListener('change', () => {
      state.answers[q.id] = Number(input.value);
      el.querySelectorAll('.hs-mcq-option').forEach(x=>x.classList.remove('selected'));
      input.closest('.hs-mcq-option')?.classList.add('selected');
    }));
    el.querySelector('#hs-deal')?.addEventListener('change', e => e.target.checked ? state.dealbreakers.add(q.id) : state.dealbreakers.delete(q.id));
    el.querySelector('#hs-back')?.addEventListener('click', () => {
      if (state.index === 0) { if (typeof window.goToStep==='function') window.goToStep(2); return; }
      state.index--; render(); window.scrollTo({top:0,behavior:'smooth'});
    });
    el.querySelector('#hs-next')?.addEventListener('click', () => {
      if (state.answers[q.id] === undefined) {
        const msg=document.getElementById('onboarding-msg');
        if(msg){msg.textContent='Choose an answer to continue.';msg.classList.remove('hidden');}
        return;
      }
      if(state.index===14){
        window.homesyncCompatibilityAnswers={answers:{...state.answers},dealbreakers:[...state.dealbreakers],version:2,completed_at:new Date().toISOString()};
        if(typeof window.goToStep==='function') window.goToStep(4);
        return;
      }
      state.index++; render(); window.scrollTo({top:0,behavior:'smooth'});
    });
  }

  function init(){
    if(!document.getElementById('hs-mcq-style')){
      const s=document.createElement('style');s.id='hs-mcq-style';s.textContent=`
        .hs-mcq-card{background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:22px;padding:32px;box-shadow:0 15px 45px rgba(0,0,0,.07)}
        .hs-mcq-top{display:flex;justify-content:space-between;align-items:center;text-transform:uppercase;letter-spacing:.08em;font-size:.8rem}.hs-mcq-top span{font-weight:800;color:var(--sage,#10b981)}.hs-mcq-top strong{font-size:1rem}
        .hs-mcq-bar{height:8px;background:var(--line,#ddd);border-radius:99px;margin:18px 0 36px;overflow:hidden}.hs-mcq-bar i{display:block;height:100%;background:var(--sage,#10b981);border-radius:99px}
        .hs-mcq-card h3{font-size:1.5rem;margin:0 0 8px}.hs-mcq-card>p{color:var(--muted,#667);margin:0 0 20px}.hs-mcq-options{display:grid;gap:12px}.hs-mcq-option{position:relative;display:flex;align-items:center;gap:14px;padding:18px 20px;border:1px solid var(--line,#ddd);border-radius:16px;cursor:pointer;background:var(--card,#fff)}.hs-mcq-option:hover,.hs-mcq-option.selected{border-color:var(--sage,#10b981);background:rgba(16,185,129,.08)}.hs-mcq-option input{position:absolute;opacity:0}.hs-mcq-option .radio{width:18px;height:18px;border:1px solid #9ca3af;border-radius:50%;display:grid;place-items:center;flex:none}.hs-mcq-option.selected .radio{border-color:var(--sage,#10b981)}.hs-mcq-option.selected .radio:after{content:'';width:9px;height:9px;background:var(--sage,#10b981);border-radius:50%}.hs-mcq-deal{display:flex;gap:12px;margin-top:18px;padding:16px;border:1px dashed var(--line,#ddd);border-radius:16px;cursor:pointer}.hs-mcq-deal small{display:block;color:var(--muted,#667);margin-top:3px}.hs-mcq-actions{display:flex;justify-content:space-between;margin-top:28px}.hs-mcq-note{text-align:center;color:var(--muted,#667);font-size:.8rem;margin-top:14px}@media(max-width:700px){.hs-mcq-card{padding:22px}.hs-mcq-card h3{font-size:1.3rem}.hs-mcq-actions .btn{flex:1}}
      `;document.head.appendChild(s);
    }
    render();
  }
  window.homesyncRenderLifestyleQuestions=render;
  window.addEventListener('homesync:lifestyle', goStep3);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();