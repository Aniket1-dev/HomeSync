// ============================================================================
// HomeSync AI — Auth helpers
// ============================================================================
const AUTH = (() => {
  function client() {
    if (!window.sb) throw new Error("Supabase client not initialized — check supabase-config.js");
    return window.sb;
  }

  function callbackUrl() { return new URL("auth-callback.html", window.location.href).toString(); }
  async function getSession() { const { data, error } = await client().auth.getSession(); if (error) throw error; return data.session; }
  async function getUser() { const { data, error } = await client().auth.getUser(); if (error) throw error; return data.user; }
  async function signUpWithEmail(email,password,fullName){const {data,error}=await client().auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:callbackUrl()}});if(error)throw error;return data;}
  async function signInWithEmail(email,password){const {data,error}=await client().auth.signInWithPassword({email,password});if(error)throw error;return data;}
  async function signInWithGoogle(){const {error}=await client().auth.signInWithOAuth({provider:"google",options:{redirectTo:callbackUrl(),queryParams:{access_type:"offline",prompt:"consent"}}});if(error)throw error;}
  async function sendPasswordReset(email){const {error}=await client().auth.resetPasswordForEmail(email,{redirectTo:new URL("reset-password.html",window.location.href).toString()});if(error)throw error;}
  async function verifySignupOtp(email,token){const {data,error}=await client().auth.verifyOtp({email,token,type:"signup"});if(error)throw error;return data;}
  async function verifyRecoveryOtp(email,token){const {data,error}=await client().auth.verifyOtp({email,token,type:"recovery"});if(error)throw error;return data;}
  async function resendSignupEmail(email){const {error}=await client().auth.resend({type:"signup",email,options:{emailRedirectTo:callbackUrl()}});if(error)throw error;}
  async function updatePassword(newPassword){const {error}=await client().auth.updateUser({password:newPassword});if(error)throw error;}
  async function signOut(){await client().auth.signOut();window.location.href="index.html";}
  async function ensureUserRow(user){if(!user)return;const {error}=await client().from("users").upsert({id:user.id,email:user.email,email_verified:!!user.email_confirmed_at},{onConflict:"id"});if(error)console.warn("ensureUserRow:",error.message);}
  async function hasProfile(userId){const {data,error}=await client().from("profiles").select("id,display_name,full_name").eq("id",userId).maybeSingle();if(error){console.warn("hasProfile:",error.message);return false;}return !!data;}
  // HomeSync stores administrator status on profiles.is_admin. Do not query
  // the old/nonexistent admin_users table; doing so caused every admin page,
  // including KYC review, to redirect away even when the profile is_admin flag
  // was true.
  async function isAdmin(userId){const {data,error}=await client().from("profiles").select("id,is_admin").eq("id",userId).maybeSingle();if(error){console.warn("isAdmin:",error.message);return false;}return data?.is_admin===true;}
  function reveal(){document.documentElement.style.visibility="visible";var gate=document.getElementById("auth-gate");if(gate)gate.remove();}
  async function isBlocked(userId){const {data,error}=await client().from("users").select("status").eq("id",userId).maybeSingle();if(error||!data)return false;return data.status==="suspended"||data.status==="blocked";}
  async function requireAuth(){const session=await getSession();if(!session){const next=encodeURIComponent(window.location.pathname.split("/").pop());window.location.href=`login.html?next=${next}`;return null;}if(await isBlocked(session.user.id)){await client().auth.signOut();window.location.href="login.html?blocked=1";return null;}reveal();return session;}
  async function requireAdmin(){const session=await getSession();if(!session){const next=encodeURIComponent(window.location.pathname.split("/").pop());window.location.href=`login.html?next=${next}`;return null;}const admin=await isAdmin(session.user.id);if(!admin){window.location.href="dashboard.html";return null;}reveal();return session;}
  async function redirectIfAuthed(target="dashboard.html"){const session=await getSession();if(session)window.location.href=target;}
  return {getSession,getUser,signUpWithEmail,signInWithEmail,signInWithGoogle,sendPasswordReset,verifySignupOtp,verifyRecoveryOtp,resendSignupEmail,updatePassword,signOut,ensureUserRow,hasProfile,isAdmin,isBlocked,requireAuth,requireAdmin,redirectIfAuthed,reveal};
})();
