/* AppChrome.jsx — top nav (desktop) + bottom tab bar (mobile) */
function AppChrome({route, setRoute, dark, setDark, children}){
  const items = [
    {id:'home', icon:'calendar', label:'Home'},
    {id:'shows', icon:'file-text', label:'Shows'},
    {id:'settings', icon:'settings', label:'Settings'},
  ];
  return (
    <div style={{minHeight:'100vh',background:'hsl(var(--background))',paddingBottom:72}}>
      {/* Desktop top nav */}
      <header style={{position:'sticky',top:0,zIndex:50,borderBottom:'1px solid hsl(var(--border))',background:'hsl(var(--background) / 0.85)',backdropFilter:'blur(6px)'}}>
        <div style={{maxWidth:1120,margin:'0 auto',display:'flex',height:56,alignItems:'center',justifyContent:'space-between',padding:'0 24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:28}}>
            <a onClick={()=>setRoute({page:'home'})} style={{fontFamily:'var(--font-display)',fontSize:22,letterSpacing:'-0.01em',color:'hsl(var(--foreground))',cursor:'pointer'}}>Advance</a>
            <nav style={{display:'flex',gap:4}}>
              {items.map(it=>(
                <a key={it.id} onClick={()=>setRoute({page:it.id})} style={{
                  display:'inline-flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:8,
                  fontSize:13,fontWeight:500,cursor:'pointer',
                  background: route.page===it.id?'hsl(var(--secondary))':'transparent',
                  color: route.page===it.id?'hsl(var(--foreground))':'hsl(var(--muted-foreground))',
                  transition:'background-color 160ms var(--ease-out), color 160ms var(--ease-out)',
                }}>
                  <Icon name={it.icon} size={14}/>{it.label}
                </a>
              ))}
            </nav>
          </div>
          <div style={{display:'flex',gap:4,alignItems:'center'}}>
            <button onClick={()=>setDark(d=>!d)} title="Toggle theme" style={{height:32,width:32,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',border:0,background:'transparent',color:'hsl(var(--muted-foreground))',cursor:'pointer'}}>
              <Icon name={dark?'sun':'moon'} size={15}/>
            </button>
            <button style={{height:32,borderRadius:8,display:'inline-flex',alignItems:'center',gap:6,padding:'0 10px',border:0,background:'transparent',color:'hsl(var(--muted-foreground))',fontSize:13,cursor:'pointer'}}>
              <Icon name="log-out" size={14}/>Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{maxWidth:1120,margin:'0 auto',padding:'28px 24px'}} className="fade-in">
        {children}
      </main>
    </div>
  );
}
window.AppChrome = AppChrome;
