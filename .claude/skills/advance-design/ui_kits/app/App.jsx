/* App.jsx — root app with fake data */
const SHOWS = [
  {id:'s1', month:'Mar', day:14, weekday:'Fri', date:'2026-03-14', venue:'The Mohawk', city:'Austin, TX',
   tour:'Spring Routing', advanced:true, settled:false, unreviewed:false, daysAway:3,
   doors:'20:00', set:'21:30', cap:'900', driveTime:'3h 42m', driveFrom:'Dallas, TX', address:'912 Red River St, Austin TX',
   loadIn:'14:30',
   dosName:'Katie Ramírez', dosRole:'Talent buyer', dosPhone:'(512) 478 0226', dosEmail:null,
   hotelName:'Carpenter Hotel', hotelAddress:'400 Josephine St, Austin TX', hotelCheckIn:'15:00', hotelConf:'MOH-03142',
   guarantee:'$1,800', deal:'vs 85% of NBOR', walkout:'$2,140', ticketsSold:'612 / 900',
   notes:'Load-in alley is shared with the venue next door — check in with Katie before parking the van. Green room is upstairs; code for the fridge is 1142.',
   schedule:[
     {time:'14:30',label:'Load in'},
     {time:'16:00',label:'Soundcheck'},
     {time:'18:30',label:'Doors'},
     {time:'19:30',label:'Opener — Pines'},
     {time:'21:30',label:'Set', band:true, note:'75 min'},
     {time:'23:45',label:'Curfew'},
   ]},
  {id:'s2', month:'Mar', day:16, weekday:'Sun', date:'2026-03-16', venue:"Paper Tiger", city:'San Antonio, TX',
   tour:'Spring Routing', advanced:false, settled:false, unreviewed:true, daysAway:5,
   doors:'20:00', set:'22:00', cap:'450', driveTime:'1h 20m', driveFrom:'Austin, TX', address:'2410 N St Marys St',
   loadIn:'15:00',
   dosName:'Alex Medina', dosRole:'Production', dosPhone:'(210) 555 0139', dosEmail:'alex@papertiger.us',
   hotelName:'Emma Hotel', hotelAddress:'136 E Grayson St', hotelCheckIn:'16:00', hotelConf:'EMM-44820',
   guarantee:'$1,200', deal:'flat + door split', walkout:null, ticketsSold:'228 / 450',
   notes:null,
   schedule:[{time:'15:00',label:'Load in'},{time:'18:00',label:'Doors'},{time:'22:00',label:'Set',band:true,note:'60 min'}]},
  {id:'s3', month:'Mar', day:18, weekday:'Tue', date:'2026-03-18', venue:'House of Blues', city:'Houston, TX',
   tour:'Spring Routing', advanced:true, settled:false, unreviewed:false, daysAway:7,
   doors:'19:30', set:'21:00', cap:'1200', driveTime:'3h 08m', driveFrom:'San Antonio, TX', address:'1204 Caroline St',
   loadIn:'13:00',
   dosName:'Marisol Reyes', dosRole:'Advancing', dosPhone:'(832) 555 8811', dosEmail:'marisol@hob.com',
   hotelName:'Hotel Icon', hotelAddress:'220 Main St', hotelCheckIn:'15:00', hotelConf:'ICN-01193',
   guarantee:'$3,200', deal:'vs 80% of NBOR', walkout:'$4,280', ticketsSold:'892 / 1200',
   notes:'Production wants set list 24h before — send tonight.',
   schedule:[{time:'13:00',label:'Load in'},{time:'15:30',label:'Soundcheck'},{time:'19:30',label:'Doors'},{time:'21:00',label:'Set',band:true,note:'90 min'}]},
  {id:'s4', month:'Mar', day:21, weekday:'Fri', date:'2026-03-21', venue:'White Oak Music Hall', city:'Houston, TX',
   tour:null, advanced:false, settled:false, unreviewed:false, daysAway:10,
   doors:'19:00', set:'21:30', cap:'700', driveTime:'—', driveFrom:'Houston, TX', address:'2915 N Main St',
   loadIn:'14:00',
   dosName:null, dosRole:null, dosPhone:null, dosEmail:null,
   hotelName:null, hotelAddress:null, hotelCheckIn:null, hotelConf:null,
   guarantee:'$2,000', deal:'flat', walkout:null, ticketsSold:'—',
   notes:null,
   schedule:[{time:'14:00',label:'Load in'},{time:'19:00',label:'Doors'},{time:'21:30',label:'Set',band:true}]},
  {id:'s5', month:'Feb', day:27, weekday:'Fri', date:'2026-02-27', venue:'Bluebird Theater', city:'Denver, CO',
   tour:'Winter Run', advanced:true, settled:true, unreviewed:false, daysAway:-16,
   doors:'19:30', set:'21:30', cap:'550', driveTime:null, driveFrom:null, address:'3317 E Colfax Ave',
   loadIn:'15:00',
   dosName:'Parker Koo', dosRole:'GM', dosPhone:'(303) 555 1201', dosEmail:'parker@bluebird.com',
   hotelName:'Ramble Hotel', hotelAddress:'1280 25th St', hotelCheckIn:'15:00', hotelConf:'RMB-77212',
   guarantee:'$2,400', deal:'vs 85%', walkout:'$3,087', ticketsSold:'537 / 550',
   notes:'Settled same night. Great crowd.',
   schedule:[{time:'15:00',label:'Load in'},{time:'19:30',label:'Doors'},{time:'21:30',label:'Set',band:true,note:'80 min'}]},
  {id:'s6', month:'Feb', day:25, weekday:'Wed', date:'2026-02-25', venue:'Globe Hall', city:'Denver, CO',
   tour:'Winter Run', advanced:true, settled:true, unreviewed:false, daysAway:-18,
   doors:'20:00', set:'22:00', cap:'250', driveTime:null, driveFrom:null, address:'4483 Logan St',
   loadIn:'16:00',
   dosName:'Kim Farrell', dosRole:'Booker', dosPhone:'(303) 555 6611', dosEmail:'kim@globehall.com',
   hotelName:null, hotelAddress:null, hotelCheckIn:null, hotelConf:null,
   guarantee:'$900', deal:'vs 80%', walkout:'$1,340', ticketsSold:'241 / 250',
   notes:null,
   schedule:[{time:'16:00',label:'Load in'},{time:'20:00',label:'Doors'},{time:'22:00',label:'Set',band:true}]},
];

