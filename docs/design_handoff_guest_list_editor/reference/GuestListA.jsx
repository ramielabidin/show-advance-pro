/* GuestListA.jsx — Read-then-edit row
   The fix:
   - Default state is READ. Each guest renders as a clean text line: "Melvin · +3"
   - Hovering reveals a subtle delete affordance on the row
   - Click anywhere on a row to enter edit mode (single field at a time)
   - "Add guest" stays in edit mode until you blur or press Enter, then commits
   - No global Save button — saves are inline like every other field on ShowDetail
   - Total guest count moves to the section header where it belongs as a summary
*/
function GuestListA({guests, onChange}) {
  const [editingId, setEditingId] = React.useState(null);
  const [draft, setDraft] = React.useState({name:'', plus:0});
  const inputRef = React.useRef(null);

  const total = guests.reduce((a,g)=>a+1+(g.plus||0), 0);

  const startEdit = (g) => { setEditingId(g.id); setDraft({name:g.name, plus:g.plus||0}); };
  // Returns the resulting array (lets us chain into add-next without losing the new row)
  const writeBack = () => {
    if(editingId==null) return guests;
    const name = draft.name.trim();
    let next;
    if(!name){ next = guests.filter(g=>g.id!==editingId); }
    else { next = guests.map(g=>g.id===editingId?{...g,name,plus:Math.max(0,Number(draft.plus)||0)}:g); }
    onChange(next);
    return next;
  };
  const commit = () => { writeBack(); setEditingId(null); };
  const commitAndNext = () => {
    const after = writeBack();
    const id = 'g'+Date.now();
    onChange([...after, {id, name:'', plus:0}]);
    setEditingId(id);
    setDraft({name:'', plus:0});
  };
  const cancel = () => setEditingId(null);
  const remove = (id) => onChange(guests.filter(g=>g.id!==id));
  const add = () => {
    const id = 'g'+Date.now();
    onChange([...guests, {id, name:'', plus:0}]);
    setEditingId(id);
    setDraft({name:'', plus:0});
  };

  React.useEffect(()=>{ if(editingId && inputRef.current) inputRef.current.focus(); },[editingId]);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:2,height:14,borderRadius:2,background:'hsl(var(--foreground)/0.25)'}}/>
          <span style={{font:'500 11px/1.2 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.14em',color:'hsl(var(--muted-foreground))'}}>Guest list</span>
        </div>
        <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'hsl(var(--muted-foreground))',fontFamily:'var(--font-mono)'}}>
          <Icon name="users-round" size={12}/>{total}
        </span>
      </div>

      <Card style={{padding:'4px 0',overflow:'hidden'}}>
        {guests.length===0 && (
          <div style={{padding:'18px 16px',fontSize:13,color:'hsl(var(--muted-foreground)/0.7)',fontStyle:'italic'}}>
            No guests yet. Add one below.
          </div>
        )}
        {guests.map((g,i)=>{
          const isEdit = editingId===g.id;
          return (
            <GuestRowA
              key={g.id}
              guest={g}
              isEdit={isEdit}
              isLast={i===guests.length-1}
              draft={draft}
              setDraft={setDraft}
              startEdit={()=>startEdit(g)}
              commit={commit}
              commitAndNext={commitAndNext}
              cancel={cancel}
              remove={()=>remove(g.id)}
              inputRef={isEdit?inputRef:null}
            />
          );
        })}
        <div className="tap"
             onClick={add}
             style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',borderTop:guests.length?'1px solid hsl(var(--border)/0.6)':'none',color:'hsl(var(--muted-foreground))',fontSize:13}}
             onMouseEnter={e=>e.currentTarget.style.color='hsl(var(--foreground))'}
             onMouseLeave={e=>e.currentTarget.style.color='hsl(var(--muted-foreground))'}>
          <Icon name="plus" size={14}/>Add guest
        </div>
      </Card>

      <div style={{marginTop:14}}>
        <Button variant="outline" size="sm">
          <Icon name="link" size={13}/>Door list link
        </Button>
      </div>
    </div>
  );
}

function GuestRowA({guest, isEdit, isLast, draft, setDraft, startEdit, commit, commitAndNext, cancel, remove, inputRef}){
  const [hover, setHover] = React.useState(false);

  if (isEdit){
    return (
      <div style={{display:'grid',gridTemplateColumns:'1fr 56px 32px',gap:10,alignItems:'center',padding:'8px 12px',borderBottom:isLast?'none':'1px solid hsl(var(--border)/0.6)',background:'hsl(var(--muted)/0.35)'}}>
        <input
          ref={inputRef}
          value={draft.name}
          onChange={e=>setDraft(d=>({...d,name:e.target.value}))}
          onBlur={e=>{
            // If focus is moving to the +N input within the same row, don't commit
            if(e.relatedTarget && e.relatedTarget.dataset && e.relatedTarget.dataset.rowSibling===guest.id) return;
            commit();
          }}
          onKeyDown={e=>{
            if(e.key==='Enter'){ e.preventDefault(); commitAndNext(); }
            else if(e.key==='Escape'){ cancel(); }
          }}
          placeholder="Guest name"
          style={{height:32,padding:'0 10px',border:'1px solid hsl(var(--input))',borderRadius:6,background:'hsl(var(--background))',color:'hsl(var(--foreground))',fontFamily:'var(--font-sans)',fontSize:13,outline:'none'}}
        />
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:12,color:'hsl(var(--muted-foreground))'}}>+</span>
          <input
            type="number" min="0" max="20"
            data-row-sibling={guest.id}
            value={draft.plus}
            onChange={e=>setDraft(d=>({...d,plus:e.target.value}))}
            onBlur={commit}
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); commitAndNext(); } else if(e.key==='Escape') cancel(); }}
            style={{width:42,height:32,padding:'0 8px',border:'1px solid hsl(var(--input))',borderRadius:6,background:'hsl(var(--background))',color:'hsl(var(--foreground))',fontFamily:'var(--font-mono)',fontSize:13,textAlign:'center',outline:'none'}}
          />
        </div>
        <div/>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      onClick={startEdit}
      className="tap"
      style={{display:'grid',gridTemplateColumns:'1fr auto 32px',gap:10,alignItems:'center',padding:'10px 12px 10px 16px',borderBottom:isLast?'none':'1px solid hsl(var(--border)/0.6)',background:hover?'hsl(var(--muted)/0.35)':'transparent'}}
    >
      <span style={{fontSize:14,color:'hsl(var(--foreground))'}}>{guest.name}</span>
      {guest.plus>0 && (
        <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'hsl(var(--muted-foreground))'}}>+{guest.plus}</span>
      )}
      {!guest.plus && <span/>}
      <button
        onClick={e=>{e.stopPropagation(); remove();}}
        aria-label="Remove guest"
        style={{
          width:28,height:28,border:'none',background:'transparent',
          color:'hsl(var(--muted-foreground)/0.6)',
          opacity:hover?1:0,cursor:'pointer',borderRadius:6,
          display:'inline-flex',alignItems:'center',justifyContent:'center',
          transition:'opacity 150ms var(--ease-out), color 150ms var(--ease-out), background-color 150ms var(--ease-out)'
        }}
        onMouseEnter={e=>{e.currentTarget.style.color='hsl(var(--destructive))';e.currentTarget.style.background='hsl(var(--destructive)/0.08)';}}
        onMouseLeave={e=>{e.currentTarget.style.color='hsl(var(--muted-foreground)/0.6)';e.currentTarget.style.background='transparent';}}
      >
        <Icon name="trash-2" size={13}/>
      </button>
    </div>
  );
}

window.GuestListA = GuestListA;
