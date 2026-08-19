/* HomeSync AI — Lifestyle compatibility flow
 * Renders the 15-question roommate questionnaire inside onboarding's Lifestyle step.
 * One question at a time, matching the visual language of compatibility.html.
 */
(() => {
  const QUESTIONS = [
    {id:'sleep_time',section:'Daily Routine',text:'What time do you usually go to bed?',options:['Before 10 PM','10 PM–12 AM','12–2 AM','After 2 AM'],profile:'sleep_schedule'},
    {id:'wake_time',section:'Daily Routine',text:'What time do you usually wake up?',options:['Before 6 AM','6–8 AM','8–10 AM','After 10 AM']},
    {id:'study_work_schedule',section:'Daily Routine',text:'How do you usually spend your evenings at home?',options:['Quiet study/work','Mostly relaxing','Socializing/entertainment','Mixed depending on the day']},
    {id:'clean_room',section:'Home & Cleanliness',text:'How tidy should shared spaces be?',options:['Relaxed','Moderately tidy','Very tidy','Spotless'],profile:'cleanliness'},
    {id:'dishes',section:'Home & Cleanliness',text:'How quickly should dishes be washed?',options:['Immediately','Same day','Within 24 hours','Whenever needed']},
    {id:'shared_cleaning',section:'Home & Cleanliness',text:'How should chores be divided?',options:['Equal rotation','Weekly rotation','Split by preference','Discuss each task']},
    {id:'guest_frequency',section:'Social Life & Boundaries',text:'How often are you comfortable having friends over?',options:['Rarely','Occasionally','A few times a week','Very often'],profile:'guest_frequency'},
    {id:'social_energy',section:'Social Life & Boundaries',text:'Which best describes your home personality?',options:['Very private','Quiet but friendly','Social','Very outgoing'],profile:'personality'},
    {id:'noise_conflict',section:'Social Life & Boundaries',text:'If your roommate is making too much noise, what would you do?',options:['Avoid confrontation','Politely discuss it','Address it directly','Set a clear house rule'],profile:'conflict_style'},
    {id:'smoking_home',section:'Lifestyle & Shared Living',text:'What is your preference about smoking or vaping inside the home?',options:['Absolutely not','Only outside','Occasionally is okay','I don’t mind'],profile:'smoking_drinking'},
    {id:'cooking_frequency',section:'Lifestyle & Shared Living',text:'How often do you cook at home?',options:['Almost never','1–2 times a week','Most days','Daily'],profile:'cooking_habits'},
    {id:'personal_space',section:'Lifestyle & Shared Living',text:'How much personal space do you prefer?',options:['A lot of privacy','Balanced privacy','I enjoy shared time','Very social/shared']},
    {id:'move_in_timing',section:'Search Priorities',text:'How soon do you need to move in?',options:['Just exploring','Within 2–3 months','Within 1 month','ASAP']},
    {id:'commute_priority',section:'Search Priorities',text:'How important is a short commute to college or work?',options:['Not important','Nice to have','Very important','Must be within ~30 minutes']},
    {id:'verification_priority',section:'Search Priorities',text:'How important is it that a roommate/profile is verified?',options:['Not a deciding factor','Prefer verified','Very important','I only want verified profiles']}
  ];

  const state = {index:0, answers:{}, dealbreakers:new Set()};

  function injectStyle(){
    if(document.getElementById('lifestyle-question-style')) return;
    const s=document.createElement('style');
    s.id='lifestyle-question-style';
    s.textContent=`
      .lq-shell{max-width:900px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:32px;box-shadow:0 18px 50px rgba(0,0,0,.06)}
      .lq-top{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:20px}
      .lq-section{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sage);font-weight:800}
      .lq-count{font-weight:800;font-size:1rem}.lq-progress{height:9px;background:var(--line);border-radius:99px;overflow:hidden;margin-bottom:34px}.lq-progress-fill{height:100%;background:var(--sage);border-radius:99px;transition:width .25s ease}
      .lq-question{font-size:1.45rem;line-height:1.25;margin:0 0 8px}.lq-help{margin:0 0 20px;color:var(--muted)}
      .lq-options{display:grid;gap:10px}.lq-option{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:15px;padding:16px 18px;cursor:pointer;transition:.15s;background:var(--card)}.lq-option:hover{border-color:var(--sage);transform:translateY(-1px)}.lq-option.selected{border-color:var(--sage);background:color-mix(in srgb,var(--sage) 10%,var(--card))}.lq-option input{width:18px;height:18px;accent-color:var(--sage);flex:none}
      .lq-deal{margin-top:18px;border:1px dashed var(--line);border-radius:15px;padding:15px 16px;display:flex;gap:12px;align-items:flex-start}.lq-deal input{margin-top:3px;width:18px;height:18px;accent-color:var(--sage)}.lq-deal strong{display:block}.lq-deal small{display:block;color:var(--muted);margin-top:3px}
      .lq-nav{display:flex;justify-content:space-between;gap:12px;margin-top:28px}.lq-nav .btn:disabled{opacity:.45;cursor:not-allowed}
      .lq-note{margin-top:14px;text-align:center;font-size:.82rem;color:var(--muted)}
      body.light .lq-shell{box-shadow:0 18px 50px rgba(40,35,20,.08)}
      @media(max-width:700px){.lq-shell{padding:22px}.lq-question{font-size:1.25rem}.lq-option{padding:14px}.lq-nav{flex-direction:row}.lq-nav .btn{flex:1}}
    `;
    document.head.appendChild(s);
  }

  function render(){
    const panel=document.querySelector('.wizard-panel[data-panel="3"]');
    if(!panel) return;
    injectStyle();
    const q=QUESTIONS[state.index];
    const selected=state.answers[q.id];
    const percent=((state.index+1)/QUESTIONS.length)*100;
    panel.innerHTML=`
      <div class="lq-shell" id="lifestyle-questionnaire">
        <div class="lq-top"><span class="lq-section">${q.section}</span><span class="lq-count">${state.index+1} / ${QUESTIONS.length}</span></div>
        <div class="lq-progress"><div class="lq-progress-fill" style="width:${percent}%"></div></div>
        <h3 class="lq-question">${q.text}</h3>
        <p class="lq-help">Choose the answer that best represents you.</p>
        <div class="lq-options">
          ${q.options.map((opt,i)=>`<label class="lq-option ${selected===i?'selected':''}"><input type="radio" name="lq-answer" value="${i}" ${selected===i?'checked':''}><span>${opt}</span></label>`).join('')}
        </div>
        <label class="lq-deal"><input type="checkbox" id="lq-dealbreaker" ${state.dealbreakers.has(q.id)?'checked':''}><span><strong>Must match</strong><small>Treat this preference as a dealbreaker when comparing roommates.</small></span></label>
        <div class="lq-nav"><button type="button" class="btn btn-ghost" id="lq-back">← Back</button><button type="button" class="btn btn-primary" id="lq-next">${state.index===QUESTIONS.length-1?'Finish lifestyle →':'Next →'}</button></div>
        <div class="lq-note">15 questions · about 2 minutes · you can change answers later</div>
        <input type="hidden" name="sleep_schedule" id="sleep_schedule" value="3" data-lifestyle-hidden="sleep_schedule">
        <input type="hidden" name="cleanliness" id="cleanliness" value="3" data-lifestyle-hidden="cleanliness">
        <input type="hidden" name="guest_frequency" id="guest_frequency" value="3" data-lifestyle-hidden="guest_frequency">
        <input type="hidden" name="personality" id="personality" value="3" data-lifestyle-hidden="personality">
        <input type="hidden" name="smoking_drinking" id="smoking_drinking" value="never" data-lifestyle-hidden="smoking_drinking">
        <input type="hidden" name="cooking_habits" id="cooking_habits" value="self_cook" data-lifestyle-hidden="cooking_habits">
        <input type="hidden" name="conflict_style" id="conflict_style" value="discusses" data-lifestyle-hidden="conflict_style">
      </div>`;

    panel.querySelectorAll('input[name="lq-answer"]').forEach(input=>input.addEventListener('change',()=>{
      state.answers[q.id]=Number(input.value);
      panel.querySelectorAll('.lq-option').forEach(el=>el.classList.remove('selected'));
      input.closest('.lq-option')?.classList.add('selected');
      syncLegacyField(q,Number(input.value));
    }));
    document.getElementById('lq-dealbreaker')?.addEventListener('change',e=>{if(e.target.checked)state.dealbreakers.add(q.id);else state.dealbreakers.delete(q.id)});
    document.getElementById('lq-back')?.addEventListener('click',()=>{
      if(state.index===0){goToStep(2);return;} state.index--; render(); window.scrollTo({top:0,behavior:'smooth'});
    });
    document.getElementById('lq-next')?.addEventListener('click',()=>{
      if(state.answers[q.id]===undefined){showMsg(document.getElementById('onboarding-msg'),'Choose an answer to continue.');return;}
      hideMsg(document.getElementById('onboarding-msg'));
      if(state.index===QUESTIONS.length-1){
        window.homesyncCompatibilityAnswers={answers:{...state.answers},dealbreakers:[...state.dealbreakers],version:1,completed_at:new Date().toISOString()};
        goToStep(4); return;
      }
      state.index++; render(); window.scrollTo({top:0,behavior:'smooth'});
    });
  }

  function syncLegacyField(q,index){
    if(!q.profile) return;
    const el=document.getElementById(q.profile); if(!el) return;
    if(['sleep_schedule','cleanliness','guest_frequency','personality'].includes(q.profile)) el.value=Math.min(5,index+1);
    else if(q.profile==='smoking_drinking') el.value=index===0?'never':index===1?'social':'regular';
    else if(q.profile==='cooking_habits') el.value=index===0?'order_in':index===1?'self_cook':'shared';
    else if(q.profile==='conflict_style') el.value=index===0?'avoids':index===1?'discusses':'confronts';
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const panel=document.querySelector('.wizard-panel[data-panel="3"]); if(!panel)return;
    render();
  });
})();
