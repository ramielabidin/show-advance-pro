import { Car, X } from "lucide-react";

interface DriveTimeCalloutProps {
  driveTimeLabel: string;
  originLabel: string;
  distanceText?: string | null;
  onDismiss?: () => void;
}

export default function DriveTimeCallout({ driveTimeLabel, originLabel, distanceText, onDismiss }: DriveTimeCalloutProps) {
  return (
    <div className="flex items-start gap-3.5 rounded-md border border-border bg-muted/40 px-3.5 py-3">
      <Car className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-[26px] leading-none tracking-[-0.02em] text-foreground">
          {driveTimeLabel}
        </div>
        <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground leading-none">
          drive from {originLabel}
          {distanceText && (
            <>
              <span className="text-border mx-1.5">·</span>
              <span className="font-mono normal-case tracking-normal">{distanceText}</span>
            </>
          )}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent [transition:color_150ms_var(--ease-out),background-color_150ms_var(--ease-out)]"
          aria-label="Dismiss drive time"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
