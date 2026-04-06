interface FieldGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function FieldGroup({ title, children, className }: FieldGroupProps) {
  return (
    <div className={className}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
