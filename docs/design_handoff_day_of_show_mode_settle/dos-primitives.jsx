/* dos-primitives.jsx — small set of helpers used across DOS surfaces */
const { useState, useEffect, useRef, useMemo } = React;

function Icon({name, size=16, stroke=1.75, style={}, className=''}){
  return <i data-lucide={name}
    style={{width:size, height:size, display:'inline-flex', verticalAlign:'middle', strokeWidth:stroke, ...style}}
    className={className}/>;
}

function Eyebrow({children, style={}}){
  return <p style={{
    font:'500 11px/1.2 var(--font-sans)',
    textTransform:'uppercase',
    letterSpacing:'0.18em',
    color:'hsl(var(--muted-foreground))',
    margin: 0,
    ...style,
  }}>{children}</p>;
}

function Chip({children, tone='blue', style={}}){
  const tones = {
    blue:{bg:'var(--pastel-blue-bg)', fg:'var(--pastel-blue-fg)'},
    green:{bg:'var(--pastel-green-bg)', fg:'var(--pastel-green-fg)'},
    yellow:{bg:'var(--pastel-yellow-bg)', fg:'var(--pastel-yellow-fg)'},
    red:{bg:'var(--pastel-red-bg)', fg:'var(--pastel-red-fg)'},
    muted:{bg:'hsl(var(--muted))', fg:'hsl(var(--muted-foreground))'},
    new:{bg:'hsl(var(--badge-new)/0.15)', fg:'hsl(var(--badge-new))'},
  }[tone];
  return <span style={{
    display:'inline-flex',alignItems:'center',gap:4,
    borderRadius:999,padding:'2px 8px',
    fontSize:11,fontWeight:500,
    background:tones.bg,color:tones.fg,
    whiteSpace:'nowrap',
    ...style,
  }}>{children}</span>;
}

/* MicChip — the glowing day-of entry */
function MicChip({onClick, label='Day of Show', size='default', placement='inline'}){
  const big = size === 'big';
  return (
    <button
      onClick={onClick}
      className="mic-glow pressable"
      style={{
        display:'inline-flex',
        alignItems:'center',
        gap: big ? 10 : 8,
        padding: big ? '10px 16px 10px 12px' : '6px 12px 6px 8px',
        borderRadius: 999,
        background: 'hsl(var(--badge-new) / 0.15)',
        color: 'hsl(var(--badge-new))',
        border: '1px solid hsl(var(--badge-new) / 0.4)',
        font: `500 ${big?13:12}px/1 var(--font-sans)`,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}>
      <span style={{
        width: big?22:18, height: big?22:18,
        borderRadius: 999,
        background: 'hsl(var(--badge-new))',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="mic" size={big?12:10} stroke={2.2}/>
      </span>
      {label}
    </button>
  );
}

/* StatusBar — fake iOS status bar inside phone */
function StatusBar({clock, dark=true}){
  return (
    <div style={{
      height: 50,
      padding: '14px 28px 0',
      display:'flex',
      alignItems:'flex-start',
      justifyContent:'space-between',
      fontFamily:'var(--font-sans)',
      fontWeight:600,
      fontSize:14,
      color:'hsl(var(--foreground))',
      letterSpacing:'-0.01em',
    }}>
      <span className="tab-num">{clock}</span>
      <span style={{display:'inline-flex', gap:6, alignItems:'center', marginTop:1}}>
        <Icon name="signal" size={14} stroke={2.2} style={{opacity:.85}}/>
        <Icon name="wifi" size={14} stroke={2.2} style={{opacity:.85}}/>
        <span style={{
          display:'inline-flex',
          width:24, height:11,
          border:'1px solid hsl(var(--foreground) / 0.65)',
          borderRadius:3,
          padding:1,
          alignItems:'center',
          position:'relative',
        }}>
          <span style={{flex:1, height:'100%', background:'hsl(var(--foreground) / 0.85)', borderRadius:1.5}}/>
          <span style={{
            position:'absolute', right:-3, top:3, height:5, width:1.5,
            background:'hsl(var(--foreground) / 0.65)', borderRadius:1,
          }}/>
        </span>
      </span>
    </div>
  );
}

window.dosUI = { Icon, Eyebrow, Chip, MicChip, StatusBar };
