interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  incomplete?: boolean;
}

export default function FieldGroup({ title, children, className, incomplete }: FieldGroupProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-0.5 h-3.5 rounded-full bg-foreground/25 shrink-0" />
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          {title}
          {incomplete && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
