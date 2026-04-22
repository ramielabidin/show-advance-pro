/* Shared primitives for the show detail explorations */
const { useState, useEffect, useRef, useMemo } = React;

function cn(...a){ return a.filter(Boolean).join(' '); }

// Icon: Lucide via CDN, rendered as inline SVG
function Icon({name, size=16, stroke=1.5, className='', style={}}){
  const ref = useRef(null);
  useEffect(()=>{
    if(!ref.current || !window.lucide) return;
    ref.current.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';
    const node = document.createElement('i');
    node.setAttribute('data-lucide', name);
    ref.current.appendChild(node);
    window.lucide.createIcons({ attrs: { width: size, height: size, 'stroke-width': stroke } });
  },[name, size, stroke]);
  return <span ref={ref} className={className} style={{display:'inline-flex', alignItems:'center', justifyContent:'center', width:size, height:size, flexShrink:0, ...style}}/>;
}

function Eyebrow({children, style={}}){
  return <p style={{font:'500 11px/1.2 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.14em', color:'hsl(var(--muted-foreground))', margin:'0 0 6px', ...style}}>{children}</p>;
}

function SectionLabel({children, incomplete, style={}}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12, ...style}}>
      <div style={{width:2,height:14,borderRadius:2,background:'hsl(var(--foreground)/0.25)'}}/>
      <span style={{font:'500 11px/1.2 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.14em',color:'hsl(var(--muted-foreground))',display:'inline-flex',alignItems:'center',gap:6}}>
        {children}
        {incomplete && <span style={{width:6,height:6,borderRadius:999,background:'var(--pastel-yellow-fg)'}}/>}
      </span>
    </div>
  );
}

function Chip({children, tone='blue', style={}}){
  const tones={
    blue:{bg:'var(--pastel-blue-bg)', fg:'var(--pastel-blue-fg)'},
    green:{bg:'var(--pastel-green-bg)', fg:'var(--pastel-green-fg)'},
    yellow:{bg:'var(--pastel-yellow-bg)', fg:'var(--pastel-yellow-fg)'},
    red:{bg:'var(--pastel-red-bg)', fg:'var(--pastel-red-fg)'},
    muted:{bg:'hsl(var(--muted))', fg:'hsl(var(--muted-foreground))'},
  }[tone];
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,borderRadius:999,padding:'2px 8px',fontSize:11,fontWeight:500,background:tones.bg,color:tones.fg,whiteSpace:'nowrap',...style}}>{children}</span>;
}

function Button({variant='default', size='default', className='', children, style={}, ...p}){
  const sz = {
    sm:   {height:28, padding:'0 10px', fontSize:12},
    md:   {height:32, padding:'0 12px', fontSize:13},
    default:{height:36, padding:'0 14px', fontSize:13},
    lg:   {height:44, padding:'0 20px', fontSize:14},
  }[size] || {height:36, padding:'0 14px', fontSize:13};
  const v = {
    default:{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', border:'1px solid hsl(var(--primary))'},
    outline:{ background:'hsl(var(--background))', color:'hsl(var(--foreground))', border:'1px solid hsl(var(--input))'},
    secondary:{ background:'hsl(var(--secondary))', color:'hsl(var(--secondary-foreground))', border:'1px solid transparent'},
    ghost:{ background:'transparent', color:'hsl(var(--muted-foreground))', border:'1px solid transparent'},
    destructive:{ background:'hsl(var(--destructive))', color:'#fff', border:'1px solid hsl(var(--destructive))'},
    settle:{ background:'hsl(var(--success))', color:'#fff', border:'1px solid hsl(var(--success))'},
  }[variant];
  return (
    <button {...p}
      style={{display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, borderRadius:8, fontWeight:500, cursor:'pointer', transition:'all 160ms var(--ease-out)', ...sz, ...v, ...style}}
      onMouseDown={e=>{ e.currentTarget.style.transform='scale(0.97)'; }}
      onMouseUp={e=>{ e.currentTarget.style.transform=''; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; }}
    >{children}</button>
  );
}

function Card({children, style={}, ...p}){
  return <div {...p} style={{background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:10, ...style}}>{children}</div>;
}

/* FieldRow — read mode */
function FieldRow({label, value, mono, empty, onClick, compact}){
  const hasValue = value != null && value !== '';
  return (
    <div onClick={onClick}
      style={{
        display:'grid', gridTemplateColumns: compact? '80px 1fr':'110px 1fr', gap:10,
        padding:'6px 0', cursor:onClick?'pointer':'default',
        borderRadius:6,
      }}>
      <span style={{fontSize:13, color:'hsl(var(--muted-foreground))'}}>{label}</span>
      {hasValue ? (
        <span style={{fontSize:13, color:'hsl(var(--foreground))', fontFamily:mono?'var(--font-mono)':'inherit', letterSpacing:mono?'-0.01em':'normal'}}>{value}</span>
      ) : (
        <span style={{fontSize:13, color:'hsl(var(--muted-foreground)/0.6)', fontStyle:'italic'}}>{empty||'Tap to add'}</span>
      )}
    </div>
  );
}

Object.assign(window, { cn, Icon, Eyebrow, SectionLabel, Chip, Button, Card, FieldRow });
