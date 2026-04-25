/* dos-mode.jsx — the Day of Show Mode surface. Three phases, content morphs in place. */

const { Icon: M_Icon, Eyebrow: M_Eyebrow, Chip: M_Chip, StatusBar: M_StatusBar } = window.dosUI;
const { hmToMinutes, fmt12, fmt12short, computeScheduleState } = window.dosHelpers;
const { useState: M_useState, useEffect: M_useEffect } = React;

/* Countdown formatter: minutes → "2h 14m" or "14m" or "now" */
function fmtCountdown(min){
  if(min <= 0) return 'now';
  if(min < 60) return `${min}m`;
  const h = Math.floor(min/60), m = min%60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function fmt12parts(hm){
  // returns { n: "4", u: "PM" } from "16:00"; handles "12 PM" / "12 AM" naturally
  const s = fmt12short(hm); // e.g. "4 PM" or "12:30 AM"
  const m = s.match(/^(\S+)\s+(AM|PM)$/i);
  if(!m) return {n:s, u:''};
  return {n:m[1], u:m[2].toUpperCase()};
}
function fmtCountdownParts(min){
  if(min <= 0) return [{n:'now', u:''}];
  if(min < 60) return [{n: String(min), u: 'min'}];
  const h = Math.floor(min/60), m = min%60;
  if(m === 0) return [{n: String(h), u: 'hr'}];
  return [{n: String(h), u: 'hr'}, {n: String(m).padStart(2,'0'), u: 'min'}];
}

function DayOfShowMode({state, setState, onClose, hotelVariant='editorial'}){
  const data = window.DOS_DATA;
  const phase = window.dosHelpers.computePhase(state);

  return (
    <div style={{
      height:'100%', overflow:'hidden',
      display:'flex', flexDirection:'column',
      background:'hsl(var(--background))',
      position:'relative',
    }}>
      <M_StatusBar clock={window.dosHelpers.minutesToHM(state.nowMin).replace(/^0/,'')}/>

      {/* Top chrome — small mic dot + close X */}
      <div style={{
        padding:'4px 18px 0',
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
      }}>
        <div style={{display:'inline-flex', alignItems:'center', gap:8}}>
          <span className="mic-glow" style={{
            width:22, height:22, borderRadius:999,
            background:'hsl(var(--badge-new))',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            color:'#fff',
          }}>
            <M_Icon name="mic" size={11} stroke={2.4}/>
          </span>
          <span style={{
            font:'500 10.5px/1 var(--font-sans)',
            textTransform:'uppercase',
            letterSpacing:'0.18em',
            color:'hsl(var(--muted-foreground))',
          }}>Day of Show</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="pressable"
          style={{
            width:32, height:32, borderRadius:999,
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            background:'hsl(var(--secondary))',
            border:'1px solid hsl(var(--border))',
            color:'hsl(var(--muted-foreground))',
            cursor:'pointer',
          }}>
          <M_Icon name="x" size={14} stroke={2}/>
        </button>
      </div>

      {/* Body — phase swap with morph */}
      <div key={phase} className="phase-morph" style={{
        flex:1,
        overflow:'auto',
        display:'flex', flexDirection:'column',
      }}>
        {phase === 1 && <PhasePreShow state={state} setState={setState}/>}
        {phase === 2 && <PhaseSettle state={state} setState={setState}/>}
        {phase === 3 && <PhasePostSettle hotelVariant={hotelVariant}/>}
      </div>
    </div>
  );
}

/* ======================= PHASE 1 — Pre-show ======================= */

function PhasePreShow({state, setState}){
  const data = window.DOS_DATA;
  const {currentIdx, nextIdx} = computeScheduleState(state.nowMin, data.schedule);
  const checked = state.checked || {};

  // Hero entry = the next moment, or current if it's still the leading edge (e.g. mid-set)
  const heroIdx = nextIdx !== null ? nextIdx : currentIdx;
  const hero = data.schedule[heroIdx];
  const heroMin = hmToMinutes(hero.time);
  const remaining = heroMin - state.nowMin;
  const parts = fmtCountdownParts(remaining);

  const [shareOpen, setShareOpen] = M_useState(false);

  return (
    <div style={{padding:'8px 22px 28px', flex:1, display:'flex', flexDirection:'column'}}>
      {/* HERO — time as the operative info, countdown demoted to subtitle */}
      <div style={{padding:'14px 0 4px'}}>
        <M_Eyebrow style={{marginBottom:10}}>{nextIdx !== null ? 'Up next' : 'Now'}</M_Eyebrow>

        <div style={{
          font:'500 28px/1.05 var(--font-sans)',
          letterSpacing:'-0.02em',
          color:'hsl(var(--foreground))',
        }}>
          {hero.label}
        </div>

        {/* Big serif TIME — the operative number */}
        <div style={{
          marginTop: 18,
          display:'flex', alignItems:'baseline', gap:10,
          letterSpacing:'-0.05em',
        }}>
          <span style={{
            fontFamily:'var(--font-display)',
            fontSize: 110,
            lineHeight: 0.9,
            color:'hsl(var(--foreground))',
          }} className="tab-num">{fmt12parts(hero.time).n}</span>
          <span style={{
            fontFamily:'var(--font-display)',
            fontSize: 38,
            lineHeight: 0.9,
            color:'hsl(var(--muted-foreground))',
            letterSpacing:'-0.02em',
          }}>{fmt12parts(hero.time).u}</span>
        </div>

        {/* Countdown demoted — supporting context */}
        <div style={{
          marginTop: 8,
          font:'500 14px/1.2 var(--font-sans)',
          color:'hsl(var(--muted-foreground))',
          letterSpacing:'-0.005em',
        }}>
          {remaining > 0
            ? <>in {parts.map(p => `${p.n}${p.u ? ' '+p.u : ''}`).join(' ')}{hero.note ? <> · <span>{hero.note}</span></> : null}</>
            : <>now{hero.note ? <> · <span>{hero.note}</span></> : null}</>}
        </div>
      </div>

      {/* Schedule list */}
      <div style={{marginTop:24}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <M_Eyebrow>Schedule</M_Eyebrow>
        </div>
        <div style={{
          background:'hsl(var(--card))',
          border:'1px solid hsl(var(--border))',
          borderRadius:12,
          padding:'4px 12px',
        }}>
          {data.schedule.map((row, i) => {
            const t = hmToMinutes(row.time);
            const isPast = t <= state.nowMin || checked[row.id];
            const isHero = i === heroIdx;
            return (
              <div key={row.id} style={{
                display:'grid',
                gridTemplateColumns:'62px 1fr auto',
                gap:10,
                alignItems:'center',
                padding:'9px 0',
                borderBottom: i < data.schedule.length-1 ? '1px solid hsl(var(--border) / 0.5)' : 'none',
                opacity: isPast && !isHero ? 0.42 : 1,
              }}>
                <span style={{
                  fontFamily:'var(--font-mono)', fontSize:12,
                  color: isHero ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                  fontWeight: isHero ? 600 : 500,
                  textDecoration: isPast && !isHero ? 'line-through' : 'none',
                }}>{fmt12short(row.time)}</span>
                <span style={{
                  fontSize:13.5,
                  display:'flex', alignItems:'center', gap:6,
                  color: isHero ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                  fontWeight: isHero ? 500 : 400,
                }}>
                  {row.is_band && <M_Icon name="mic" size={11} style={{color:'hsl(var(--badge-new))'}}/>}
                  {row.label}
                  {isHero && <M_Chip tone="new" style={{marginLeft:4}}>Next</M_Chip>}
                </span>
                <span>
                  {row.is_band ? (
                    <button onClick={() => setShareOpen(o=>!o)} className="pressable" style={{
                      background:'transparent', border:0,
                      color:'hsl(var(--muted-foreground))',
                      cursor:'pointer', padding:6, borderRadius:6,
                      display:'inline-flex',
                    }} aria-label="Print or share set list">
                      <M_Icon name="printer" size={13}/>
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {/* Share menu */}
        {shareOpen && (
          <div style={{
            marginTop:8, alignSelf:'flex-end',
            background:'hsl(var(--popover))',
            border:'1px solid hsl(var(--border))',
            borderRadius:12,
            boxShadow:'0 8px 24px rgba(0,0,0,0.35)',
            padding:6,
            width:200,
            marginLeft:'auto',
          }}>
            <MenuItem icon="printer" label="Print set list"/>
            <MenuItem icon="share-2" label="Share to crew"/>
            <MenuItem icon="copy" label="Copy as text"/>
          </div>
        )}
      </div>

      {/* Action row — 3 tap targets */}
      <div style={{marginTop:22, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        <ActionCard
          icon="phone"
          eyebrow="Day-of contact"
          title={data.dos.name}
          sub={data.dos.role + ' · ' + data.dos.phone}
          tone="default"
        />
        <ActionCard
          icon="users"
          eyebrow="Guest list"
          title={String(data.guestList)}
          sub="confirmed names"
          tone="default"
          mono
        />
      </div>
      <div style={{marginTop:10}}>
        <ActionCard
          icon="navigation"
          eyebrow="Venue"
          title={data.venue}
          sub={data.address}
          tone="navigate"
          full
        />
      </div>
    </div>
  );
}

/* ======================= PHASE 2 — Settle ======================= */

function PhaseSettle({state, setState}){
  const data = window.DOS_DATA;

  return (
    <div style={{
      flex:1,
      padding:'24px 22px 28px',
      display:'flex', flexDirection:'column',
    }}>
      <M_Eyebrow style={{marginBottom:18}}>Show's done.</M_Eyebrow>

      {/* Big settle CTA */}
      <button
        className="pressable"
        onClick={() => setState(s => ({...s, settled: true}))}
        style={{
          width:'100%',
          background:'hsl(var(--success))',
          border:0,
          borderRadius:18,
          padding:'34px 22px',
          textAlign:'left',
          color:'#fff',
          cursor:'pointer',
          boxShadow:'0 14px 40px hsl(152 60% 30% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.15)',
          display:'flex',
          flexDirection:'column',
          gap:14,
        }}>
        <div style={{
          font:'500 11px/1 var(--font-sans)',
          textTransform:'uppercase',
          letterSpacing:'0.18em',
          color:'rgba(255,255,255,0.78)',
        }}>Wrap it up</div>
        <div style={{
          font:'400 44px/1 var(--font-display)',
          letterSpacing:'-0.03em',
        }}>Settle this show</div>
        <div style={{
          fontSize:13.5,
          color:'rgba(255,255,255,0.85)',
          lineHeight:1.4,
        }}>Count the door, close the night, save your numbers. Five minutes.</div>
        <div style={{
          marginTop:6,
          display:'inline-flex',
          alignItems:'center',
          gap:6,
          fontSize:13,
          color:'rgba(255,255,255,0.95)',
          fontWeight:500,
        }}>
          Open settle <M_Icon name="arrow-right" size={14} stroke={2}/>
        </div>
      </button>

      {/* Hotel teaser */}
      <div style={{marginTop:22}}>
        <M_Eyebrow style={{marginBottom:8}}>Up next</M_Eyebrow>
        <div className="pressable" style={{
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
            <M_Icon name="bed" size={17}/>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{font:'500 14px/1.2 var(--font-sans)'}}>{data.hotel.name}</div>
            <div style={{fontSize:12, color:'hsl(var(--muted-foreground))', marginTop:2}}>
              {data.hotel.distance} away · {data.hotel.roomBlock}
            </div>
          </div>
          <M_Icon name="chevron-right" size={14} style={{color:'hsl(var(--muted-foreground))'}}/>
        </div>
      </div>

      {/* Tiny schedule footer — what got done */}
      <div style={{marginTop: 'auto', paddingTop: 22}}>
        <div style={{
          font:'500 10px/1 var(--font-sans)',
          textTransform:'uppercase',
          letterSpacing:'0.18em',
          color:'hsl(var(--muted-foreground))',
          marginBottom:8,
        }}>Tonight</div>
        <div style={{
          display:'flex', flexWrap:'wrap', gap:'4px 14px',
          fontSize:11.5,
          color:'hsl(var(--muted-foreground))',
          fontFamily:'var(--font-mono)',
        }}>
          {data.schedule.map(s => (
            <span key={s.id} style={{display:'inline-flex', alignItems:'center', gap:4}}>
              <M_Icon name="check" size={9} style={{color:'var(--pastel-green-fg)'}}/>
              {fmt12short(s.time)} {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ======================= PHASE 3 — Post-settle (Hotel) ======================= */

function PhasePostSettle({hotelVariant='editorial'}){
  const data = window.DOS_DATA;

  return (
    <div style={{
      flex:1,
      padding:'14px 22px 28px',
      display:'flex', flexDirection:'column',
    }}>
      <div style={{padding:'10px 0 18px'}}>
        <M_Eyebrow style={{marginBottom:8}}>Settled · Drive safe</M_Eyebrow>
        <div style={{
          fontSize:13,
          color:'hsl(var(--muted-foreground))',
          lineHeight:1.45,
        }}>Tonight's done. Here's where you're sleeping.</div>
      </div>

      {hotelVariant === 'map' && (
        <FakeMap address={data.hotel.address}/>
      )}

      {/* Hotel hero */}
      <div style={{marginTop:6}}>
        <div style={{
          font:'500 10.5px/1 var(--font-sans)',
          textTransform:'uppercase',
          letterSpacing:'0.18em',
          color:'hsl(var(--muted-foreground))',
        }}>Hotel</div>
        <h1 style={{
          font:'400 46px/1.02 var(--font-display)',
          letterSpacing:'-0.03em',
          color:'hsl(var(--foreground))',
          margin:'10px 0 14px',
        }}>{data.hotel.name}</h1>
        <div style={{
          fontFamily:'var(--font-mono)',
          fontSize:14,
          color:'hsl(var(--foreground))',
          lineHeight:1.5,
        }}>{data.hotel.address}</div>
        <div style={{
          fontSize:12.5,
          color:'hsl(var(--muted-foreground))',
          marginTop:6,
        }}>{data.hotel.distance} from the venue</div>
      </div>

      {/* Navigate */}
      <button className="pressable" style={{
        marginTop:22,
        background:'hsl(var(--foreground))',
        color:'hsl(var(--background))',
        border:0,
        borderRadius:14,
        padding:'16px 18px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        cursor:'pointer',
        font:'500 15px/1 var(--font-sans)',
      }}>
        <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
          <M_Icon name="navigation" size={16} stroke={2}/>
          Navigate
        </span>
        <M_Icon name="arrow-up-right" size={16} stroke={2}/>
      </button>

      {/* Booking detail */}
      <div style={{
        marginTop:22,
        background:'hsl(var(--card))',
        border:'1px solid hsl(var(--border))',
        borderRadius:12,
        padding:'4px 14px',
      }}>
        <BookingRow label="Check-in" value={fmt12short(data.hotel.checkIn)} mono/>
        <BookingRow label="Confirmation" value={data.hotel.confirmation} mono/>
        <BookingRow label="Room block" value={data.hotel.roomBlock}/>
      </div>

      {/* Sign-off */}
      <div style={{marginTop:'auto', paddingTop:30, textAlign:'center'}}>
        <div style={{
          font:'400 22px/1.2 var(--font-display)',
          letterSpacing:'-0.02em',
          color:'hsl(var(--foreground))',
          marginBottom:4,
        }}>Good night.</div>
        <div style={{
          fontSize:12,
          color:'hsl(var(--muted-foreground))',
        }}>This view closes itself in the morning.</div>
      </div>
    </div>
  );
}

/* ============== Sub-components ============== */

function ActionCard({icon, eyebrow, title, sub, tone='default', mono=false, full=false}){
  const isNav = tone === 'navigate';
  return (
    <div className="pressable" style={{
      background: isNav ? 'hsl(var(--muted) / 0.5)' : 'hsl(var(--card))',
      border:'1px solid hsl(var(--border))',
      borderRadius:12,
      padding:'12px 14px',
      display:'flex',
      alignItems: full ? 'center' : 'flex-start',
      flexDirection: full ? 'row' : 'column',
      gap: full ? 12 : 10,
      minHeight: 100,
    }}>
      <div style={{
        width:32, height:32, borderRadius:9,
        background:'hsl(var(--secondary))',
        color:'hsl(var(--foreground))',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <M_Icon name={icon} size={15} stroke={1.8}/>
      </div>
      <div style={{flex: full ? 1 : 'unset', minWidth:0, width:'100%'}}>
        <div style={{
          font:'500 9.5px/1 var(--font-sans)',
          textTransform:'uppercase',
          letterSpacing:'0.14em',
          color:'hsl(var(--muted-foreground))',
          marginBottom:4,
        }}>{eyebrow}</div>
        <div style={{
          font:`500 ${full?14:13.5}px/1.25 var(--font-${mono?'mono':'sans'})`,
          color:'hsl(var(--foreground))',
          letterSpacing: mono ? '-0.01em' : 'normal',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace: full?'nowrap':'normal',
        }}>{title}</div>
        {sub && <div style={{
          fontSize:11.5,
          color:'hsl(var(--muted-foreground))',
          marginTop:3,
          lineHeight:1.35,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace: full?'nowrap':'normal',
        }}>{sub}</div>}
      </div>
      {full && <M_Icon name="arrow-up-right" size={14} style={{color:'hsl(var(--muted-foreground))', flexShrink:0}}/>}
    </div>
  );
}

function MenuItem({icon, label}){
  return (
    <button className="pressable" style={{
      width:'100%',
      background:'transparent',
      border:0,
      padding:'8px 10px',
      borderRadius:8,
      display:'flex', alignItems:'center', gap:10,
      color:'hsl(var(--foreground))',
      font:'500 13px/1 var(--font-sans)',
      cursor:'pointer',
      textAlign:'left',
    }}>
      <M_Icon name={icon} size={14} stroke={1.8} style={{color:'hsl(var(--muted-foreground))'}}/>
      {label}
    </button>
  );
}

function BookingRow({label, value, mono}){
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'120px 1fr',
      gap:10,
      alignItems:'center',
      padding:'10px 0',
      borderBottom:'1px solid hsl(var(--border) / 0.5)',
    }}>
      <span style={{fontSize:12, color:'hsl(var(--muted-foreground))'}}>{label}</span>
      <span style={{
        fontSize:13.5,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        color:'hsl(var(--foreground))',
      }}>{value}</span>
    </div>
  );
}

function FakeMap({address}){
  return (
    <div style={{
      borderRadius:14,
      overflow:'hidden',
      height:160,
      marginBottom:6,
      position:'relative',
      background: 'linear-gradient(135deg, hsl(30 10% 14%) 0%, hsl(30 10% 11%) 100%)',
      border:'1px solid hsl(var(--border))',
    }}>
      {/* Stylized lines */}
      <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="none" style={{display:'block'}}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(30 8% 22%)" strokeWidth="0.7"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
        <path d="M -20 110 Q 100 90 180 100 T 420 80" stroke="hsl(30 8% 30%)" strokeWidth="3" fill="none"/>
        <path d="M 50 -10 Q 80 60 130 80 T 260 170" stroke="hsl(30 8% 30%)" strokeWidth="2" fill="none"/>
        <path d="M -10 60 Q 90 50 220 70 T 420 60" stroke="hsl(30 8% 26%)" strokeWidth="1.5" fill="none"/>
        {/* venue dot */}
        <circle cx="110" cy="98" r="4" fill="hsl(var(--muted-foreground))"/>
        {/* hotel dot */}
        <circle cx="280" cy="68" r="6" fill="hsl(var(--badge-new))"/>
        <circle cx="280" cy="68" r="14" fill="none" stroke="hsl(var(--badge-new))" strokeWidth="1" opacity="0.5"/>
        {/* route */}
        <path d="M 110 98 Q 200 60 280 68" stroke="hsl(var(--badge-new))" strokeWidth="2" fill="none" strokeDasharray="4 4"/>
      </svg>
    </div>
  );
}

window.DayOfShowMode = DayOfShowMode;
