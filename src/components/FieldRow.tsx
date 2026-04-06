import { cn } from "@/lib/utils";

interface FieldRowProps {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

export default function FieldRow({ label, value, mono }: FieldRowProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <span className={cn("text-sm text-foreground", mono && "font-mono text-[13px]")}>
        {value}
      </span>
    </div>
  );
}
