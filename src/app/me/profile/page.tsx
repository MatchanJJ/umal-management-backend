'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AppGate } from '@/components/layout/AppGate';
import { AppShell } from '@/components/layout/MemberShell';
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
        Signed in as <span className="font-medium text-foreground">{m.email}</span>
        {m.studentNumber && <> · Student no. <span className="font-medium text-foreground tabular-nums">{m.studentNumber}</span></>}. Ask
        an adviser to change your email or role.
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
      {(me) => (
        <AppShell me={me!} title="Profile">
          <ProfileForm me={me!} />
        </AppShell>
      )}
    </AppGate>
  );
}
