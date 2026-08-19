(() => {
  const $ = (id) => document.getElementById(id);
  const status = (text, bad=false) => { $('status').textContent = text; $('status').style.color = bad ? '#b42318' : ''; };

  async function init() {
    const {data:{user}} = await supabaseClient.auth.getUser();
    if (!user) { window.location.href='login.html'; return; }
    $('room-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      status('Saving listing and uploading evidence…');
      const listing = {
        owner_id:user.id,
        title:$('title').value.trim(), city:$('city').value.trim(), area:$('area').value.trim(),
        room_type:$('room_type').value, monthly_rent:Number($('rent').value||0), security_deposit:Number($('deposit').value||0),
        maintenance:Number($('maintenance').value||0), electricity_rate:Number($('electricity_rate').value||0),
        electricity_included:$('electricity_included').checked, water_included:$('water_included').checked,
        internet_included:$('internet_included').checked, available_from:$('available_from').value||null, furnishing:$('furnishing').value
      };
      const {data:row,error} = await supabaseClient.from('room_listings').insert(listing).select().single();
      if (error) { status('Could not save listing: '+error.message,true); return; }
      const files = Array.from($('evidence').files||[]).slice(0,8);
      const urls=[];
      for (const file of files) {
        const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const path=`${user.id}/${row.id}/${Date.now()}-${safe}`;
        const up=await supabaseClient.storage.from('room-evidence').upload(path,file,{upsert:false,contentType:file.type});
        if (!up.error) urls.push(path);
      }
      const checks={}; document.querySelectorAll('.check').forEach(x=>checks[x.dataset.field]=x.checked);
      const verification={listing_id:row.id,status:'pending',room_condition:$('notes').value.trim(),...checks,evidence_urls:urls};
      const {error:vError}=await supabaseClient.from('room_verifications').insert(verification);
      if (vError) { status('Listing saved, but verification request failed: '+vError.message,true); return; }
      status('✓ Listing submitted. Verification is pending review. Your listing will only show a Verified badge after an authorized review.');
      $('room-form').reset();
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();