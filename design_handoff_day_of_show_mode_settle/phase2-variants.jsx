/* phase2-variants.jsx — alternate bottom-of-Phase-2 treatments.
   Each variant renders the entire Phase 2 surface but swaps the bottom block. */

const { Icon: P2_Icon, Eyebrow: P2_Eyebrow } = window.dosUI;
const { hmToMinutes, fmt12short } = window.dosHelpers;

/* Shared chrome — top mic + X, "Show's done." eyebrow, big Settle CTA, hotel teaser.
   Footer is the only thing that varies. */
function Phase2Frame({footer}){
  const data = window.DOS_DATA;
  return (
    <div style={{height:'100%', overflow:'hidden', display:'flex', flexDirection:'column', background:'hsl(var(--background))'}}>
      {/* Status bar */}
      <div style={{height: 36}}/>

      {/* Top chrome */}
      <div style={{padding:'4px 18px 0', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'inline-flex', alignItems:'center', gap:8}}>
          <span className="mic-glow-c" style={{
            width:22,height:22,borderRadius:999,
            background:'hsl(var(--badge-new))',
            display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff',
          }}><P2_Icon name="mic" size={11} stroke={2.4}/></span>
          <span style={{font:'500 10.5px/1 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.18em', color:'hsl(var(--muted-foreground))'}}>Day of Show</span>
        </div>
        <button style={{width:32, height:32, borderRadius:999, background:'hsl(var(--secondary))', border:'1px solid hsl(var(--border))', color:'hsl(var(--muted-foreground))', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
          <P2_Icon name="x" size={14} stroke={2}/>
        </button>
      </div>

      <div style={{flex:1, padding:'24px 22px 28px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <P2_Eyebrow style={{marginBottom:18}}>Show's done.</P2_Eyebrow>

        {/* Settle CTA */}
        <div style={{
          width:'100%',
          background:'hsl(var(--success))',
          borderRadius:18,
          padding:'34px 22px',
          color:'#fff',
          boxShadow:'0 14px 40px hsl(152 60% 30% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.15)',
          display:'flex', flexDirection:'column', gap:14,
        }}>
          <div style={{font:'500 11px/1 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.18em', color:'rgba(255,255,255,0.78)'}}>Wrap it up</div>
          <div style={{font:'400 44px/1 var(--font-display)', letterSpacing:'-0.03em'}}>Settle this show</div>
          <div style={{fontSize:13.5, color:'rgba(255,255,255,0.85)', lineHeight:1.4}}>Count the door, close the night, save your numbers. Five minutes.</div>
          <div style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,0.95)', fontWeight:500}}>
            Open settle <P2_Icon name="arrow-right" size={14} stroke={2}/>
          </div>
        </div>

        {/* Hotel teaser */}
        <div style={{marginTop:22}}>
          <P2_Eyebrow style={{marginBottom:8}}>Up next</P2_Eyebrow>
          <div style={{
            background:'hsl(var(--card))',
            border:'1px solid hsl(var(--border))',
            borderRadius:12,
            padding:'12px 14px',
            display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{
              width:38, height:38, borderRadius:10,
              background:'var(--pastel-blue-bg)',
              color:'var(--pastel-blue-fg)',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}>
              <P2_Icon name="bed" size={17}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:'500 14px/1.2 var(--font-sans)'}}>{data.hotel.name}</div>
              <div style={{fontSize:12, color:'hsl(var(--muted-foreground))', marginTop:2}}>
                {data.hotel.distance} away · {data.hotel.roomBlock}
              </div>
            </div>
            <P2_Icon name="chevron-right" size={14} style={{color:'hsl(var(--muted-foreground))'}}/>
          </div>
        </div>

        {/* Variable footer */}
        <div style={{marginTop:'auto'}}>{footer}</div>
      </div>
    </div>
  );
}

/* ----- Footer A: nothing. Just whitespace. ----- */
function FooterEmpty(){
  return null;
}

/* ----- Footer B: editorial signoff line ----- */
function FooterSignoff(){
  return (
    <div style={{paddingTop:22, textAlign:'center'}}>
      <div style={{
        font:'500 22px/1.3 var(--font-display)',
        letterSpacing:'-0.02em',
        color:'hsl(var(--foreground))',
      }}>
        <span style={{color:'hsl(var(--muted-foreground))'}}>Doors →</span> curfew.
      </div>
      <div style={{
        marginTop:6,
        font:'400 12.5px/1.4 var(--font-sans)',
        color:'hsl(var(--muted-foreground))',
        letterSpacing:'0.005em',
      }}>
        Eight cues. One show down.
      </div>
    </div>
  );
}

/* ----- Footer C: show DNA — thin timeline of dots ----- */
function FooterDNA(){
  const data = window.DOS_DATA;
  const items = data.schedule;
  // Compute 0..1 position along the night for each entry
  const startMin = hmToMinutes(items[0].time);
  // Curfew rolls past midnight. Treat any time < start as "+24h"
  const norm = (t) => {
    let m = hmToMinutes(t);
    if(m < startMin) m += 24*60;
    return m;
  };
  const endMin = norm(items[items.length-1].time);
  const span = endMin - startMin;
  return (
    <div style={{paddingTop:24}}>
      <div style={{
        font:'500 10px/1 var(--font-sans)',
        textTransform:'uppercase',
        letterSpacing:'0.18em',
        color:'hsl(var(--muted-foreground))',
        marginBottom:14,
        display:'flex',
        justifyContent:'space-between',
        alignItems:'baseline',
      }}>
        <span>Tonight, in full</span>
        <span style={{fontFamily:'var(--font-mono)', textTransform:'none', letterSpacing:0, fontSize:11, color:'hsl(var(--muted-foreground))'}}>{items.length} cues</span>
      </div>

      {/* Timeline */}
      <div style={{position:'relative', height:32}}>
        {/* The line */}
        <div style={{
          position:'absolute', top:'50%', left:0, right:0, height:1,
          background:'hsl(var(--border))',
        }}/>
        {/* Dots */}
        {items.map((s, i) => {
          const pos = ((norm(s.time) - startMin) / span) * 100;
          const isBand = s.is_band;
          return (
            <div key={s.id} style={{
              position:'absolute',
              top:'50%', left:`${pos}%`,
              transform:'translate(-50%, -50%)',
              width: isBand?10:6, height: isBand?10:6,
              borderRadius:999,
              background: isBand ? 'hsl(var(--badge-new))' : 'hsl(var(--muted-foreground))',
              boxShadow: isBand ? '0 0 0 3px hsl(var(--background)), 0 0 0 4px hsl(var(--badge-new) / 0.5)' : '0 0 0 3px hsl(var(--background))',
            }}/>
          );
        })}
      </div>

      {/* Time anchors */}
      <div style={{
        display:'flex', justifyContent:'space-between',
        marginTop:6,
        fontFamily:'var(--font-mono)',
        fontSize:10.5,
        color:'hsl(var(--muted-foreground))',
        letterSpacing:'0.02em',
      }}>
        <span>{fmt12short(items[0].time)}</span>
        <span>{fmt12short(items[items.length-1].time)}</span>
      </div>
    </div>
  );
}

/* ----- Footer D: stat trio — quiet numbers ----- */
function FooterStats(){
  return (
    <div style={{
      paddingTop:24,
      borderTop:'1px solid hsl(var(--border) / 0.6)',
      marginTop:24,
      display:'grid',
      gridTemplateColumns:'1fr 1fr 1fr',
      gap:8,
    }}>
      <Stat label="Cues" value="8"/>
      <Stat label="Door to curfew" value="6h 30m"/>
      <Stat label="Curfew" value="12:30 am" mono/>
    </div>
  );
}
function Stat({label, value, mono}){
  return (
    <div>
      <div style={{
        font:'500 9.5px/1 var(--font-sans)',
        textTransform:'uppercase',
        letterSpacing:'0.16em',
        color:'hsl(var(--muted-foreground))',
        marginBottom:6,
      }}>{label}</div>
      <div style={{
        font: mono
          ? '500 13px/1 var(--font-mono)'
          : '500 16px/1 var(--font-display)',
        letterSpacing: mono ? '0.01em' : '-0.02em',
        color:'hsl(var(--foreground))',
      }}>{value}</div>
    </div>
  );
}

/* Export the per-variant artboards */
window.Phase2VariantA = () => <Phase2Frame footer={<FooterEmpty/>}/>;
window.Phase2VariantB = () => <Phase2Frame footer={<FooterSignoff/>}/>;
window.Phase2VariantC = () => <Phase2Frame footer={<FooterDNA/>}/>;
window.Phase2VariantD = () => <Phase2Frame footer={<FooterStats/>}/>;
