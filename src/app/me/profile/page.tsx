'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { AcademicFields, applyServerError, PersonalFields } from '@/components/profile/ProfileFields';
import { Button } from '@/components/ui/button';
import { useCatalog, useUpdateProfile } from '@/lib/api';
import type { MeResponse } from '../../../../shared/api';
import { OnboardingInput } from '../../../../shared/profile';

function ProfileForm({ me }: { me: MeResponse }) {
  const m = me.member!;
  const catalog = useCatalog();
  const update = useUpdateProfile();
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(OnboardingInput),
    defaultValues: {
      firstName: m.firstName ?? '',
      lastName: m.lastName ?? '',
      studentNumber: m.studentNumber ?? '',
      gender: m.gender ?? undefined,
      collegeId: m.collegeId ?? undefined,
      courseId: m.courseId,
      yearLevel: m.yearLevel ?? undefined,
      batchYear: m.batchYear ?? undefined,
      heightCm: m.heightCm ?? undefined,
      tshirtSize: (m.tshirtSize as OnboardingInput['tshirtSize']) ?? undefined,
    },
  });

  return (
    <form
      noValidate
      className="max-w-2xl space-y-8"
      onSubmit={form.handleSubmit((values) =>
        update.mutate(values, {
          onSuccess: () => toast.success('Profile saved'),
          onError: (e) => applyServerError(form, e) || toast.error(e.message),
        }),
      )}
    >
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{m.email}</span>. Ask an adviser to change your email or role.
      </p>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Personal</h2>
        <PersonalFields form={form} />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Academic</h2>
        <AcademicFields form={form} catalog={catalog.data} />
      </section>
      <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
        {update.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  return (
    <AppGate require="onboarded">
      {(me) =>
        me!.member!.role === 'adviser' ? (
          <AdviserShell me={me!} title="Profile">
            <ProfileForm me={me!} />
          </AdviserShell>
        ) : (
          // shortcut: plain container until Task 2.3 adds the member shell.
          <main className="mx-auto w-full max-w-[960px] p-4 sm:p-6">
            <h1 className="text-2xl font-bold">Profile</h1>
            <span aria-hidden className="mt-2 mb-6 block h-[3px] w-10 bg-secondary" />
            <ProfileForm me={me!} />
          </main>
        )
      }
    </AppGate>
  );
}
