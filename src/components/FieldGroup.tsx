interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  incomplete?: boolean;
}

export default function FieldGroup({ title, children, className, incomplete }: FieldGroupProps) {
  return (
    <div className={className}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        {title}
        {incomplete && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}