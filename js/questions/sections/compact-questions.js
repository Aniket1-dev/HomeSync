/* HomeSync AI — market-informed 15-question roommate compatibility questionnaire.
   Research signals: users want lifestyle fit, affordability, location/commute, move-in timing,
   verification/safety, and fast comparison rather than long surveys. */
window.HOMESYNC_QUESTIONS = [
  {id:"01-routine",title:"Daily Routine",questions:[
    {id:"sleep_time",prompt:"What time do you usually go to bed?",type:"choice",options:["Before 10 PM","10 PM–12 AM","12–2 AM","After 2 AM"],weight:1.5},
    {id:"wake_time",prompt:"What time do you usually wake up?",type:"choice",options:["Before 6 AM","6–8 AM","8–10 AM","After 10 AM"],weight:1.3},
    {id:"study_work_schedule",prompt:"How do you usually spend your evenings at home?",type:"choice",options:["Quiet study/work","Mostly relaxing","Socializing/entertainment","Mixed depending on the day"],weight:1.2}
  ]},
  {id:"02-home",title:"Home & Cleanliness",questions:[
    {id:"clean_room",prompt:"How tidy should shared spaces be?",type:"scale",options:["Relaxed","Moderately tidy","Very tidy","Spotless"],weight:1.6},
    {id:"dishes",prompt:"How quickly should dishes be washed?",type:"choice",options:["Immediately","Same day","Within 24 hours","Whenever needed"],weight:1.4},
    {id:"shared_cleaning",prompt:"How should chores be divided?",type:"choice",options:["Equal rotation","Weekly rotation","Split by preference","Discuss each task"],weight:1.4}
  ]},
  {id:"03-social",title:"Social Life & Boundaries",questions:[
    {id:"guest_frequency",prompt:"How often are you comfortable having friends over?",type:"choice",options:["Rarely","Occasionally","A few times a week","Very often"],weight:1.5},
    {id:"social_energy",prompt:"Which best describes your home personality?",type:"choice",options:["Very private","Quiet but friendly","Social","Very outgoing"],weight:1.2},
    {id:"noise_conflict",prompt:"If your roommate is making too much noise, what would you do?",type:"choice",options:["Avoid confrontation","Politely discuss it","Address it directly","Set a clear house rule"],weight:1.4}
  ]},
  {id:"04-lifestyle",title:"Lifestyle & Shared Living",questions:[
    {id:"smoking_home",prompt:"What is your preference about smoking/vaping inside the home?",type:"choice",options:["Absolutely not","Only outside","Occasionally is okay","I don't mind"],weight:1.8},
    {id:"cooking_frequency",prompt:"How often do you cook at home?",type:"choice",options:["Almost never","1–2 times a week","Most days","Daily"],weight:1.1},
    {id:"personal_space",prompt:"How much personal space do you prefer?",type:"choice",options:["A lot of privacy","Balanced privacy","I enjoy shared time","Very social/shared"],weight:1.5}
  ]},
  {id:"05-search-priorities",title:"Search Priorities",questions:[
    {id:"move_in_timing",prompt:"How soon do you need to move in?",type:"choice",options:["Just exploring","Within 2–3 months","Within 1 month","ASAP"],weight:1.5},
    {id:"commute_priority",prompt:"How important is a short commute to college/work?",type:"choice",options:["Not important","Nice to have","Very important","Must be within ~30 minutes"],weight:1.4},
    {id:"verification_priority",prompt:"How important is it that a roommate/profile is verified?",type:"choice",options:["Not a deciding factor","Prefer verified","Very important","I only want verified profiles"],weight:1.7}
  ]}
];
