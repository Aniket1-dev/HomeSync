let qIndex = 0;
const answers = {};
const questions = (window.HOMESYNC_QUESTIONS || []).flatMap(s => s.questions.map(q => ({...q, sectionTitle:s.title})));

async function initCompatibility(){
  const {data:{user}} = await supabaseClient.auth.getUser();
  if(!user){ location.href='login.html'; return; }
  const {data} = await supabaseClient.from('roommate_questionnaire').select('answers,dealbreakers').eq('user_id',user.id).maybeSingle();
  if(data?.answers) Object.assign(answers,data.answers);
  if(data?.dealbreakers) answers.__dealbreakers = data.dealbreakers;
  renderQuestion();
  document.getElementById('q-next').addEventListener('click', nextQuestion);
  document.getElementById('q-back').addEventListener('click', () => { if(qIndex>0){qIndex--;renderQuestion();} });
  document.getElementById('logout-btn')?.addEventListener('click', async e => {e.preventDefault();await supabaseClient.auth.signOut();location.href='login.html';});
}

function renderQuestion(){
  const q=questions[qIndex]; if(!q)return;
  document.getElementById('q-section').textContent=q.sectionTitle;
  document.getElementById('q-count').textContent=`${qIndex+1} / ${questions.length}`;
  document.getElementById('q-progress').style.width=`${((qIndex+1)/questions.length)*100}%`;
  const current=answers[q.id] ?? '';
  const options=q.options.map((o,i)=>`<label class="q-option ${current===String(i) ? 'selected':''}"><input type="radio" name="q" value="${i}" ${current===String(i)?'checked':''}>${escapeHtml(o)}</label>`).join('');
  const isDeal=(answers.__dealbreakers||[]).includes(q.id);
  document.getElementById('question-area').innerHTML=`<h3>${escapeHtml(q.prompt)}</h3><p class="muted">Choose the answer that best represents you.</p>${options}<label class="deal-row"><input id="dealbreaker" type="checkbox" ${isDeal?'checked':''}> <span><strong>Must match</strong><br><small class="muted">Treat this preference as a dealbreaker when comparing roommates.</small></span></label>`;
  document.querySelectorAll('input[name=q]').forEach(r=>r.addEventListener('change',()=>{answers[q.id]=r.value;renderQuestion();}));
  document.getElementById('dealbreaker').addEventListener('change',e=>{let d=answers.__dealbreakers||[];d=e.target.checked?[...new Set([...d,q.id])]:d.filter(x=>x!==q.id);answers.__dealbreakers=d;});
  document.getElementById('q-back').disabled=qIndex===0;
  document.getElementById('q-next').textContent=qIndex===questions.length-1?'Save compatibility profile ✓':'Next →';
}

async function nextQuestion(){
  const q=questions[qIndex];
  if(answers[q.id]===undefined){alert('Please choose an answer before continuing.');return;}
  if(qIndex<questions.length-1){qIndex++;renderQuestion();return;}
  const {data:{user}}=await supabaseClient.auth.getUser();
  const payload={user_id:user.id,answers:Object.fromEntries(Object.entries(answers).filter(([k])=>k!=='__dealbreakers')),dealbreakers:answers.__dealbreakers||[],compatibility_version:2,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {error}=await supabaseClient.from('roommate_questionnaire').upsert(payload,{onConflict:'user_id'});
  if(error){showSaved(error.message,false);return;}
  await supabaseClient.from('profiles').update({profile_completed:true,last_active_at:new Date().toISOString()}).eq('id',user.id);
  showSaved('Compatibility profile saved. Your matching signals are now updated.',true);
  setTimeout(()=>location.href='dashboard.html',900);
}
function showSaved(text,ok){const el=document.getElementById('saved');el.textContent=text;el.classList.remove('hidden');el.style.display='block';if(!ok)el.classList.add('error');}

document.addEventListener('DOMContentLoaded',initCompatibility);
