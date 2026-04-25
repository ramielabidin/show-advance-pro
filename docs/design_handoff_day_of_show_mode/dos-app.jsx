/* dos-app.jsx — root app: phone frame stage + scrubber + tweaks */
const { useState: A_useState, useEffect: A_useEffect, useMemo: A_useMemo } = React;
const { Icon: A_Icon } = window.dosUI;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "phase": "auto",
  "clockMin": 1170,
  "settled": false,
  "loadOutDone": false,
  "isShowDay": true,
  "micPlacement": "header",
  "hotelVariant": "editorial"
}/*EDITMODE-END*/;

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = A_useState('dashboard'); // 'dashboard' | 'dos'
  const [dismissed, setDismissed] = A_useState(false);

  // build state for DOS surface
  const checked = A_useMemo(() => t.loadOutDone ? {'load-out': true} : {}, [t.loadOutDone]);
  const dosState = {
    nowMin: t.clockMin,
    settled: t.settled,
    checked,
  };

  // forced-phase override
  const computedPhase = window.dosHelpers.computePhase(dosState);
  const phase = t.phase === 'auto' ? computedPhase : Number(t.phase);

  // Effective state for the surface (so scrubber + auto compute consistently)
  const effectiveState = t.phase === 'auto' ? dosState : (
    phase === 3 ? {...dosState, settled: true} :
    phase === 2 ? {...dosState, settled: false, nowMin: Math.max(t.clockMin, hmToMinutesLocal('23:30')), checked:{'load-out': true}} :
    {...dosState, settled: false, nowMin: Math.min(t.clockMin, hmToMinutesLocal('19:15')), checked:{}}
  );

  function hmToMinutesLocal(hm){ const [h,m]=hm.split(':').map(Number); return h*60+m; }

  // helper to set state on the surface
  const setStateFromSurface = (updater) => {
    const next = typeof updater === 'function' ? updater(effectiveState) : updater;
    if(next.settled !== undefined) setTweak('settled', next.settled);
    if(next.checked && next.checked['load-out']) setTweak('loadOutDone', true);
    if(next.nowMin !== undefined) setTweak('clockMin', next.nowMin);
  };

  const enterDOS = () => setView('dos');
  const exitDOS = () => setView('dashboard');

  // Format clock for display
  const clockLabel = (() => {
    const m = effectiveState.nowMin;
    const h = Math.floor(m/60), mm = m%60;
    const period = h>=12?'PM':'AM';
    const hh = ((h+11)%12)+1;
    return `${hh}:${String(mm).padStart(2,'0')} ${period}`;
  })();

  const phaseScrub = (
    <div className="scrubber" role="tablist" aria-label="Phase">
      {[
        {id:'auto', label:'Auto'},
        {id:'1', label:'Pre-show'},
        {id:'2', label:'Settle'},
        {id:'3', label:'Post-settle'},
      ].map(opt => (
        <button
          key={opt.id}
          className={t.phase === opt.id ? 'active' : ''}
          onClick={() => {
            setTweak('phase', opt.id);
            // If user picks a phase via scrubber, also enter DOS view
            if(opt.id !== 'auto') setView('dos');
          }}
        >{opt.label}</button>
      ))}
    </div>
  );

  return (
    <div className="stage">
      {/* Top header — title + scrubber */}
      <div style={{
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        gap:14,
        marginBottom:6,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <div style={{
            fontFamily:'var(--font-display)',
            fontSize:22,
            color:'hsl(var(--foreground))',
            letterSpacing:'-0.01em',
          }}>Day of Show Mode</div>
          <span style={{
            font:'500 10px/1 var(--font-sans)',
            textTransform:'uppercase',
            letterSpacing:'0.18em',
            color:'hsl(var(--muted-foreground))',
            border:'1px solid hsl(var(--border))',
            borderRadius:999,
            padding:'4px 10px',
          }}>v0 mock</span>
        </div>
        {phaseScrub}
        <div style={{
          font:'500 11px/1 var(--font-mono)',
          color:'hsl(var(--muted-foreground))',
          letterSpacing:'0.04em',
        }}>
          {view === 'dashboard'
            ? <>Tap the glowing mic to enter</>
            : <>Show day · clock {clockLabel} {effectiveState.settled && '· settled'}</>
          }
        </div>
      </div>

      {/* Phone frame */}
      <div className="phone-frame">
        <div className="phone-screen">
          <div className="phone-notch"/>
          <div key={view} className="fade-in" style={{height:'100%'}}>
            {view === 'dashboard' ? (
              <window.DOSDashboard
                onEnterDOS={enterDOS}
                dosActive={false}
                micPlacement={t.micPlacement}
                isShowDay={t.isShowDay}
                isSettled={effectiveState.settled}
                clock={clockLabel.replace(' AM','').replace(' PM','')}
              />
            ) : (
              <window.DayOfShowMode
                state={effectiveState}
                setState={setStateFromSurface}
                onClose={exitDOS}
                hotelVariant={t.hotelVariant}
              />
            )}
          </div>
        </div>
      </div>

      <div className="stage-cap">
        Mobile · 390 × 844 · Dark mode
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="View"/>
        <TweakRadio
          label="Surface"
          value={view}
          options={[
            {value:'dashboard', label:'Dashboard'},
            {value:'dos', label:'Day of Show'},
          ]}
          onChange={(v) => setView(v)}
        />

        <TweakSection label="Phase scrubber"/>
        <TweakRadio
          label="Phase"
          value={t.phase}
          options={[
            {value:'auto', label:'Auto'},
            {value:'1', label:'1'},
            {value:'2', label:'2'},
            {value:'3', label:'3'},
          ]}
          onChange={(v) => {
            setTweak('phase', v);
            if(v !== 'auto') setView('dos');
          }}
        />
        <TweakSlider
          label="Clock"
          value={t.clockMin}
          min={12*60}
          max={24*60-1}
          step={5}
          unit=""
          onChange={(v) => setTweak('clockMin', v)}
          format={(v) => {
            const h = Math.floor(v/60), m = v%60;
            const period = h>=12?'PM':'AM';
            const hh = ((h+11)%12)+1;
            return `${hh}:${String(m).padStart(2,'0')} ${period}`;
          }}
        />
        <TweakToggle label="Load-out checked" value={t.loadOutDone}
          onChange={(v) => setTweak('loadOutDone', v)}/>
        <TweakToggle label="Show is settled" value={t.settled}
          onChange={(v) => setTweak('settled', v)}/>
        <TweakToggle label="Today is a show day" value={t.isShowDay}
          onChange={(v) => setTweak('isShowDay', v)}/>

        <TweakSection label="Variants"/>
        <TweakRadio
          label="Mic placement"
          value={t.micPlacement}
          options={[
            {value:'header', label:'Header'},
            {value:'card', label:'Card'},
            {value:'fab', label:'FAB'},
          ]}
          onChange={(v) => setTweak('micPlacement', v)}
        />
        <TweakRadio
          label="Hotel"
          value={t.hotelVariant}
          options={[
            {value:'editorial', label:'Editorial'},
            {value:'map', label:'With map'},
          ]}
          onChange={(v) => setTweak('hotelVariant', v)}
        />

        <TweakSection label="Compare"/>
        <div style={{display:'flex', gap:6}}>
          <a href="Day of Show — Variants.html" style={{
            flex:1,
            padding:'8px 10px',
            border:'.5px solid rgba(0,0,0,.12)',
            borderRadius:7,
            fontSize:11,
            fontWeight:500,
            color:'rgba(41,38,27,.85)',
            textAlign:'center',
            background:'rgba(255,255,255,.55)',
            textDecoration:'none',
          }}>Open variants canvas →</a>
        </div>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);

setTimeout(() => window.lucide && window.lucide.createIcons(), 80);
