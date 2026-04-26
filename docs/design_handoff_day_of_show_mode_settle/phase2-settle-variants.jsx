/* phase2-settle-variants.jsx — alternate Settle CTA treatments.
   Each variant renders the entire Phase 2 surface with a different settle block. */

const { Icon: SV_Icon, Eyebrow: SV_Eyebrow } = window.dosUI;
const { hmToMinutes, fmt12short } = window.dosHelpers;

/* Shared chrome — top mic + X. Body has the variable settle block, then hotel teaser, then DNA timeline footer (since user picked C). */
function SettleFrame({settle}){
  const data = window.DOS_DATA;
  return (
    <div style={{height:'100%', overflow:'hidden', display:'flex', flexDirection:'column', background:'hsl(var(--background))'}}>
      <div style={{height: 36}}/>
      <div style={{padding:'4px 18px 0', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'inline-flex', alignItems:'center', gap:8}}>
          <span className="mic-glow-c" style={{
            width:22,height:22,borderRadius:999,
            background:'hsl(var(--badge-new))',
            display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#fff',
          }}><SV_Icon name="mic" size={11} stroke={2.4}/></span>
          <span style={{font:'500 10.5px/1 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.18em', color:'hsl(var(--muted-foreground))'}}>Day of Show</span>
        </div>
        <button style={{width:32, height:32, borderRadius:999, background:'hsl(var(--secondary))', border:'1px solid hsl(var(--border))', color:'hsl(var(--muted-foreground))', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
          <SV_Icon name="x" size={14} stroke={2}/>
        </button>
      </div>

      <div style={{flex:1, padding:'24px 22px 28px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
        <SV_Eyebrow style={{marginBottom:18}}>Show's done.</SV_Eyebrow>

        {settle}

        {/* Hotel teaser */}
        <div style={{marginTop:22}}>
          <SV_Eyebrow style={{marginBottom:8}}>Up next</SV_Eyebrow>
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
              <SV_Icon name="bed" size={17}/>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:'500 14px/1.2 var(--font-sans)'}}>{data.hotel.name}</div>
              <div style={{fontSize:12, color:'hsl(var(--muted-foreground))', marginTop:2}}>
                {data.hotel.distance} away · {data.hotel.roomBlock}
              </div>
            </div>
            <SV_Icon name="chevron-right" size={14} style={{color:'hsl(var(--muted-foreground))'}}/>
          </div>
        </div>

        {/* DNA footer */}
        <div style={{marginTop:'auto'}}>
          <DNAFooter/>
        </div>
      </div>
    </div>
  );
}

function DNAFooter(){
  const data = window.DOS_DATA;
  const items = data.schedule;
  const startMin = hmToMinutes(items[0].time);
  const norm = (t) => { let m = hmToMinutes(t); if(m < startMin) m += 24*60; return m; };
  const endMin = norm(items[items.length-1].time);
  const span = endMin - startMin;
  return (
    <div style={{paddingTop:24}}>
      <div style={{
        font:'500 10px/1 var(--font-sans)',
        textTransform:'uppercase', letterSpacing:'0.18em',
        color:'hsl(var(--muted-foreground))',
        marginBottom:14,
        display:'flex', justifyContent:'space-between', alignItems:'baseline',
      }}>
        <span>Tonight, in full</span>
        <span style={{fontFamily:'var(--font-mono)', textTransform:'none', letterSpacing:0, fontSize:11}}>{items.length} cues</span>
      </div>
      <div style={{position:'relative', height:32}}>
        <div style={{position:'absolute', top:'50%', left:0, right:0, height:1, background:'hsl(var(--border))'}}/>
        {items.map((s, i) => {
          const pos = ((norm(s.time) - startMin) / span) * 100;
          const isBand = s.is_band;
          return (
            <div key={s.id} style={{
              position:'absolute', top:'50%', left:`${pos}%`,
              transform:'translate(-50%, -50%)',
              width: isBand?10:6, height: isBand?10:6,
              borderRadius:999,
              background: isBand ? 'hsl(var(--badge-new))' : 'hsl(var(--muted-foreground))',
              boxShadow: isBand ? '0 0 0 3px hsl(var(--background)), 0 0 0 4px hsl(var(--badge-new) / 0.5)' : '0 0 0 3px hsl(var(--background))',
            }}/>
          );
        })}
      </div>
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

/* ============================================================
   SETTLE TREATMENTS
   ============================================================ */

/* A · The current — for reference */
function SettleCurrent(){
  return (
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
        Open settle <SV_Icon name="arrow-right" size={14} stroke={2}/>
      </div>
    </div>
  );
}

/* B · Quiet typography — no card, no green. The action is the type. */
function SettleQuiet(){
  return (
    <div style={{
      padding:'8px 0 4px',
      display:'flex', flexDirection:'column', gap:14,
    }}>
      <div style={{
        font:'500 10.5px/1 var(--font-sans)',
        textTransform:'uppercase', letterSpacing:'0.22em',
        color:'hsl(var(--muted-foreground))',
      }}>One thing left</div>
      <div style={{
        font:'400 56px/0.95 var(--font-display)',
        letterSpacing:'-0.04em',
        color:'hsl(var(--foreground))',
      }}>Settle the<br/>night.</div>
      <div style={{
        fontSize:13.5,
        color:'hsl(var(--muted-foreground))',
        lineHeight:1.5,
        maxWidth:'34ch',
      }}>Count the door, close the books, save your numbers. About five minutes.</div>

      {/* The action is a thin underlined line, not a button */}
      <button className="pressable" style={{
        marginTop:8,
        background:'transparent', border:0, padding:0,
        textAlign:'left', cursor:'pointer',
        display:'inline-flex', alignItems:'center', gap:8,
        font:'500 14px/1 var(--font-sans)',
        color:'hsl(var(--success))',
        letterSpacing:'-0.005em',
      }}>
        <span style={{borderBottom:'1px solid hsl(var(--success))', paddingBottom:3}}>Open settle</span>
        <SV_Icon name="arrow-right" size={15} stroke={2}/>
      </button>
    </div>
  );
}

/* C · Receipt — close the books framing. Card has a tabular preview of what
   settle will compute, with a thin perforated edge and a small CTA at bottom. */
function SettleReceipt(){
  return (
    <div style={{
      position:'relative',
      background:'hsl(var(--card))',
      border:'1px solid hsl(var(--border))',
      borderRadius:14,
      padding:'18px 20px 16px',
      overflow:'hidden',
    }}>
      {/* Top-left status pip */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
        <div style={{display:'inline-flex', alignItems:'center', gap:8}}>
          <span style={{width:6, height:6, borderRadius:999, background:'hsl(var(--success))', boxShadow:'0 0 0 4px hsl(var(--success) / 0.18)'}}/>
          <span style={{font:'500 10px/1 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.22em', color:'hsl(var(--muted-foreground))'}}>Ready to close</span>
        </div>
        <span style={{fontFamily:'var(--font-mono)', fontSize:10.5, color:'hsl(var(--muted-foreground))'}}>04 / 25</span>
      </div>

      <div style={{
        font:'400 38px/1 var(--font-display)',
        letterSpacing:'-0.03em',
        color:'hsl(var(--foreground))',
        marginBottom:18,
      }}>Settle the show.</div>

      {/* Tabular preview */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr auto', rowGap:10, columnGap:14,
        fontFamily:'var(--font-mono)', fontSize:12.5,
        color:'hsl(var(--muted-foreground))',
        borderTop:'1px dashed hsl(var(--border))',
        paddingTop:14,
        marginBottom:16,
      }}>
        <span>Door count</span><span>—</span>
        <span>Merch</span><span>—</span>
        <span>Comps & guest</span><span>—</span>
        <span>Net to artist</span><span style={{color:'hsl(var(--foreground))'}}>—</span>
      </div>

      {/* Perforation edge */}
      <div style={{
        position:'relative', height:1, marginBottom:16,
        backgroundImage:'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1.5px)',
        backgroundSize:'8px 1px', backgroundRepeat:'repeat-x',
      }}/>

      <button className="pressable" style={{
        width:'100%',
        background:'hsl(var(--success))',
        color:'#fff',
        border:0, borderRadius:10,
        padding:'13px 16px',
        font:'500 14px/1 var(--font-sans)',
        letterSpacing:'-0.005em',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
        cursor:'pointer',
      }}>
        Open settle <SV_Icon name="arrow-right" size={14} stroke={2}/>
      </button>
    </div>
  );
}

/* D · Spine — flipped polarity. Dark card matches surface; green is just a thin
   left spine accent. Composed, not loud. */
function SettleSpine(){
  return (
    <div style={{
      position:'relative',
      background:'hsl(var(--card))',
      border:'1px solid hsl(var(--border))',
      borderRadius:14,
      padding:'24px 22px 22px 26px',
      overflow:'hidden',
    }}>
      {/* The spine */}
      <div style={{
        position:'absolute', left:0, top:0, bottom:0, width:4,
        background:'hsl(var(--success))',
        boxShadow:'0 0 24px 0 hsl(var(--success) / 0.55)',
      }}/>

      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div style={{font:'500 11px/1 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.18em', color:'hsl(var(--success))'}}>Ready</div>
        <div style={{
          font:'400 38px/1 var(--font-display)',
          letterSpacing:'-0.03em',
          color:'hsl(var(--foreground))',
        }}>Close the night.</div>
        <div style={{
          fontSize:13.5,
          color:'hsl(var(--muted-foreground))',
          lineHeight:1.45,
        }}>Count the door, save your numbers. Five minutes.</div>

        <button className="pressable" style={{
          marginTop:6,
          alignSelf:'flex-start',
          background:'transparent',
          border:'1px solid hsl(var(--border))',
          borderRadius:999,
          padding:'9px 16px 9px 18px',
          color:'hsl(var(--foreground))',
          font:'500 13px/1 var(--font-sans)',
          display:'inline-flex', alignItems:'center', gap:8,
          cursor:'pointer',
        }}>
          Open settle <SV_Icon name="arrow-right" size={13} stroke={2}/>
        </button>
      </div>
    </div>
  );
}

/* E · Slide-to-settle — physical action mirrors the moment. The CTA is a track
   with a knob; you slide right to open settle. (Static here — slid 0%.) */
function SettleSlide(){
  return (
    <div style={{
      display:'flex', flexDirection:'column', gap:14,
      padding:'4px 0',
    }}>
      <div style={{
        font:'500 10.5px/1 var(--font-sans)',
        textTransform:'uppercase', letterSpacing:'0.22em',
        color:'hsl(var(--muted-foreground))',
      }}>Last thing</div>
      <div style={{
        font:'400 44px/1 var(--font-display)',
        letterSpacing:'-0.03em',
        color:'hsl(var(--foreground))',
      }}>Settle this show.</div>
      <div style={{
        fontSize:13.5,
        color:'hsl(var(--muted-foreground))',
        lineHeight:1.45,
      }}>Count the door, save your numbers. About five minutes.</div>

      {/* The slider */}
      <div style={{
        marginTop:10,
        position:'relative',
        height:60,
        borderRadius:999,
        background:'hsl(var(--card))',
        border:'1px solid hsl(var(--border))',
        overflow:'hidden',
      }}>
        {/* Fill hint */}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(90deg, hsl(var(--success) / 0.2) 0%, hsl(var(--success) / 0) 60%)',
        }}/>
        {/* Track label */}
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          font:'500 13px/1 var(--font-sans)',
          color:'hsl(var(--muted-foreground))',
          letterSpacing:'0.04em',
          paddingLeft: 56,
        }}>
          <span style={{textTransform:'uppercase', letterSpacing:'0.22em', fontSize:11}}>Slide to settle</span>
          <SV_Icon name="arrow-right" size={15} stroke={1.6} style={{marginLeft:10, color:'hsl(var(--muted-foreground))', opacity:0.6}}/>
        </div>
        {/* Knob */}
        <div className="mic-glow-c" style={{
          position:'absolute', top:4, left:4,
          width:52, height:52, borderRadius:999,
          background:'hsl(var(--success))',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff',
        }}>
          <SV_Icon name="arrow-right" size={20} stroke={2.2}/>
        </div>
      </div>
    </div>
  );
}

/* Export */
window.SettleVariantA = () => <SettleFrame settle={<SettleCurrent/>}/>;
window.SettleVariantB = () => <SettleFrame settle={<SettleQuiet/>}/>;
window.SettleVariantC = () => <SettleFrame settle={<SettleReceipt/>}/>;
window.SettleVariantD = () => <SettleFrame settle={<SettleSpine/>}/>;
window.SettleVariantE = () => <SettleFrame settle={<SettleSlide/>}/>;
