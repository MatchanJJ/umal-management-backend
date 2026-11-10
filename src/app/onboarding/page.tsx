'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AppGate } from '@/components/layout/AppGate';
import { ACADEMIC_FIELDS, AcademicFields, applyServerError, PERSONAL_FIELDS, PersonalFields } from '@/components/profile/ProfileFields';
import { Button } from '@/components/ui/button';
import { useCatalog, useOnboard } from '@/lib/api';
import { signOut } from '@/lib/auth-client';
import type { MeResponse } from '../../../shared/api';
import { OnboardingInput } from '../../../shared/profile';

const STEPS = ['Personal', 'Academic'] as const;

function OnboardingForm({ me }: { me: MeResponse }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const catalog = useCatalog();
  const onboard = useOnboard();
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(OnboardingInput),
    defaultValues: { firstName: me.user.name.split(' ')[0] ?? '', courseId: null },
  });

  const submit = form.handleSubmit((values) =>
    onboard.mutate(values, {
      onSuccess: () => {
        toast.success('Profile saved. Next, add your class schedule.');
        router.replace('/me/schedule/');
      },
      onError: (e) => {
        if (applyServerError(form, e)) {
          // The student number lives on step 1.
          if (form.formState.errors.studentNumber) setStep(0);
        } else toast.error(e.message);
      },
    }),
  );

  return (
    <main className="min-h-svh bg-background">
      {/* Brand band (Design Brief §5): onboarding header. */}
      <header className="bg-primary px-4 py-8 text-primary-foreground sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-primary-foreground/85">Welcome to UMAL</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Complete your profile</h1>
          <span aria-hidden className="mt-3 block h-[3px] w-10 bg-secondary" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <ol className="mb-6 flex gap-2 text-sm" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={i === step ? 'font-semibold text-primary' : 'text-muted-foreground'}
            >
              {i + 1}. {label}
              {i < STEPS.length - 1 && <span aria-hidden className="ml-2 text-muted-foreground">→</span>}
            </li>
          ))}
        </ol>

        <form onSubmit={submit} noValidate className="space-y-6">
          {step === 0 ? <PersonalFields form={form} /> : <AcademicFields form={form} catalog={catalog.data} />}

          <div className="flex items-center justify-between gap-2">
            {step === 0 ? (
              <Button type="button" variant="ghost" onClick={() => signOut()}>
                Sign out
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
            )}
            {step === 0 ? (
              <Button type="button" onClick={async () => (await form.trigger([...PERSONAL_FIELDS])) && setStep(1)}>
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={onboard.isPending}
                onClick={() => form.trigger([...ACADEMIC_FIELDS])}
              >
                {onboard.isPending ? 'Saving…' : 'Finish'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <AppGate require="onboarding">{(me) => <OnboardingForm me={me!} />}</AppGate>;
}
