/* ShowsList.jsx */
function ShowsList({setRoute, shows}){
  const [tab, setTab] = React.useState('upcoming');
  const [view, setView] = React.useState('all');
  const filtered = shows.filter(s => tab==='upcoming' ? !s.settled : s.settled)
    .filter(s => view==='all' ? true : view==='tour' ? !!s.tour : !s.tour);

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,gap:12,flexWrap:'wrap'}}>
        <PageTitle eyebrow="Shows" subline={`${filtered.length} shows · ${tab}`}>All shows</PageTitle>
        <Button><Icon name="plus" size={14}/>Add show</Button>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18,flexWrap:'wrap'}}>
        <TabBar tab={tab} setTab={setTab}/>
        <div style={{flex:1}}/>
        <ViewPills view={view} setView={setView}/>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}} className="stagger">
        {filtered.map(s=>(
          <ShowRow key={s.id} show={s} onClick={()=>setRoute({page:'show', id:s.id})}/>
        ))}
      </div>
    </div>
  );
}
window.ShowsList = ShowsList;

function TabBar({tab, setTab}){
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:2,border:'1px solid hsl(var(--border))',borderRadius:8,padding:2,background:'hsl(var(--card))'}}>
      {['upcoming','past'].map(t=>(
        <button key={t} onClick={()=>setTab(t)} style={{
          padding:'4px 12px',fontSize:12,fontWeight:500,borderRadius:5,border:0,textTransform:'capitalize',cursor:'pointer',
          background: tab===t?'hsl(var(--foreground))':'transparent',
          color: tab===t?'hsl(var(--background))':'hsl(var(--muted-foreground))',
          transition:'background-color 160ms var(--ease-out), color 160ms var(--ease-out)',
        }}>{t}</button>
      ))}
    </div>
  );
}
function ViewPills({view, setView}){
  return (
    <div style={{display:'inline-flex',gap:6}}>
      {[{id:'all',l:'All'},{id:'tour',l:'On tour'},{id:'standalone',l:'Standalone'}].map(p=>(
        <button key={p.id} onClick={()=>setView(p.id)} style={{
          height:32,padding:'0 12px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',
          background: view===p.id?'hsl(var(--foreground))':'hsl(var(--background))',
          color: view===p.id?'hsl(var(--background))':'hsl(var(--foreground))',
          border:'1px solid '+(view===p.id?'hsl(var(--foreground))':'hsl(var(--input))'),
          transition:'background-color 160ms var(--ease-out), color 160ms var(--ease-out), border-color 160ms var(--ease-out)',
        }}>{p.l}</button>
      ))}
    </div>
  );
}
