/* dos-dashboard.jsx — minimal dashboard so the entry point feels real.
   The glowing mic chip is the entry into Day of Show Mode.
   Three placements supported via prop: 'header' | 'card' | 'fab' */

const { Icon: D_Icon, Eyebrow: D_Eyebrow, Chip: D_Chip, MicChip: D_MicChip, StatusBar: D_StatusBar } = window.dosUI;

function Dashboard({onEnterDOS, dosActive, micPlacement='card', clock, isShowDay=true, isSettled=false}){
  const tonight = window.DOS_DATA;
  // Visibility rules: chip is shown only on a show day that hasn't been settled.
  const chipVisible = isShowDay && !isSettled;
  return (
    <div style={{
      height:'100%',
      background:'hsl(var(--background))',
      display:'flex', flexDirection:'column',
      overflow:'hidden',
    }}>
      <D_StatusBar clock={clock}/>

      {/* Header */}
      <div style={{padding:'8px 22px 0', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{
          fontFamily:'var(--font-display)',
          fontSize:22, letterSpacing:'-0.01em',
          color:'hsl(var(--foreground))',
        }}>Advance</div>
        <div style={{display:'flex', gap:6, color:'hsl(var(--muted-foreground))'}}>
          <button style={iconBtn} aria-label="Search"><D_Icon name="search" size={17} stroke={1.75}/></button>
          <button style={iconBtn} aria-label="Notifications"><D_Icon name="bell" size={17} stroke={1.75}/></button>
        </div>
      </div>

      {/* Greeting + (optionally) header mic */}
      <div style={{padding:'18px 22px 4px'}}>
        <D_Eyebrow style={{marginBottom:6}}>Friday · Apr 25</D_Eyebrow>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
          <h1 style={{
            font:'500 26px/1.1 var(--font-sans)',
            letterSpacing:'-0.02em',
            color:'hsl(var(--foreground))',
            margin:0,
          }}>Good evening.</h1>
          {micPlacement === 'header' && chipVisible && (
            <D_MicChip label="Day of Show" onClick={onEnterDOS}/>
          )}
        </div>
        <p style={{
          fontSize:13, color:'hsl(var(--muted-foreground))',
          marginTop:8,
        }}>{isShowDay ? (isSettled ? "Show settled. Drive safe." : "Tonight you're in Austin.") : "No show today — Paper Tiger in 2 days."}</p>
      </div>

      {/* Body */}
      <div style={{flex:1, overflow:'auto', padding:'18px 18px 24px'}} className="stagger">

        {/* Tonight card */}
        <div style={{
          background: 'hsl(var(--card))',
          border:'1px solid hsl(var(--border))',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 12,
          position:'relative',
        }}>
          {micPlacement === 'card' && chipVisible && (
            <div style={{
              position:'absolute', top:-12, left:14,
            }}>
              <D_MicChip label="Day of Show" onClick={onEnterDOS}/>
            </div>
          )}
          <div style={{display:'flex', alignItems:'center', gap:14, marginTop: micPlacement==='card' && chipVisible ?8:0}}>
            <div style={{textAlign:'center', minWidth:54}}>
              <div style={{
                fontSize:10, textTransform:'uppercase',
                color:'hsl(var(--muted-foreground))',
                fontWeight:500, letterSpacing:'0.12em',
              }}>Apr</div>
              <div style={{
                fontFamily:'var(--font-display)',
                fontSize:34, letterSpacing:'-0.03em', lineHeight:1,
              }}>25</div>
              <div style={{fontSize:10, color:'hsl(var(--muted-foreground))', marginTop:2}}>Fri</div>
            </div>
            <div style={{flex:1, borderLeft:'1px solid hsl(var(--border))', paddingLeft:14, minWidth:0}}>
              <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                <h3 style={{font:'500 16px/1.2 var(--font-sans)', margin:0, color:'hsl(var(--foreground))'}}>{tonight.venue}</h3>
                <D_Chip tone="blue">{tonight.tour}</D_Chip>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:'hsl(var(--muted-foreground))', marginTop:4}}>
                <D_Icon name="map-pin" size={11}/>{tonight.city}
              </div>
              <div style={{display:'flex', gap:18, marginTop:10}}>
                <Stat label="Doors" value="6:30 pm"/>
                <Stat label="Set" value="9:30 pm"/>
                <Stat label="Cap." value={tonight.cap}/>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming */}
        <div style={{padding:'4px 4px 6px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <D_Eyebrow>This week</D_Eyebrow>
          <span style={{fontSize:12, color:'hsl(var(--muted-foreground))'}}>3 shows</span>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <ShowRow date="Apr 27" weekday="Sun" venue="Paper Tiger" city="San Antonio, TX" badge="New"/>
          <ShowRow date="Apr 29" weekday="Tue" venue="House of Blues" city="Houston, TX"/>
          <ShowRow date="May 02" weekday="Fri" venue="White Oak Music Hall" city="Houston, TX"/>
        </div>

        {/* DOS contact bottom hint */}
        <div style={{height:60}}/>
      </div>

      {/* Bottom tab bar */}
      <div style={{
        height:78,
        borderTop:'1px solid hsl(var(--border))',
        background:'hsl(var(--background) / 0.92)',
        backdropFilter:'blur(6px)',
        display:'flex',
        alignItems:'flex-start',
        justifyContent:'space-around',
        padding:'10px 16px 0',
      }}>
        <TabItem icon="calendar" label="Home" active/>
        <TabItem icon="file-text" label="Shows"/>
        <TabItem icon="settings" label="Settings"/>
      </div>

      {/* FAB mic placement */}
      {micPlacement === 'fab' && chipVisible && (
        <div style={{
          position:'absolute',
          right:18, bottom:96,
        }}>
          <D_MicChip size="big" label="Day of Show" onClick={onEnterDOS}/>
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  width:34, height:34, borderRadius:999,
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  background:'transparent', border:0,
  color:'hsl(var(--muted-foreground))',
  cursor:'pointer',
};

function Stat({label, value}){
  return (
    <div>
      <div style={{
        font:'500 9.5px/1 var(--font-sans)',
        textTransform:'uppercase', letterSpacing:'0.14em',
        color:'hsl(var(--muted-foreground))', marginBottom:4,
      }}>{label}</div>
      <div style={{fontFamily:'var(--font-mono)', fontSize:13, fontWeight:500}}>{value}</div>
    </div>
  );
}

function ShowRow({date, weekday, venue, city, badge}){
  const [m, d] = date.split(' ');
  return (
    <div className="pressable" style={{
      background:'hsl(var(--card))',
      border:'1px solid hsl(var(--border))',
      borderRadius:12,
      padding:'10px 12px',
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{textAlign:'center', width:42}}>
        <div style={{fontSize:9.5, textTransform:'uppercase', letterSpacing:'0.12em', color:'hsl(var(--muted-foreground))', fontWeight:500}}>{m}</div>
        <div style={{fontFamily:'var(--font-display)', fontSize:20, letterSpacing:'-0.03em', lineHeight:1}}>{d}</div>
        <div style={{fontSize:9.5, color:'hsl(var(--muted-foreground))', marginTop:1}}>{weekday}</div>
      </div>
      <div style={{flex:1, borderLeft:'1px solid hsl(var(--border))', paddingLeft:12, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{font:'500 13.5px/1.1 var(--font-sans)'}}>{venue}</span>
          {badge && <D_Chip tone="new"><D_Icon name="sparkles" size={9}/> {badge}</D_Chip>}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:'hsl(var(--muted-foreground))', marginTop:2}}>
          <D_Icon name="map-pin" size={10}/>{city}
        </div>
      </div>
      <D_Icon name="chevron-right" size={14} style={{color:'hsl(var(--muted-foreground))'}}/>
    </div>
  );
}

function TabItem({icon, label, active}){
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:3,
      color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
      fontSize:10.5, fontWeight: 500,
    }}>
      <D_Icon name={icon} size={20} stroke={active?2:1.6}/>
      <span>{label}</span>
    </div>
  );
}

window.DOSDashboard = Dashboard;
