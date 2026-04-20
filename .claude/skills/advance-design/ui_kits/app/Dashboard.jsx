/* Dashboard.jsx */
function Dashboard({setRoute, shows}){
  const now = new Date();
  const hr = now.getHours();
  const greet = hr<12 ? 'Good morning' : hr<18 ? 'Good afternoon' : 'Good evening';
  const upcoming = shows.filter(s=>!s.settled).length;
  const settled = shows.filter(s=>s.settled).length;
  const pending = shows.filter(s=>!s.settled && !s.advanced).length;
  const within7 = shows.filter(s=>!s.settled && s.daysAway>=0 && s.daysAway<7).length;
  const next = shows.filter(s=>!s.settled).sort((a,b)=>a.daysAway-b.daysAway)[0];

  return (
    <div>
      <PageTitle eyebrow={greet} subline="Here's what's on the schedule.">Dashboard</PageTitle>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:12,marginBottom:28}} className="stagger">
        <StatTile icon="calendar" tone="blue" label="Upcoming" value={upcoming}/>
        <StatTile icon="check-circle-2" tone="green" label="Settled" value={settled}/>
        <StatTile icon="circle-dashed" tone="yellow" label="Pending" value={pending}/>
        <StatTile icon="alert-triangle" tone="red" label="Within 7 days" value={within7}/>
      </div>

      {next && (
        <div style={{marginBottom:28}}>
          <SectionLabel>Next show</SectionLabel>
          <Card hover onClick={()=>setRoute({page:'show', id:next.id})} style={{padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:22}}>
              <div style={{textAlign:'center',minWidth:78}}>
                <div style={{fontSize:11,textTransform:'uppercase',color:'hsl(var(--muted-foreground))',fontWeight:500,letterSpacing:'0.08em'}}>{next.month}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:40,letterSpacing:'-0.03em',lineHeight:1,marginTop:2}}>{next.day}</div>
                <div style={{fontSize:11,color:'hsl(var(--muted-foreground))',marginTop:4}}>{next.weekday}</div>
              </div>
              <div style={{flex:1,borderLeft:'1px solid hsl(var(--border))',paddingLeft:22}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <h3 style={{fontSize:17,fontWeight:500,fontFamily:'var(--font-sans)',margin:0}}>{next.venue}</h3>
                  {next.tour && <Chip tone="blue">{next.tour}</Chip>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'hsl(var(--muted-foreground))',marginTop:4}}>
                  <Icon name="map-pin" size={12}/>{next.city}
                </div>
                <div style={{display:'flex',gap:18,marginTop:14}}>
                  <div>
                    <div style={{font:'500 10.5px/1 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.1em',color:'hsl(var(--muted-foreground))',marginBottom:4}}>Doors</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:500}}>{next.doors}</div>
                  </div>
                  <div>
                    <div style={{font:'500 10.5px/1 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.1em',color:'hsl(var(--muted-foreground))',marginBottom:4}}>Set</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:500}}>{next.set}</div>
                  </div>
                  <div>
                    <div style={{font:'500 10.5px/1 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.1em',color:'hsl(var(--muted-foreground))',marginBottom:4}}>Cap.</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:500}}>{next.cap}</div>
                  </div>
                </div>
              </div>
              <Dot tone={next.advanced?'green':within7?'red':'yellow'}/>
            </div>
          </Card>
        </div>
      )}

      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <SectionLabel>This week</SectionLabel>
          <a onClick={()=>setRoute({page:'shows'})} style={{fontSize:12,color:'hsl(var(--muted-foreground))',cursor:'pointer'}}>View all →</a>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}} className="stagger">
          {shows.slice(0,4).map(s=>(
            <ShowRow key={s.id} show={s} onClick={()=>setRoute({page:'show', id:s.id})}/>
          ))}
        </div>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;

function ShowRow({show, onClick}){
  const tone = show.advanced?'green':show.daysAway<7?'red':'yellow';
  return (
    <Card hover onClick={onClick} style={{padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
        <div style={{display:'flex',alignItems:'center',gap:16,minWidth:0}}>
          <div style={{textAlign:'center',width:52}}>
            <div style={{fontSize:10.5,textTransform:'uppercase',color:'hsl(var(--muted-foreground))',fontWeight:500}}>{show.month}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:22,letterSpacing:'-0.03em',lineHeight:1}}>{show.day}</div>
            <div style={{fontSize:10.5,color:'hsl(var(--muted-foreground))',marginTop:1}}>{show.weekday}</div>
          </div>
          <div style={{borderLeft:'1px solid hsl(var(--border))',paddingLeft:16,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <h3 style={{fontSize:14,fontWeight:500,margin:0,fontFamily:'var(--font-sans)'}}>{show.venue}</h3>
              {show.tour && <Chip tone="blue">{show.tour}</Chip>}
              {show.unreviewed && <Chip tone="new"><Icon name="sparkles" size={10}/>New</Chip>}
              {show.settled && <Chip tone="green"><Icon name="check-circle-2" size={10}/>Settled</Chip>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'hsl(var(--muted-foreground))',marginTop:2}}>
              <Icon name="map-pin" size={11}/>{show.city}
            </div>
          </div>
        </div>
        <Dot tone={tone}/>
      </div>
    </Card>
  );
}
window.ShowRow = ShowRow;
