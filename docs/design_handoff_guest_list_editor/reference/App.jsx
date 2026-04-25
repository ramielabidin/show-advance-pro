/* App.jsx — host page that frames the three guest list explorations */
const { useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "A — Read-then-edit row",
  "showContext": true
}/*EDITMODE-END*/;

const SEED = [
  {id:'g1', name:'Testing', plus:0},
  {id:'g2', name:'Binky', plus:0},
  {id:'g3', name:'Bonko', plus:0},
  {id:'g4', name:'Tinghy Bing Bing', plus:0},
  {id:'g5', name:'Melvin', plus:3},
];

function PageScaffold({children, variant}){
  // Mimics a slice of ShowDetail so the guest list reads in context
  return (
    <div className="stage">
      <p className="doc-eyebrow">Show detail · Guest list editor</p>
      <h1 className="doc-title">Variant {variant}</h1>
      <p className="doc-sub">
        Three explorations of the guest list section. The original was always-in-edit-mode
        with a global Save button that didn't change state. These versions match the rest of
        ShowDetail: read by default, click to edit, autosave on commit.
      </p>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
        <span style={{font:'500 11px/1.2 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.14em',color:'hsl(var(--muted-foreground)/0.7)'}}>03 May · Friday</span>
        <h2 style={{font:'400 32px/1.05 var(--font-display)',letterSpacing:'-0.02em',margin:0}}>Bowery Ballroom</h2>
        <span style={{fontSize:14,color:'hsl(var(--muted-foreground))',display:'inline-flex',alignItems:'center',gap:6}}>
          <Icon name="map-pin" size={13}/>New York
        </span>
      </div>
      <div style={{height:1,background:'hsl(var(--border))',margin:'28px 0 28px'}}/>
      {children}
    </div>
  );
}

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [guests, setGuests] = useState(SEED);

  const variantKey = (t.variant||'').charAt(0); // "A" | "B" | "C"
  const Comp = variantKey==='B'?GuestListB : variantKey==='C'?GuestListC : GuestListA;

  return (
    <>
      <PageScaffold variant={variantKey}>
        <Comp guests={guests} onChange={setGuests}/>

        <div style={{marginTop:48,padding:'14px 16px',border:'1px dashed hsl(var(--border))',borderRadius:10,background:'hsl(var(--muted)/0.2)'}}>
          <div style={{font:'500 10.5px/1.1 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.14em',color:'hsl(var(--muted-foreground))',marginBottom:6}}>What changed</div>
          <ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.6,color:'hsl(var(--muted-foreground))'}}>
            <li>Default is read mode — guests render as text, not text fields. Tap a row to edit.</li>
            <li>The orphan <code>+</code> character is gone. Plus-ones are part of the row vocabulary, not chrome.</li>
            <li>No global Save button — saves are inline like every other field on this page (autosave on Enter or blur).</li>
            <li>Empty name on commit removes the row. Esc cancels.</li>
            <li>Total guest count moved into the section header / footer where it belongs as a summary, not floating beside Add guest.</li>
          </ul>
        </div>
      </PageScaffold>

      <TweaksPanel>
        <TweakSection label="Variant"/>
        <TweakRadio
          label="Layout"
          value={t.variant}
          options={['A — Read-then-edit row','B — Compact chip list','C — Editorial table']}
          onChange={v=>setTweak('variant',v)}/>
        <TweakSection label="Data"/>
        <TweakButton label="Reset guest list" onClick={()=>setGuests(SEED)}/>
        <TweakButton label="Clear all" onClick={()=>setGuests([])}/>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
