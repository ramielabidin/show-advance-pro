/* InlineEdits.jsx — field edit state treatments */

/* V1 — Current: textarea stack with Save/Cancel buttons (matches repo) */
function InlineEditCurrent({label, value, onSave, onCancel, multiline=true}){
  const [draft, setDraft] = useState(value||'');
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div>
      <Tag value={draft} onChange={e=>setDraft(e.target.value)} autoFocus
        style={{
          width:'100%', minHeight: multiline?80:36, padding:10, borderRadius:8,
          border:'1px solid hsl(var(--input))', background:'hsl(var(--background))',
          color:'hsl(var(--foreground))', fontFamily:'var(--font-sans)', fontSize:13,
          lineHeight:1.5, resize: multiline?'vertical':'none', outline:'none',
        }}/>
      <div style={{display:'flex', gap:8, marginTop:8}}>
        <Button size="sm" onClick={()=>onSave(draft)}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/* V2 — Invisible-chrome inline edit
   No visible box; text just becomes editable in place. A thin underline
   appears and keyboard hints float at the end of the line (⏎ save · Esc).
   Matches the "aggressively inline-editable" ethos without the form-feel.
*/
function InlineEditInvisible({value, onSave, onCancel, multiline=false}){
  const [draft, setDraft] = useState(value||'');
  const ref = useRef(null);
  useEffect(()=>{ ref.current?.focus(); ref.current?.select?.(); },[]);
  const Tag = multiline ? 'textarea' : 'input';
  const onKey = (e)=>{
    if(e.key==='Enter' && (!multiline || e.metaKey || e.ctrlKey)){ e.preventDefault(); onSave(draft); }
    if(e.key==='Escape'){ e.preventDefault(); onCancel(); }
  };
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
      <Tag ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={onKey}
        onBlur={()=>onSave(draft)}
        style={{
          flex:1, minWidth:180,
          background:'transparent', border:'none',
          borderBottom:'1px dashed hsl(var(--foreground)/0.4)',
          outline:'none', padding:'4px 0',
          fontFamily:'var(--font-sans)', fontSize:13, color:'hsl(var(--foreground))',
          resize: multiline?'vertical':'none', minHeight: multiline?60:'auto',
          lineHeight:1.5,
        }}/>
      <span style={{fontSize:11, color:'hsl(var(--muted-foreground)/0.7)', letterSpacing:'0.04em', display:'inline-flex', gap:10}}>
        <span><kbd style={kbd}>⏎</kbd> save</span>
        <span><kbd style={kbd}>esc</kbd> cancel</span>
      </span>
    </div>
  );
}
const kbd = {display:'inline-block', padding:'1px 5px', borderRadius:4, border:'1px solid hsl(var(--border))', background:'hsl(var(--muted)/0.4)', fontFamily:'var(--font-mono)', fontSize:10};

/* V3 — Focused capsule with trailing actions
   Rounded input with icons inline on the right (✕ cancel · ✓ save).
   Keyboard hints at left. Feels like a command-bar edit.
*/
function InlineEditCapsule({value, onSave, onCancel, placeholder='', multiline=false}){
  const [draft, setDraft] = useState(value||'');
  const ref = useRef(null);
  useEffect(()=>{ ref.current?.focus(); },[]);
  const onKey = (e)=>{
    if(e.key==='Enter' && (!multiline || e.metaKey || e.ctrlKey)){ e.preventDefault(); onSave(draft); }
    if(e.key==='Escape'){ e.preventDefault(); onCancel(); }
  };
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div style={{
      display:'flex', alignItems: multiline?'flex-start':'center', gap:6,
      border:'1px solid hsl(var(--ring))', borderRadius:10,
      background:'hsl(var(--background))',
      boxShadow:'0 0 0 3px hsl(var(--ring)/0.12)',
      padding:'4px 4px 4px 12px',
      transition:'all 150ms var(--ease-out)',
    }}>
      <Tag ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={onKey}
        placeholder={placeholder}
        style={{
          flex:1, border:'none', outline:'none', background:'transparent',
          fontFamily:'var(--font-sans)', fontSize:13, color:'hsl(var(--foreground))',
          padding: multiline?'6px 0':'8px 0', resize: multiline?'vertical':'none',
          minHeight: multiline?60:'auto', lineHeight:1.5,
        }}/>
      <button type="button" onClick={onCancel}
        style={{width:28, height:28, border:'none', background:'transparent', borderRadius:6, cursor:'pointer', color:'hsl(var(--muted-foreground))', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
        <Icon name="x" size={14}/>
      </button>
      <button type="button" onClick={()=>onSave(draft)}
        style={{height:28, padding:'0 10px', border:'none', background:'hsl(var(--foreground))', color:'hsl(var(--background))', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:4}}>
        <Icon name="check" size={12}/> Save
      </button>
    </div>
  );
}

/* Schedule row — editorial variant: bigger time slot, label underline,
   drag handle + band mic icon on right, inline among read rows. */
function ScheduleRowEditorial({time, label, isBand, onChange, onRemove, TimePicker}){
  return (
    <div style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'center', padding:'8px 0'}}>
      <div><TimePicker value={time} onChange={t=>onChange({time:t})}/></div>
      <input value={label} onChange={e=>onChange({label:e.target.value})} placeholder="Activity"
        style={{border:'none', borderBottom:'1px dashed hsl(var(--foreground)/0.3)', background:'transparent', outline:'none', fontSize:14, padding:'6px 0', color:'hsl(var(--foreground))', fontFamily:'var(--font-sans)'}}/>
      <div style={{display:'inline-flex', gap:2}}>
        <button type="button" onClick={()=>onChange({band:!isBand})}
          title={isBand?'Artist set':'Mark as artist set'}
          style={{width:32, height:32, border:'none', background:'transparent', borderRadius:6, cursor:'pointer', color: isBand?'var(--pastel-green-fg)':'hsl(var(--muted-foreground)/0.5)'}}>
          <Icon name="mic" size={14}/>
        </button>
        <button type="button" onClick={onRemove}
          style={{width:32, height:32, border:'none', background:'transparent', borderRadius:6, cursor:'pointer', color:'hsl(var(--muted-foreground))'}}>
          <Icon name="trash-2" size={14}/>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { InlineEditCurrent, InlineEditInvisible, InlineEditCapsule, ScheduleRowEditorial });
