/* dos-data.jsx — fake show data + helpers */

const TONIGHT = {
  id: 'show-1',
  date: '2026-04-25',           // today
  venue: 'The Mohawk',
  city: 'Austin, TX',
  address: '912 Red River St, Austin TX 78701',
  cap: '900',
  guestList: 14,
  tour: 'Spring Routing',

  // day-of-show contact
  dos: {
    name: 'Katie Ramírez',
    role: 'Talent buyer',
    phone: '(512) 478-0226',
  },

  // schedule entries — times in "HH:MM" 24h, today
  schedule: [
    { id: 'load-in',     time: '14:30', label: 'Load in',          kind: 'load_in' },
    { id: 'soundcheck',  time: '16:00', label: 'Soundcheck',       kind: 'soundcheck' },
    { id: 'meal',        time: '18:00', label: 'Catering',         kind: 'meal' },
    { id: 'doors',       time: '18:30', label: 'Doors',            kind: 'doors' },
    { id: 'opener',      time: '19:30', label: 'Opener — Pines',   kind: 'opener' },
    { id: 'set',         time: '21:30', label: 'Set',              kind: 'set', is_band: true, note: '75 min' },
    { id: 'curfew',      time: '23:00', label: 'Curfew',           kind: 'curfew' },
    { id: 'load-out',    time: '23:30', label: 'Load out',         kind: 'load_out' },
  ],

  // hotel — only fields that actually exist on the Show row
  hotel: {
    name: 'Carpenter Hotel',
    address: '400 Josephine St, Austin TX',
    distance: '3.2 mi',
    checkIn: '15:00',
    confirmation: 'CARP-04251',
    roomBlock: '4 rooms · "Mohawk band"',
  },
};

/* ---- time helpers ---- */
function hmToMinutes(hm){ const [h,m] = hm.split(':').map(Number); return h*60+m; }
function minutesToHM(mins){
  mins = ((mins % (24*60)) + 24*60) % (24*60);
  const h = Math.floor(mins/60), m = mins%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function fmt12(hm){
  const [h,m] = hm.split(':').map(Number);
  const period = h>=12?'PM':'AM';
  const hh = ((h+11)%12)+1;
  return `${hh}:${String(m).padStart(2,'0')} ${period}`;
}
function fmt12short(hm){
  const [h,m] = hm.split(':').map(Number);
  const period = h>=12?'pm':'am';
  const hh = ((h+11)%12)+1;
  return m===0 ? `${hh} ${period}` : `${hh}:${String(m).padStart(2,'0')} ${period}`;
}

/* Given a clock time (mins from 00:00) and the schedule, return:
   - currentIdx: last entry whose time <= now (or -1 before load-in)
   - nextIdx:    first entry whose time > now (or null after end)
*/
function computeScheduleState(nowMin, schedule){
  let currentIdx = -1, nextIdx = null;
  for(let i=0; i<schedule.length; i++){
    const t = hmToMinutes(schedule[i].time);
    if(t <= nowMin) currentIdx = i;
    else if(nextIdx === null) nextIdx = i;
  }
  return {currentIdx, nextIdx};
}

/* Determine phase from clock + flags.
   Phase 1: pre-show — band's set hasn't passed AND not settled
   Phase 2: settle — set has passed (or load-out checked) AND not settled
   Phase 3: post-settle — settled = true
*/
function computePhase(state){
  if(state.settled) return 3;
  const setEntry = TONIGHT.schedule.find(s => s.is_band);
  const setTime = hmToMinutes(setEntry.time);
  // promote to phase 2 once 90 min after the set's start time has passed (set + curfew window),
  // OR if the load-out is checked
  const loadOutChecked = state.checked && state.checked['load-out'];
  if(loadOutChecked) return 2;
  if(state.nowMin >= setTime + 90) return 2;
  return 1;
}

window.DOS_DATA = TONIGHT;
window.dosHelpers = { hmToMinutes, minutesToHM, fmt12, fmt12short, computeScheduleState, computePhase };
