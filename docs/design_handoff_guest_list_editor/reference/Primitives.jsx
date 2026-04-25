/* Primitives.jsx — tiny shadcn-flavored set specific to Advance */
const { useState, useEffect, useRef } = React;

function cn(...a){ return a.filter(Boolean).join(' '); }

function Icon({name, className='', size=16, stroke=1.5}){
  const ref = useRef(null);
  useEffect(()=>{ if(window.lucide) window.lucide.createIcons({ icons: window.lucide.icons, attrs:{class: className}}); },[name,className]);
  return <i data-lucide={name} style={{width:size, height:size, display:'inline-flex', verticalAlign:'middle', strokeWidth:stroke}} className={className}/>;
}

function Button({variant='default', size='default', className='', children, ...p}){
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none';
  const styles = {
    display:'inline-flex', alignItems:'center', gap:8, justifyContent:'center',
    borderRadius:8, padding: size==='sm' ? '0 12px' : size==='lg' ? '0 24px' : '0 14px',
    height: size==='sm'?32 : size==='lg'?44 : 36,
    fontSize:13, fontWeight:500,
    transition:'transform 160ms var(--ease-out), background-color 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms var(--ease-out)',
    cursor:'pointer', userSelect:'none',
  };
  const v = {
    default:{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', border:'1px solid hsl(var(--primary))'},
    outline:{ background:'hsl(var(--background))', color:'hsl(var(--foreground))', border:'1px solid hsl(var(--input))'},
    secondary:{ background:'hsl(var(--secondary))', color:'hsl(var(--secondary-foreground))', border:'1px solid transparent'},
    ghost:{ background:'transparent', color:'hsl(var(--muted-foreground))', border:'1px solid transparent'},
    destructive:{ background:'hsl(var(--destructive))', color:'#fff', border:'1px solid hsl(var(--destructive))'},
    settle:{ background:'hsl(var(--success))', color:'#fff', border:'1px solid hsl(var(--success))'},
  }[variant];
  return (
    <button
      {...p}
      className={cn('adv-btn',className)}
      style={{...styles, ...v}}
      onMouseDown={e=>{ e.currentTarget.style.transform='scale(0.97)'; }}
      onMouseUp={e=>{ e.currentTarget.style.transform=''; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; }}
    >{children}</button>
  );
}

function Card({children, className='', style={}, hover=false, onClick}){
  const [h,setH] = useState(false);
  return (
    <div
      onClick={onClick}
      className={className}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{
        background:'hsl(var(--card))', border:'1px solid '+(hover&&h?'hsl(var(--foreground)/0.2)':'hsl(var(--border))'),
        borderRadius:10, transition:'border-color 160ms var(--ease-out), transform 160ms var(--ease-out), box-shadow 200ms var(--ease-out)',
        boxShadow: hover&&h?'0 2px 8px rgba(0,0,0,.04)':'none',
        transform: hover&&h?'translateY(-1px)':'none',
        cursor: onClick?'pointer':'default',
        ...style,
      }}>{children}</div>
  );
}

function Chip({children, tone='blue', style={}}){
  const tones={
    blue:{bg:'var(--pastel-blue-bg)', fg:'var(--pastel-blue-fg)'},
    green:{bg:'var(--pastel-green-bg)', fg:'var(--pastel-green-fg)'},
    yellow:{bg:'var(--pastel-yellow-bg)', fg:'var(--pastel-yellow-fg)'},
    red:{bg:'var(--pastel-red-bg)', fg:'var(--pastel-red-fg)'},
    muted:{bg:'hsl(var(--muted))', fg:'hsl(var(--muted-foreground))'},
    new:{bg:'hsl(var(--badge-new)/0.15)', fg:'hsl(var(--badge-new))'},
  }[tone];
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,borderRadius:999,padding:'2px 8px',fontSize:11,fontWeight:500,background:tones.bg,color:tones.fg,whiteSpace:'nowrap',...style}}>{children}</span>;
}

function Dot({tone='green', size=8}){
  const c = {green:'var(--pastel-green-fg)', yellow:'var(--pastel-yellow-fg)', red:'var(--pastel-red-fg)', blue:'var(--pastel-blue-fg)'}[tone];
  return <span style={{width:size,height:size,borderRadius:999,display:'inline-block',background:c,flexShrink:0}}/>;
}

function Eyebrow({children, style={}}){
  return <p style={{font:'500 11px/1.2 var(--font-sans)', textTransform:'uppercase', letterSpacing:'0.14em', color:'hsl(var(--muted-foreground))', margin:'0 0 4px', ...style}}>{children}</p>;
}

function PageTitle({children, subline, eyebrow}){
  return (
    <div style={{marginBottom:24}}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 style={{font:'500 clamp(24px,3vw,30px)/1.1 var(--font-sans)', letterSpacing:'-0.02em', color:'hsl(var(--foreground))', margin:0}}>{children}</h1>
      {subline && <p style={{fontSize:14, color:'hsl(var(--muted-foreground))', margin:'6px 0 0'}}>{subline}</p>}
    </div>
  );
}

function SectionLabel({children, incomplete}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <div style={{width:2,height:14,borderRadius:2,background:'hsl(var(--foreground)/0.25)'}}/>
      <span style={{font:'500 11px/1.2 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.14em',color:'hsl(var(--muted-foreground))',display:'inline-flex',alignItems:'center',gap:6}}>
        {children}
        {incomplete && <span style={{width:6,height:6,borderRadius:999,background:'hsl(38 92% 50%)'}}/>}
      </span>
    </div>
  );
}

function FieldRow({label, value, mono, empty, onClick}){
  if(!value && !empty) return null;
  return (
    <div onClick={onClick} style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:10,padding:'5px 0',cursor:onClick?'pointer':'default'}}>
      <span style={{fontSize:13,color:'hsl(var(--muted-foreground))'}}>{label}</span>
      {value ? (
        <span style={{fontSize:13,color:'hsl(var(--foreground))',fontFamily:mono?'var(--font-mono)':'inherit',letterSpacing:mono?'-0.01em':'normal'}}>{value}</span>
      ) : (
        <span style={{fontSize:13,color:'hsl(var(--muted-foreground)/0.6)',fontStyle:'italic'}}>{empty}</span>
      )}
    </div>
  );
}

function StatTile({icon, tone='blue', label, value}){
  const c={
    blue:{bg:'var(--pastel-blue-bg)',fg:'var(--pastel-blue-fg)'},
    green:{bg:'var(--pastel-green-bg)',fg:'var(--pastel-green-fg)'},
    yellow:{bg:'var(--pastel-yellow-bg)',fg:'var(--pastel-yellow-fg)'},
    red:{bg:'var(--pastel-red-bg)',fg:'var(--pastel-red-fg)'},
  }[tone];
  return (
    <Card style={{padding:'14px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <span style={{width:22,height:22,borderRadius:6,display:'inline-flex',alignItems:'center',justifyContent:'center',background:c.bg,color:c.fg,flexShrink:0}}>
          <Icon name={icon} size={13}/>
        </span>
        <span style={{font:'500 10.5px/1.1 var(--font-sans)',textTransform:'uppercase',letterSpacing:'0.09em',color:'hsl(var(--muted-foreground))'}}>{label}</span>
      </div>
      <div style={{fontFamily:'var(--font-display)',fontSize:30,letterSpacing:'-0.03em',lineHeight:1,color:'hsl(var(--foreground))'}}>{value}</div>
    </Card>
  );
}

Object.assign(window, {cn, Icon, Button, Card, Chip, Dot, Eyebrow, PageTitle, SectionLabel, FieldRow, StatTile});