function App(){
  const initial = (()=>{
    try { return JSON.parse(localStorage.getItem('adv-route')) || {page:'home'}; }
    catch(e) { return {page:'home'}; }
  })();
  const [route, _setRoute] = React.useState(initial);
  const setRoute = (r) => { _setRoute(r); try { localStorage.setItem('adv-route', JSON.stringify(r)); } catch(e){} };

  const [dark, _setDark] = React.useState(() => {
    try { return localStorage.getItem('adv-theme') !== 'light'; } catch(e){ return true; }
  });
  const setDark = (updater) => {
    const v = typeof updater === 'function' ? updater(dark) : updater;
    _setDark(v);
    try { localStorage.setItem('adv-theme', v?'dark':'light'); } catch(e){}
  };
  React.useEffect(()=>{
    document.documentElement.classList.toggle('dark', dark);
  },[dark]);

  const [shows, setShows] = React.useState(SHOWS);
  const show = route.page==='show' ? shows.find(s=>s.id===route.id) : null;
  const updateShow = (id, patch) => setShows(ss => ss.map(s => s.id===id ? {...s, ...patch} : s));

  let body;
  if(route.page==='home')     body = <Dashboard setRoute={setRoute} shows={shows}/>;
  else if(route.page==='shows')   body = <ShowsList setRoute={setRoute} shows={shows}/>;
  else if(route.page==='show' && show)    body = <ShowDetail setRoute={setRoute} show={show} onUpdate={p=>updateShow(show.id,p)}/>;
  else if(route.page==='settings')body = <Settings/>;
  else body = <Dashboard setRoute={setRoute} shows={shows}/>;

  return (
    <AppChrome route={route} setRoute={setRoute} dark={dark} setDark={setDark}>
      <div key={route.page+(route.id||'')} className="fade-in">{body}</div>
    </AppChrome>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);

// re-render lucide after react mount
setTimeout(()=>window.lucide && window.lucide.createIcons(), 80);
setInterval(()=>window.lucide && window.lucide.createIcons(), 800);
