/* ShowDetail.jsx — inline-editable show detail */
function ShowDetail({setRoute, show, onUpdate}){
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const start = (k, v) => { setEditing(k); setDraft(v||''); };
  const save = () => { onUpdate({[editing]: draft}); setEditing(null); };
  const cancel = () => setEditing(null);

  return (
    <div style={{maxWidth:760,margin:'0 auto'}}>
      <a onClick={()=>setRoute({page:'shows'})} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'hsl(var(--muted-foreground))',marginBottom:14,cursor:'pointer'}}>
        <Icon name="arrow-left" size={14}/>All shows
      </a>

      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,marginBottom:6,flexWrap:'wrap'}}>
        <div>
          <Eyebrow>{show.month} {show.day} · {show.weekday}</Eyebrow>
          <h1 style={{font:'400 32px/1.05 var(--font-display)',letterSpacing:'-0.02em',color:'hsl(var(--foreground))',margin:0}}>{show.venue}</h1>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:14,color:'hsl(var(--muted-foreground))',marginTop:6}}>
            <Icon name="map-pin" size={13}/>{show.city}
            {show.tour && <Chip tone="blue">{show.tour}</Chip>}
            {!show.advanced && <Chip tone="yellow">Needs advancing</Chip>}
            {show.advanced && !show.settled && <Chip tone="green"><Icon name="check" size={10}/>Advanced</Chip>}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {!show.settled && <Button variant="settle"><Icon name="check-circle-2" size={14}/>Settle show</Button>}
          {!show.advanced && <Button variant="outline"><Icon name="check" size={14}/>Mark as advanced</Button>}
          <Button variant="secondary"><Icon name="share-2" size={14}/>Share</Button>
          <Button variant="ghost" style={{width:36,padding:0}}><Icon name="more-horizontal" size={16}/></Button>
        </div>
      </div>

      {/* drive-time callout */}
      <div style={{display:'flex',alignItems:'flex-start',gap:14,border:'1px solid hsl(var(--border))',background:'hsl(var(--muted) / 0.4)',borderRadius:8,padding:'12px 14px',marginTop:22,marginBottom:26}}>
        <Icon name="car" size={16} className="" />
        <div style={{flex:1}}>
          <div style={{font:'400 26px/1 var(--font-display)',letterSpacing:'-0.02em'}}>{show.driveTime}</div>
          <div style={{font:'500 10.5px/1 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.14em',color:'hsl(var(--muted-foreground))',marginTop:6}}>
            drive from {show.driveFrom}
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div style={{marginBottom:26}}>
        <SectionLabel>Schedule</SectionLabel>
        <Card style={{padding:'12px 14px'}}>
          {show.schedule.map((row,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'70px 1fr auto',gap:12,alignItems:'center',padding:'7px 0',borderBottom:i<show.schedule.length-1?'1px solid hsl(var(--border) / 0.6)':'none'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:500}}>{row.time}</span>
              <span style={{fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                {row.band && <Icon name="mic" size={11}/>}
                {row.label}
              </span>
              {row.note && <span style={{fontSize:12,color:'hsl(var(--muted-foreground))'}}>{row.note}</span>}
            </div>
          ))}
        </Card>
      </div>

      {/* Two-col field groups */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:30,marginBottom:26}}>
        <div>
          <SectionLabel>Venue</SectionLabel>
          <FieldRow label="Address" value={show.address}/>
          <FieldRow label="Capacity" value={show.cap} mono/>
          <FieldRow label="Load in" value={show.loadIn} mono/>
          <FieldRow label="Doors" value={show.doors} mono/>
        </div>
        <div>
          <SectionLabel incomplete={!show.dosEmail}>Day-of contact</SectionLabel>
          <FieldRow label="Name" value={show.dosName}/>
          <FieldRow label="Role" value={show.dosRole}/>
          <FieldRow label="Phone" value={show.dosPhone} mono/>
          <FieldRow label="Email" value={show.dosEmail} empty="Tap to add email" onClick={()=>{}}/>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:30,marginBottom:26}}>
        <div>
          <SectionLabel>Hotel</SectionLabel>
          <FieldRow label="Property" value={show.hotelName}/>
          <FieldRow label="Address" value={show.hotelAddress}/>
          <FieldRow label="Check in" value={show.hotelCheckIn} mono/>
          <FieldRow label="Confirmation" value={show.hotelConf} mono/>
        </div>
        <div>
          <SectionLabel>Financials</SectionLabel>
          <FieldRow label="Guarantee" value={show.guarantee} mono/>
          <FieldRow label="Deal" value={show.deal}/>
          <FieldRow label="Est. walkout" value={show.walkout} mono/>
          <FieldRow label="Tickets sold" value={show.ticketsSold} mono/>
        </div>
      </div>

      <div style={{marginBottom:26}}>
        <SectionLabel>Notes</SectionLabel>
        {editing==='notes' ? (
          <div>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} autoFocus
              style={{width:'100%',minHeight:80,padding:10,borderRadius:8,border:'1px solid hsl(var(--input))',background:'hsl(var(--background))',color:'hsl(var(--foreground))',fontFamily:'var(--font-sans)',fontSize:13,lineHeight:1.5,resize:'vertical'}}/>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <Button size="sm" onClick={save}>Save</Button>
              <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div onClick={()=>start('notes', show.notes)} style={{cursor:'pointer'}}>
            {show.notes ? (
              <p style={{fontSize:14,lineHeight:1.55,color:'hsl(var(--foreground))',margin:0,whiteSpace:'pre-line'}}>{show.notes}</p>
            ) : (
              <p style={{fontSize:13,color:'hsl(var(--muted-foreground)/0.6)',fontStyle:'italic',margin:0}}>Tap to add notes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
window.ShowDetail = ShowDetail;
