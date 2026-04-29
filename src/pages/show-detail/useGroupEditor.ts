import { useRef, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Show } from "@/lib/types";

export interface UseGroupEditorArgs<K extends keyof Show> {
  groupKey: string;
  keys: readonly K[];
  show: Show | undefined;
  inlineField: string | null;
  setInlineField: (v: string | null) => void;
  updateMutation: UseMutationResult<unknown, unknown, Partial<Show>>;
  normalizers?: Partial<Record<K, (v: string) => string>>;
  isEmpty: (show: Show) => boolean;
}

export function useGroupEditor<K extends keyof Show>(args: UseGroupEditorArgs<K>) {
  const [form, setForm] = useState<Record<string, string>>({});
  // Mirror form into a ref so save() always reads the latest committed values.
  // setField is often called from a child's onBlur (e.g. TimeInput) right
  // before the container's own onBlur fires save(); the setState scheduled by
  // setField hasn't flushed yet within that event dispatch, so reading from
  // `form` directly would close over the previous render's stale values.
  const formRef = useRef<Record<string, string>>({});

  const isEditing = args.inlineField === args.groupKey;
  const empty = !!args.show && args.isEmpty(args.show);

  const startEdit = () => {
    if (!args.show) return;
    const seed: Record<string, string> = {};
    for (const k of args.keys) {
      seed[k as string] = (args.show[k] as string | null) ?? "";
    }
    formRef.current = seed;
    setForm(seed);
    args.setInlineField(args.groupKey);
  };

  const cancel = () => args.setInlineField(null);

  const save = () => {
    const latest = formRef.current;
    const patch: Record<string, string | null> = {};
    for (const k of args.keys) {
      const raw = latest[k as string] ?? "";
      const fn = args.normalizers?.[k];
      const val = fn && raw ? fn(raw) : raw;
      patch[k as string] = val || null;
    }
    args.updateMutation.mutate(patch as Partial<Show>);
  };

  const get = (k: K) => form[k as string] ?? "";
  const setField = (k: K, v: string) => {
    formRef.current = { ...formRef.current, [k as string]: v };
    setForm(p => ({ ...p, [k as string]: v }));
  };

  return {
    isEditing,
    empty,
    startEdit,
    cancel,
    save,
    get,
    setField,
    saving: args.updateMutation.isPending,
  };
}
