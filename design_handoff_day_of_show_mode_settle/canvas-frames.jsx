/* canvas-frames.jsx — variants canvas. Renders the prototype's surfaces inside
   small phone frames as static end-states, side-by-side. */

const { Icon: C_Icon, Eyebrow: C_Eyebrow, Chip: C_Chip, MicChip: C_MicChip, StatusBar: C_StatusBar } = window.dosUI;
const { hmToMinutes, fmt12short, computeScheduleState } = window.dosHelpers;

/* ---- Reusable phone wrapper ---- */
function Phone({children}){
  return (
    <div className="pframe">
      <div className="pscreen">
        <div className="pnotch"/>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   ARTBOARDS for the canvas
   ============================================================ */

/* 1. Dashboard — placements + visibility states */
function DashboardArtboard({placement, isShowDay=true, isSettled=false}){
  // pretend clock for status bar
  return (
    <Phone>
      <window.DOSDashboard
        onEnterDOS={() => {}}
        dosActive={false}
        micPlacement={placement}
        isShowDay={isShowDay}
        isSettled={isSettled}
        clock={'7:30'}
      />
    </Phone>
  );
}

/* 2. Phase 1 — pre-show, default countdown treatment */
function Phase1Artboard({clockMin = 17*60+30 /* 5:30pm — 90 mins to doors */}){
  return (
    <Phone>
      <window.DayOfShowMode
        state={{nowMin: clockMin, settled:false, checked:{}}}
        setState={()=>{}}
        onClose={()=>{}}
        hotelVariant="editorial"
      />
    </Phone>
  );
}

/* 2b. Phase 1 — alternate countdown treatment (compact, time-anchored) */
function Phase1AltArtboard({clockMin = 17*60+30}){
  const data = window.DOS_DATA;
  const {currentIdx, nextIdx} = computeScheduleState(clockMin, data.schedule);
  const heroIdx = nextIdx !== null ? nextIdx : currentIdx;
  const hero = data.schedule[heroIdx];
  const heroMin = hmToMinutes(hero.time);
  const remaining = heroMin - clockMin;

  // Format clock
  const h = Math.floor(clockMin/60), m = clockMin%60;
  const period = h>=12?'PM':'AM';
  const hh = ((h+11)%12)+1;
  const clockLbl = `${hh}:${String(m).padStart(2,'0')}`;

  return (
    <Phone>
      <div style={{height:'100%', overflow:'hidden', display:'flex', flexDirection:'column', background:'hsl(var(--background))'}}>
        <C_StatusBar clock={clockLbl}/>

        <div style={{padding:'4px 18px 0', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'inline-flex', alignItems:'center', gap:8}}>
            <span className="mic-glow-c" style={{
              width:22,height:22,borderRadius:999,
              background:'hsl(var(--badge-new))',
              display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff',
            }}><C_Icon name="mic" size={11} stroke={2.4}/></span>
            <span style={{font:'500 10.5px/1 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.18em', color:'hsl(var(--muted-foreground))'}}>Day of Show</span>
          </div>
          <button style={{width:32, height:32, borderRadius:999, background:'hsl(var(--secondary))', border:'1px solid hsl(var(--border))', color:'hsl(var(--muted-foreground))'}}>
            <C_Icon name="x" size={14} stroke={2}/>
          </button>
        </div>

        {/* Time-anchored countdown — set time as hero, distance underneath */}
        <div style={{padding:'30px 22px 8px'}}>
          <C_Eyebrow>Doors at</C_Eyebrow>
          <div style={{
            font:'400 88px/0.9 var(--font-display)',
            letterSpacing:'-0.04em',
            marginTop:14,
            color:'hsl(var(--foreground))',
            display:'flex',
            alignItems:'baseline',
            gap:10,
          }}>
            <span>{((hmToMinutes(hero.time)/60>=12 ? Math.floor(hmToMinutes(hero.time)/60)-12 : Math.floor(hmToMinutes(hero.time)/60)) || 12)}</span>
            <span style={{fontSize:34, color:'hsl(var(--muted-foreground))'}}>:{String(hmToMinutes(hero.time)%60).padStart(2,'0')}</span>
            <span style={{fontSize:24, color:'hsl(var(--muted-foreground))', textTransform:'lowercase'}}>pm</span>
          </div>
          <div style={{
            marginTop:14,
            display:'flex', alignItems:'center', gap:8,
            color:'hsl(var(--muted-foreground))',
            fontSize:14,
          }}>
            <span style={{
              display:'inline-block',
              width:6, height:6, borderRadius:999,
              background:'hsl(var(--badge-new))',
            }}/>
            in {Math.floor(remaining/60)}h {remaining%60}m · {hero.label}
          </div>
        </div>

        {/* Compact schedule */}
        <div style={{padding:'24px 22px 0'}}>
          <C_Eyebrow style={{marginBottom:8}}>Tonight</C_Eyebrow>
          <div style={{
            background:'hsl(var(--card))',
            border:'1px solid hsl(var(--border))',
            borderRadius:12,
            padding:'4px 12px',
          }}>
            {data.schedule.slice(0,6).map((row, i, arr) => {
              const t = hmToMinutes(row.time);
              const isPast = t <= clockMin;
              const isHero = i === heroIdx;
              return (
                <div key={row.id} style={{
                  display:'grid', gridTemplateColumns:'62px 1fr', gap:10,
                  alignItems:'center', padding:'8px 0',
                  borderBottom: i<arr.length-1 ? '1px solid hsl(var(--border) / 0.5)' : 'none',
                  opacity: isPast && !isHero ? 0.42 : 1,
                }}>
                  <span style={{fontFamily:'var(--font-mono)', fontSize:11.5,
                    color: isHero?'hsl(var(--foreground))':'hsl(var(--muted-foreground))',
                    fontWeight: isHero?600:500}}>{fmt12short(row.time)}</span>
                  <span style={{
                    fontSize:13, display:'flex', alignItems:'center', gap:6,
                    color: isHero?'hsl(var(--foreground))':'hsl(var(--muted-foreground))',
                  }}>
                    {row.is_band && <C_Icon name="mic" size={10} style={{color:'hsl(var(--badge-new))'}}/>}
                    {row.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Phone>
  );
}

/* 3. Phase 2 — Settle */
function Phase2Artboard(){
  return (
    <Phone>
      <window.DayOfShowMode
        state={{nowMin: 23*60+45, settled:false, checked:{'load-out':true}}}
        setState={()=>{}}
        onClose={()=>{}}
      />
    </Phone>
  );
}

/* 4. Phase 3 — Post-settle */
function Phase3Artboard({hotelVariant='editorial'}){
  return (
    <Phone>
      <window.DayOfShowMode
        state={{nowMin: 24*60-15, settled:true, checked:{'load-out':true}}}
        setState={()=>{}}
        onClose={()=>{}}
        hotelVariant={hotelVariant}
      />
    </Phone>
  );
}

/* ============================================================
   Compose canvas
   ============================================================ */

function VariantsCanvas(){
  return (
    <DesignCanvas
      title="Day of Show Mode"
      subtitle="Mobile · dark mode · variants for review"
    >
      <DCSection id="phases" title="The four end-states">
        <DCArtboard id="dash-noshow" label="Dashboard · no show today (chip absent)" width={400} height={780}>
          <DashboardArtboard placement="header" isShowDay={false}/>
        </DCArtboard>
        <DCArtboard id="dash" label="Dashboard · show day (chip present)" width={400} height={780}>
          <DashboardArtboard placement="header" isShowDay={true}/>
        </DCArtboard>
        <DCArtboard id="p1" label="Phase 1 — Pre-show" width={400} height={780}>
          <Phase1Artboard/>
        </DCArtboard>
        <DCArtboard id="p2" label="Phase 2 — Settle" width={400} height={780}>
          <Phase2Artboard/>
        </DCArtboard>
        <DCArtboard id="p3" label="Phase 3 — Post-settle" width={400} height={780}>
          <Phase3Artboard hotelVariant="editorial"/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mic" title="Mic chip — visibility cycle (header placement is canonical)">
        <DCArtboard id="mic-noshow" label="1 · No show today — chip hidden" width={400} height={780}>
          <DashboardArtboard placement="header" isShowDay={false}/>
        </DCArtboard>
        <DCArtboard id="mic-show" label="2 · Show day, not settled — chip glows" width={400} height={780}>
          <DashboardArtboard placement="header" isShowDay={true} isSettled={false}/>
        </DCArtboard>
        <DCArtboard id="mic-settled" label="3 · Settled (auto-resolves at 5am next day) — chip hidden" width={400} height={780}>
          <DashboardArtboard placement="header" isShowDay={true} isSettled={true}/>
        </DCArtboard>
      </DCSection>

      <DCSection id="mic-rejected" title="Mic chip — placements explored & rejected">
        <DCArtboard id="mic-card" label="Rejected · pinned to next-show card (reads as a tab)" width={400} height={780}>
          <DashboardArtboard placement="card" isShowDay={true}/>
        </DCArtboard>
        <DCArtboard id="mic-fab" label="Rejected · floating action button (bolted on)" width={400} height={780}>
          <DashboardArtboard placement="fab" isShowDay={true}/>
        </DCArtboard>
      </DCSection>

      <DCSection id="countdown" title="Phase 1 countdown — two treatments">
        <DCArtboard id="cd-display" label="A · serif countdown hero" width={400} height={780}>
          <Phase1Artboard/>
        </DCArtboard>
        <DCArtboard id="cd-time" label="B · time-anchored, then distance" width={400} height={780}>
          <Phase1AltArtboard/>
        </DCArtboard>
      </DCSection>

      <DCSection id="settle-cta" title="Settle CTA — re-imagined (footer = timeline DNA)">
        <DCArtboard id="st-current" label="A · current — green block (for reference)" width={400} height={780}>
          <Phone><window.SettleVariantA/></Phone>
        </DCArtboard>
        <DCArtboard id="st-quiet" label="B · quiet typography (no card, no fill)" width={400} height={780}>
          <Phone><window.SettleVariantB/></Phone>
        </DCArtboard>
        <DCArtboard id="st-receipt" label="C · receipt — close the books" width={400} height={780}>
          <Phone><window.SettleVariantC/></Phone>
        </DCArtboard>
        <DCArtboard id="st-spine" label="D · dark card, green spine" width={400} height={780}>
          <Phone><window.SettleVariantD/></Phone>
        </DCArtboard>
        <DCArtboard id="st-slide" label="E · slide-to-settle (physical action)" width={400} height={780}>
          <Phone><window.SettleVariantE/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="phase2-footer" title="Phase 2 — bottom block treatments (current is verbose recap)">
        <DCArtboard id="p2-empty" label="A · drop the recap (let it breathe)" width={400} height={780}>
          <Phone><window.Phase2VariantA/></Phone>
        </DCArtboard>
        <DCArtboard id="p2-signoff" label="B · editorial signoff (Doors → curfew.)" width={400} height={780}>
          <Phone><window.Phase2VariantB/></Phone>
        </DCArtboard>
        <DCArtboard id="p2-dna" label="C · the night as a thin timeline" width={400} height={780}>
          <Phone><window.Phase2VariantC/></Phone>
        </DCArtboard>
        <DCArtboard id="p2-stats" label="D · three quiet numbers" width={400} height={780}>
          <Phone><window.Phase2VariantD/></Phone>
        </DCArtboard>
      </DCSection>

      <DCSection id="hotel" title="Phase 3 hotel — two treatments">
        <DCArtboard id="ht-edit" label="A · editorial (no map)" width={400} height={780}>
          <Phase3Artboard hotelVariant="editorial"/>
        </DCArtboard>
        <DCArtboard id="ht-map" label="B · with stylized map" width={400} height={780}>
          <Phase3Artboard hotelVariant="map"/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<VariantsCanvas/>);

setTimeout(() => window.lucide && window.lucide.createIcons(), 100);
