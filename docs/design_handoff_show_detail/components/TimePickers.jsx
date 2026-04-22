/* TimePickers.jsx
   Four edit-state treatments for time + AM/PM.
   Each takes a controlled value like "10:15 PM" and a label to show above.
*/

function parseTime(raw){
  if(!raw) return {h:'', m:'00', a:'AM'};
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(m) return {h:String(parseInt(m[1],10)), m:m[2], a:m[3].toUpperCase()};
  return {h:'', m:'00', a:'AM'};
}
const HOURS = Array.from({length:12},(_,i)=>String(i+1));
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];

/* ============================================================ */
/* V1 — Current (from repo): two shadcn selects + AM/PM segmented
       Baseline reference. Slightly polished: tighter spacing, mono face.
/* ============================================================ */
function TimePickerCurrent({value, onChange}){
  const p = parseTime(value);
  const set = (patch)=>{ const n = {...p, ...patch}; if(n.h) onChange(`${n.h}:${n.m} ${n.a}`); };
  const selStyle = {
    height:36, padding:'0 8px', border:'1px solid hsl(var(--input))',
    borderRadius:8, background:'hsl(var(--background))', fontFamily:'var(--font-mono)',
    fontSize:13, color:'hsl(var(--foreground))', outline:'none',
    appearance:'none', WebkitAppearance:'none',
    backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
    backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center', paddingRight:22,
  };
  return (
    <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
      <select value={p.h} onChange={e=>set({h:e.target.value})} style={{...selStyle, width:64}}>
        <option value="" disabled>--</option>
        {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{fontFamily:'var(--font-mono)', color:'hsl(var(--muted-foreground))'}}>:</span>
      <select value={p.m} onChange={e=>set({m:e.target.value})} style={{...selStyle, width:64}}>
        {MINUTES.map(m=><option key={m} value={m}>{m}</option>)}
      </select>
      <div style={{display:'inline-flex', border:'1px solid hsl(var(--input))', borderRadius:8, overflow:'hidden'}}>
        {['AM','PM'].map(a=>(
          <button key={a} type="button" onClick={()=>set({a})}
            style={{
              padding:'0 10px', height:36, fontSize:12, fontWeight:500, cursor:'pointer',
              border:'none', borderLeft: a==='PM'?'1px solid hsl(var(--input))':'none',
              background: p.a===a?'hsl(var(--primary))':'hsl(var(--background))',
              color: p.a===a?'hsl(var(--primary-foreground))':'hsl(var(--muted-foreground))',
            }}>{a}</button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/* V2 — "Type to set" monospace pill
       One focused input. Mono characters are each a button that
       receives typed digits and arrow-key nudges.
       AM/PM is a single tap target that toggles.
/* ============================================================ */
function TimePickerTypePill({value, onChange}){
  const p = parseTime(value);
  const [h, setH] = useState(p.h || '');
  const [m, setM] = useState(p.m || '');
  const [a, setA] = useState(p.a || 'AM');
  const [focus, setFocus] = useState(null); // 'h' | 'm' | null
  const hRef = useRef(null), mRef = useRef(null);

  useEffect(()=>{ const q = parseTime(value); setH(q.h||''); setM(q.m||'00'); setA(q.a); },[value]);

  const emit = (nh=h, nm=m, na=a)=> { if(nh) onChange(`${nh}:${nm.padStart(2,'0')} ${na}`); };

  const handleHour = (e)=>{
    const d = e.target.value.replace(/\D/g,'').slice(-2);
    setH(d);
    if(d.length===2){ mRef.current?.focus(); }
    emit(d, m, a);
  };
  const handleMin = (e)=>{
    let d = e.target.value.replace(/\D/g,'').slice(-2);
    setM(d);
    emit(h, d.padStart(2,'0'), a);
  };
  const nudge = (key, which)=>{
    if(which==='h'){
      let n = parseInt(h||'0',10);
      if(key==='ArrowUp') n = n>=12 ? 1 : n+1;
      if(key==='ArrowDown') n = n<=1 ? 12 : n-1;
      setH(String(n)); emit(String(n), m, a);
    } else {
      let n = parseInt(m||'0',10);
      if(key==='ArrowUp') n = (n+5) % 60;
      if(key==='ArrowDown') n = (n-5+60) % 60;
      const s = String(n).padStart(2,'0');
      setM(s); emit(h, s, a);
    }
  };

  const active = focus !== null;

  return (
    <div style={{display:'inline-flex', alignItems:'stretch', border:'1px solid '+(active?'hsl(var(--ring))':'hsl(var(--input))'), borderRadius:10, overflow:'hidden', background:'hsl(var(--background))', boxShadow: active?'0 0 0 3px hsl(var(--ring)/0.15)':'none', transition:'all 150ms var(--ease-out)'}}>
      <div style={{display:'flex', alignItems:'center', padding:'0 12px', gap:2, fontFamily:'var(--font-mono)', fontSize:18, letterSpacing:'-0.01em'}}>
        <input ref={hRef}
          value={h} onChange={handleHour}
          onFocus={()=>setFocus('h')} onBlur={()=>setFocus(null)}
          onKeyDown={e=>{ if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault(); nudge(e.key,'h');} }}
          placeholder="--" maxLength={2} inputMode="numeric"
          style={{width:24, textAlign:'center', border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontSize:'inherit', color:'hsl(var(--foreground))', padding:'8px 0'}}/>
        <span style={{color:'hsl(var(--muted-foreground))'}}>:</span>
        <input ref={mRef}
          value={m} onChange={handleMin}
          onFocus={()=>setFocus('m')} onBlur={()=>{ setM(v=>v.padStart(2,'0')); setFocus(null); }}
          onKeyDown={e=>{ if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault(); nudge(e.key,'m');} }}
          placeholder="--" maxLength={2} inputMode="numeric"
          style={{width:24, textAlign:'center', border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontSize:'inherit', color:'hsl(var(--foreground))', padding:'8px 0'}}/>
      </div>
      <button type="button" onClick={()=>{ const n = a==='AM'?'PM':'AM'; setA(n); emit(h,m,n); }}
        style={{
          position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center',
          width:56, borderLeft:'1px solid hsl(var(--border))',
          background:'hsl(var(--muted)/0.5)', cursor:'pointer', border:'none',
          fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color:'hsl(var(--foreground))',
          letterSpacing:'0.04em',
        }}>
        {a}
        <Icon name="chevrons-up-down" size={10} style={{marginLeft:4, opacity:.5}}/>
      </button>
    </div>
  );
}

/* ============================================================ */
/* V3 — Chunky segmented "chips", single-tap everything
       Hour + minute each show their current value as a pill that,
       when tapped, opens a compact popover grid. AM/PM toggles.
       Mobile-first — big hit targets, no keyboard required.
/* ============================================================ */
function TimePickerChips({value, onChange}){
  const p = parseTime(value);
  const [h, setH] = useState(p.h||''), [m, setM] = useState(p.m||'00'), [a, setA] = useState(p.a);
  const [open, setOpen] = useState(null); // 'h'|'m'|null
  useEffect(()=>{ const q=parseTime(value); setH(q.h||''); setM(q.m||'00'); setA(q.a); },[value]);
  const emit = (nh=h, nm=m, na=a)=> { if(nh) onChange(`${nh}:${nm} ${na}`); };

  const chip = (label, active, onClick, width=72)=> (
    <button type="button" onClick={onClick}
      style={{
        height:40, minWidth:width, padding:'0 14px',
        borderRadius:999, border:'1px solid '+(active?'hsl(var(--foreground)/0.6)':'hsl(var(--input))'),
        background: active?'hsl(var(--foreground))':'hsl(var(--background))',
        color: active?'hsl(var(--background))':'hsl(var(--foreground))',
        fontFamily:'var(--font-mono)', fontSize:15, fontWeight:500, cursor:'pointer',
        transition:'all 150ms var(--ease-out)',
      }}>{label}</button>
  );
  const popStyle = {position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:10, background:'hsl(var(--popover))', border:'1px solid hsl(var(--border))', borderRadius:10, padding:8, boxShadow:'0 8px 24px rgba(0,0,0,0.08)'};

  return (
    <div style={{display:'inline-flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      <div style={{position:'relative'}}>
        {chip(h||'--', open==='h', ()=>setOpen(open==='h'?null:'h'))}
        {open==='h' && (
          <div style={popStyle} onMouseLeave={()=>setOpen(null)}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(6, 32px)', gap:2}}>
              {HOURS.map(v=>(
                <button key={v} type="button" onClick={()=>{ setH(v); emit(v,m,a); setOpen('m'); }}
                  style={{height:32, borderRadius:6, border:'none', fontFamily:'var(--font-mono)', fontSize:13, cursor:'pointer',
                    background: h===v?'hsl(var(--foreground))':'transparent', color: h===v?'hsl(var(--background))':'hsl(var(--foreground))'}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <span style={{fontFamily:'var(--font-mono)', color:'hsl(var(--muted-foreground))'}}>:</span>
      <div style={{position:'relative'}}>
        {chip(m, open==='m', ()=>setOpen(open==='m'?null:'m'))}
        {open==='m' && (
          <div style={popStyle} onMouseLeave={()=>setOpen(null)}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(6, 32px)', gap:2}}>
              {MINUTES.map(v=>(
                <button key={v} type="button" onClick={()=>{ setM(v); emit(h,v,a); setOpen(null); }}
                  style={{height:32, borderRadius:6, border:'none', fontFamily:'var(--font-mono)', fontSize:13, cursor:'pointer',
                    background: m===v?'hsl(var(--foreground))':'transparent', color: m===v?'hsl(var(--background))':'hsl(var(--foreground))'}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{display:'inline-flex', height:40, borderRadius:999, border:'1px solid hsl(var(--input))', padding:3, background:'hsl(var(--muted)/0.5)', position:'relative'}}>
        <div style={{position:'absolute', top:3, bottom:3, width:'calc(50% - 3px)', left: a==='AM'?3:'50%', borderRadius:999, background:'hsl(var(--background))', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', transition:'left 180ms var(--ease-out)'}}/>
        {['AM','PM'].map(x=>(
          <button key={x} type="button" onClick={()=>{ setA(x); emit(h,m,x); }}
            style={{position:'relative', zIndex:1, height:34, padding:'0 14px', border:'none', background:'transparent', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:500, cursor:'pointer',
              color: a===x?'hsl(var(--foreground))':'hsl(var(--muted-foreground))'}}>{x}</button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/* V4 — "One slot" editorial
       A single, large, serif display showing the time. Type directly.
       A minimal AM/PM indicator sits underneath.
       Visually matches the editorial stat-cards on the rest of the page.
/* ============================================================ */
function TimePickerEditorial({value, onChange}){
  const p = parseTime(value);
  const [h, setH] = useState(p.h||''), [m, setM] = useState(p.m||'00'), [a, setA] = useState(p.a);
  const [focus, setFocus] = useState(false);
  useEffect(()=>{ const q=parseTime(value); setH(q.h||''); setM(q.m||'00'); setA(q.a); },[value]);
  const emit=(nh=h,nm=m,na=a)=>{ if(nh) onChange(`${nh}:${nm.padStart(2,'0')} ${na}`); };
  const mRef = useRef(null);
  return (
    <div style={{display:'inline-flex', flexDirection:'column', gap:6}}>
      <div style={{
        display:'inline-flex', alignItems:'baseline', padding:'8px 16px 8px 14px',
        borderRadius:10,
        border:'1px solid '+(focus?'hsl(var(--ring))':'hsl(var(--border))'),
        background:'hsl(var(--card))',
        boxShadow: focus?'0 0 0 3px hsl(var(--ring)/0.12)':'none',
        transition:'all 150ms var(--ease-out)',
      }}>
        <input value={h} onChange={e=>{ const d=e.target.value.replace(/\D/g,'').slice(-2); setH(d); if(d.length===2) mRef.current?.focus(); emit(d,m,a); }}
          onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
          placeholder="--" maxLength={2} inputMode="numeric"
          style={{width:42, textAlign:'right', border:'none', outline:'none', background:'transparent',
            fontFamily:'var(--font-display)', fontSize:36, letterSpacing:'-0.03em', color:'hsl(var(--foreground))', padding:0, lineHeight:1}}/>
        <span style={{fontFamily:'var(--font-display)', fontSize:36, color:'hsl(var(--muted-foreground)/0.6)', padding:'0 2px', lineHeight:1}}>:</span>
        <input ref={mRef} value={m} onChange={e=>{ const d=e.target.value.replace(/\D/g,'').slice(-2); setM(d); emit(h, d.padStart(2,'0'), a); }}
          onFocus={()=>setFocus(true)} onBlur={()=>{ setM(v=>v.padStart(2,'0')); setFocus(false); }}
          placeholder="--" maxLength={2} inputMode="numeric"
          style={{width:48, textAlign:'left', border:'none', outline:'none', background:'transparent',
            fontFamily:'var(--font-display)', fontSize:36, letterSpacing:'-0.03em', color:'hsl(var(--foreground))', padding:0, lineHeight:1}}/>
        <div style={{display:'inline-flex', flexDirection:'column', marginLeft:10, justifyContent:'center', gap:2}}>
          {['AM','PM'].map(x=>(
            <button key={x} type="button" onClick={()=>{ setA(x); emit(h,m,x); }}
              style={{
                border:'none', background:'transparent', padding:'2px 6px', cursor:'pointer',
                fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, letterSpacing:'0.08em',
                color: a===x?'hsl(var(--foreground))':'hsl(var(--muted-foreground)/0.5)',
                borderLeft:'2px solid '+(a===x?'hsl(var(--foreground))':'transparent'),
                transition:'color 120ms var(--ease-out)',
                textAlign:'left',
              }}>{x}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/* V5 — "Wheel column" (native feel)
       Three stacked scroll columns with snap. Fits hand on mobile.
       Rendered compactly so it fits in a detail row.
/* ============================================================ */
function TimePickerWheel({value, onChange}){
  const p = parseTime(value);
  const [h, setH] = useState(p.h||'8'), [m, setM] = useState(p.m||'00'), [a, setA] = useState(p.a);
  useEffect(()=>{ const q=parseTime(value); setH(q.h||'8'); setM(q.m||'00'); setA(q.a); },[value]);
  const emit=(nh=h,nm=m,na=a)=>{ if(nh) onChange(`${nh}:${nm} ${na}`); };

  const Col = ({items, val, onPick, width=52})=>{
    const ref = useRef(null);
    const ITEM = 36;
    useEffect(()=>{
      if(!ref.current) return;
      const idx = items.indexOf(val);
      if(idx>=0) ref.current.scrollTop = idx * ITEM;
    },[val]);
    return (
      <div ref={ref}
        onScroll={(e)=>{
          const idx = Math.round(e.currentTarget.scrollTop / ITEM);
          const v = items[Math.max(0, Math.min(items.length-1, idx))];
          if(v !== val) onPick(v);
        }}
        style={{
          width, height: ITEM*3, overflowY:'auto', scrollSnapType:'y mandatory',
          fontFamily:'var(--font-mono)', fontSize:15, textAlign:'center',
          maskImage:'linear-gradient(to bottom, transparent, #000 36px, #000 72px, transparent)',
          WebkitMaskImage:'linear-gradient(to bottom, transparent, #000 36px, #000 72px, transparent)',
          scrollbarWidth:'none',
        }}>
        <style>{`.wheelcol::-webkit-scrollbar{display:none}`}</style>
        <div style={{height: ITEM}}/>
        {items.map(v=>(
          <div key={v} style={{height:ITEM, lineHeight:`${ITEM}px`, scrollSnapAlign:'center',
            color: v===val?'hsl(var(--foreground))':'hsl(var(--muted-foreground)/0.5)',
            fontWeight: v===val?600:400}}>{v}</div>
        ))}
        <div style={{height: ITEM}}/>
      </div>
    );
  };

  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:2, padding:'6px 10px',
      border:'1px solid hsl(var(--border))', borderRadius:12, background:'hsl(var(--card))',
      position:'relative',
    }}>
      <div style={{position:'absolute', top:'50%', left:8, right:8, transform:'translateY(-50%)', height:36, borderTop:'1px solid hsl(var(--border))', borderBottom:'1px solid hsl(var(--border))', pointerEvents:'none'}}/>
      <Col items={HOURS} val={h} onPick={v=>{ setH(v); emit(v,m,a); }}/>
      <span style={{fontFamily:'var(--font-mono)', color:'hsl(var(--muted-foreground))'}}>:</span>
      <Col items={MINUTES} val={m} onPick={v=>{ setM(v); emit(h,v,a); }}/>
      <Col items={['AM','PM']} val={a} onPick={v=>{ setA(v); emit(h,m,v); }} width={44}/>
    </div>
  );
}

Object.assign(window, { TimePickerCurrent, TimePickerTypePill, TimePickerChips, TimePickerEditorial, TimePickerWheel });
