/* Settings.jsx */
function Settings(){
  const [tab, setTab] = React.useState('team');
  const tabs = [
    {id:'team',l:'Team'}, {id:'touring',l:'Touring party'}, {id:'contacts',l:'Contacts'},
    {id:'documents',l:'Documents'}, {id:'integrations',l:'Integrations'},
  ];
  return (
    <div style={{maxWidth:920,margin:'0 auto'}}>
      <PageTitle eyebrow="Settings" subline="Team, touring party, integrations.">Settings</PageTitle>

      <div style={{display:'flex',gap:4,borderBottom:'1px solid hsl(var(--border))',marginBottom:22,overflowX:'auto'}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'10px 14px',fontSize:13,fontWeight:500,border:0,background:'transparent',cursor:'pointer',whiteSpace:'nowrap',
            color: tab===t.id?'hsl(var(--foreground))':'hsl(var(--muted-foreground))',
            borderBottom:'2px solid '+(tab===t.id?'hsl(var(--foreground))':'transparent'),
            marginBottom:-1,transition:'color 160ms var(--ease-out), border-color 160ms var(--ease-out)',
          }}>{t.l}</button>
        ))}
      </div>

      {tab==='team' && <TeamSection/>}
      {tab==='touring' && <TouringSection/>}
      {tab==='contacts' && <ContactsSection/>}
      {tab==='documents' && <DocsSection/>}
      {tab==='integrations' && <IntegrationsSection/>}
    </div>
  );
}
window.Settings = Settings;

function TeamSection(){
  const members = [
    {name:'Ramie Labidin', email:'ramie@band.fm', role:'Owner'},
    {name:'Jesse Aldana', email:'jesse@band.fm', role:'Member'},
  ];
  return (
    <div>
      <SectionLabel>Members</SectionLabel>
      <Card style={{padding:0}}>
        {members.map((m,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:i<members.length-1?'1px solid hsl(var(--border) / 0.6)':'none'}}>
            <div style={{width:32,height:32,borderRadius:999,background:'hsl(var(--muted))',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:500,color:'hsl(var(--muted-foreground))'}}>{m.name.split(' ').map(n=>n[0]).join('')}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:500}}>{m.name}</div>
              <div style={{fontSize:12,color:'hsl(var(--muted-foreground))',fontFamily:'var(--font-mono)'}}>{m.email}</div>
            </div>
            <Chip tone={m.role==='Owner'?'blue':'muted'}>{m.role}</Chip>
          </div>
        ))}
      </Card>
      <div style={{marginTop:12}}>
        <Button variant="outline"><Icon name="user-plus" size={14}/>Invite member</Button>
      </div>
    </div>
  );
}
function TouringSection(){
  const ppl = [
    {name:'Lane Hart', role:'Drums', phone:'(415) 555 0187'},
    {name:'Sage Okafor', role:'Bass', phone:'(718) 555 0229'},
    {name:'Nico Valdés', role:'FOH', phone:'(323) 555 0411'},
    {name:'Ruby Tan', role:'Photo', phone:'(646) 555 0903'},
  ];
  return (
    <div>
      <SectionLabel>Touring party</SectionLabel>
      <Card style={{padding:0}}>
        {ppl.map((p,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 120px 160px',gap:14,padding:'13px 16px',alignItems:'center',borderBottom:i<ppl.length-1?'1px solid hsl(var(--border) / 0.6)':'none'}}>
            <div style={{fontSize:14,fontWeight:500}}>{p.name}</div>
            <Chip tone="muted">{p.role}</Chip>
            <div style={{fontFamily:'var(--font-mono)',fontSize:12.5,color:'hsl(var(--muted-foreground))'}}>{p.phone}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
function ContactsSection(){ return <Card style={{padding:22,textAlign:'center',color:'hsl(var(--muted-foreground))',fontSize:13}}>No contacts yet. Import from a .csv or add one manually.</Card>; }
function DocsSection(){
  const docs = [{n:'W-9 (band).pdf',sz:'38 KB'},{n:'Rider 2026.pdf',sz:'212 KB'},{n:'Stage plot v4.png',sz:'182 KB'}];
  return (
    <Card style={{padding:0}}>
      {docs.map((d,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<docs.length-1?'1px solid hsl(var(--border) / 0.6)':'none'}}>
          <Icon name="file" size={15} className=""/>
          <div style={{flex:1,fontSize:13.5,fontWeight:500}}>{d.n}</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:11.5,color:'hsl(var(--muted-foreground))'}}>{d.sz}</div>
        </div>
      ))}
    </Card>
  );
}
function IntegrationsSection(){
  const ints = [
    {n:'Slack', sub:'Push day sheets to a channel', on:true},
    {n:'Email forwarding', sub:'advance@ramie.mail.advance.tm', on:true},
    {n:'Google Maps', sub:'Drive-time auto-calc', on:true},
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {ints.map((x,i)=>(
        <Card key={i} style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:16}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{x.n}</div>
            <div style={{fontSize:12.5,color:'hsl(var(--muted-foreground))',marginTop:2}}>{x.sub}</div>
          </div>
          <Chip tone={x.on?'green':'muted'}>{x.on?'Connected':'Disconnected'}</Chip>
        </Card>
      ))}
    </div>
  );
}
