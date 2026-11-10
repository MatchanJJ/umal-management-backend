'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useCatalog, useSaveCollege, useSaveCourse } from '@/lib/api';
import { cn } from '@/lib/utils';

/** One-line "code + name" add form, used for both colleges and courses. */
function AddRow({ label, onAdd, pending }: { label: string; onAdd: (code: string, name: string, reset: () => void) => void; pending: boolean }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const id = label.toLowerCase().replace(/\W+/g, '-');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && name.trim())
          onAdd(code, name, () => {
            setCode('');
            setName('');
          });
      }}
    >
      <div className="w-28 space-y-1">
        <Label htmlFor={`${id}-code`} className="text-xs">
          Code
        </Label>
        <Input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="BSCS" />
      </div>
      <div className="min-w-48 flex-1 space-y-1">
        <Label htmlFor={`${id}-name`} className="text-xs">
          Name
        </Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="BS Computer Science" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        <PlusIcon className="size-4" aria-hidden /> {label}
      </Button>
    </form>
  );
}

export function CatalogSettings() {
  const { data, isLoading } = useCatalog(true);
  const saveCollege = useSaveCollege();
  const saveCourse = useSaveCourse();
  const [open, setOpen] = useState<number | null>(null);
  const onError = (e: Error) => toast.error(e.message);

  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <AddRow
        label="Add college"
        pending={saveCollege.isPending}
        onAdd={(code, name, reset) => saveCollege.mutate({ code, name }, { onSuccess: () => (reset(), toast.success(`Added ${code.toUpperCase()}`)), onError })}
      />
      <ul className="divide-y rounded-lg border">
        {data.colleges.map((col) => (
          <li key={col.id} className="p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex-1 text-left"
                aria-expanded={open === col.id}
                onClick={() => setOpen(open === col.id ? null : col.id)}
              >
                <span className={cn('font-semibold', !col.active && 'text-muted-foreground line-through')}>{col.code}</span>
                <span className="ml-2 text-sm text-muted-foreground">{col.name}</span>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  · {col.courses.length} {col.courses.length === 1 ? 'course' : 'courses'}
                </span>
              </button>
              <Switch
                checked={col.active}
                aria-label={`${col.code} active`}
                onCheckedChange={(active) => saveCollege.mutate({ id: col.id, active }, { onError })}
              />
            </div>
            {open === col.id && (
              <div className="mt-3 space-y-3 border-l-2 border-primary/20 pl-4">
                {col.courses.length ? (
                  <ul className="space-y-1">
                    {col.courses.map((k) => (
                      <li key={k.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className={cn(!k.active && 'text-muted-foreground line-through')}>
                          <span className="font-medium">{k.code}</span> · {k.name}
                        </span>
                        <Switch
                          checked={k.active}
                          aria-label={`${k.code} active`}
                          onCheckedChange={(active) => saveCourse.mutate({ id: k.id, active }, { onError })}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No courses yet.</p>
                )}
                <AddRow
                  label="Add course"
                  pending={saveCourse.isPending}
                  onAdd={(code, name, reset) =>
                    saveCourse.mutate({ collegeId: col.id, code, name }, { onSuccess: () => (reset(), toast.success(`Added ${code.toUpperCase()}`)), onError })
                  }
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
