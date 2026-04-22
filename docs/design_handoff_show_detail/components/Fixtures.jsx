/* Sample show data used across variants. Mirrors fields from the real
   ShowDetailPage.tsx so layout and empty-states feel accurate. */
const SHOW = {
  month:'NOV', day:'14', weekday:'Friday',
  venue:'The Echo', city:'Los Angeles, CA',
  tour:'West Coast Swing', advanced:false, settled:false,

  // Drive time
  driveFrom:'San Francisco', driveTime:'5h 48m',

  // Day of show contact
  dosName:'Mara Quinn', dosRole:'Production', dosPhone:'(323) 555-0118', dosEmail:'',

  // Departure
  departureTime:'9:15 AM', departureNotes:'Car 1 from hotel, Car 2 meets at venue',

  // Arrival
  loadInDetails:'Load in via Sunset Blvd gate. Venue staff will unlock at 2:45. Do NOT use the alley — it\'s a tight squeeze.',
  parkingNotes:'Two spots reserved behind venue, tell the runner "the band"',

  // Venue
  address:'1822 Sunset Blvd, Los Angeles, CA',
  cap:'350',
  greenRoom:'Upstairs, left of stage. Bathroom shared with bar staff.',
  wifiNetwork:'Echo-Guest',
  wifiPassword:'soundcheck2024',
  hospitality:'Case of water, 12-pack local IPA, hummus + veg, gluten-free crackers for Kai',

  // Accommodations
  hotelName:'Hotel Covell',
  hotelAddress:'4626 Hollywood Blvd, Los Angeles, CA',
  hotelConf:'HTL-9F2K4',
  hotelCheckIn:'4:00 PM',
  hotelCheckOut:'11:00 AM',

  // Schedule (source of truth for load-in, doors, set times)
  schedule:[
    {time:'3:00 PM', label:'Load in'},
    {time:'4:30 PM', label:'Soundcheck'},
    {time:'6:00 PM', label:'Dinner'},
    {time:'8:00 PM', label:'Doors'},
    {time:'9:00 PM', label:'Opener — Paige Howl'},
    {time:'10:15 PM', label:'Set', band:true},
    {time:'11:30 PM', label:'Load out'},
  ],

  // Guest list
  guestListAllotment:'8',
  guestListEntries:[
    {name:'Jesse Park', count:'2'},
    {name:'Robin Lang', count:'1'},
  ],

  // Deal tab
  guarantee:'$2,400',
  backendDeal:'80% of NBOR (plus), then 85% above 300 tickets',
  ticketPrice:'$25',
  capacity:'350',
  tixSold:'248',
  walkout:'$3,150',
  expenses:'$1,200',
  settlementNotes:'',

  // Notes
  notes:'Venue prefers we load in off Sunset, not the alley — gate is tight. FOH is house-provided; bring vocal mics.',
};
window.SHOW = SHOW;
