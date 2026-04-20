import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export default function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "text-[11px] uppercase tracking-widest text-muted-foreground font-medium",
        className,
      )}
    >
      {children}
    </p>
  );
}
