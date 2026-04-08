import { Users, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SECTIONS,
  ALL_SECTION_KEYS,
  BAND_VIEW_KEYS,
  hasData,
  withData,
  type SectionKey,
} from "@/lib/daysheetSections";
import type { Show } from "@/lib/types";

interface DaySheetSectionPickerProps {
  show: Show & { schedule_entries?: any[] };
  selected: Set<SectionKey>;
  onChange: (next: Set<SectionKey>) => void;
  /** Prefix for HTML id attrs — prevents conflicts when two pickers exist. */
  idPrefix?: string;
}

/**
 * Shared section-picker UI used by both SlackPushDialog and EmailBandDialog.
 *
 * Preset logic:
 *   - "Band View"  → BAND_VIEW_KEYS filtered to sections that have data
 *   - "Full View"  → all sections filtered to sections that have data
 *
 * Sections without data are rendered dimmed and unchecked so the user can
 * see what fields exist without being misled into sending empty content.
 */
export default function DaySheetSectionPicker({
  show,
  selected,
  onChange,
  idPrefix = "dsp",
}: DaySheetSectionPickerProps) {
  const toggle = (key: SectionKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const allSelected = selected.size === SECTIONS.length;

  const toggleAll = () => {
    onChange(allSelected ? new Set() : new Set(ALL_SECTION_KEYS));
  };

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onChange(new Set(BAND_VIEW_KEYS))}
        >
          <Users className="h-3.5 w-3.5" />
          Band View
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onChange(withData(ALL_SECTION_KEYS, show))}
        >
          <LayoutList className="h-3.5 w-3.5" />
          Full View
        </Button>
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Checkbox
          id={`${idPrefix}-all`}
          checked={allSelected}
          onCheckedChange={toggleAll}
        />
        <Label htmlFor={`${idPrefix}-all`} className="text-sm font-medium cursor-pointer">
          Select All
        </Label>
      </div>

      {/* Section grid — empty sections dimmed, not disabled (user can still force-include) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {SECTIONS.map((s) => {
          const populated = hasData(show, s.key);
          return (
            <div key={s.key} className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-${s.key}`}
                checked={selected.has(s.key)}
                onCheckedChange={() => toggle(s.key)}
              />
              <Label
                htmlFor={`${idPrefix}-${s.key}`}
                className={cn(
                  "text-sm cursor-pointer leading-tight",
                  !populated && "text-muted-foreground/40"
                )}
              >
                {s.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
