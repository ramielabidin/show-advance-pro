import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "yellow" | "red" | "purple";

const TONE_STYLES: Record<Tone, { backgroundColor: string; color: string }> = {
  blue: { backgroundColor: "var(--pastel-blue-bg)", color: "var(--pastel-blue-fg)" },
  green: { backgroundColor: "var(--pastel-green-bg)", color: "var(--pastel-green-fg)" },
  yellow: { backgroundColor: "var(--pastel-yellow-bg)", color: "var(--pastel-yellow-fg)" },
  red: { backgroundColor: "var(--pastel-red-bg)", color: "var(--pastel-red-fg)" },
  purple: { backgroundColor: "var(--pastel-purple-bg)", color: "var(--pastel-purple-fg)" },
};

interface StatTileProps {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: React.ReactNode;
  className?: string;
}

export default function StatTile({ icon: Icon, tone, label, value, className }: StatTileProps) {
  return (
    <Card className={cn("overflow-hidden shadow-none", className)}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
            style={TONE_STYLES[tone]}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium leading-tight truncate">
            {label}
          </span>
        </div>
        <p className="text-3xl font-display text-foreground leading-none tracking-[-0.03em]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
