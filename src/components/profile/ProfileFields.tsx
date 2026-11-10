'use client';

import { Controller, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import { TSHIRT_SIZES } from '../../../shared/enums';
import type { CatalogResponse, OnboardingInput } from '../../../shared/profile';

type Form = UseFormReturn<OnboardingInput>;

export const PERSONAL_FIELDS = ['firstName', 'lastName', 'studentNumber', 'gender', 'batchYear', 'heightCm', 'tshirtSize'] as const;
export const ACADEMIC_FIELDS = ['collegeId', 'courseId', 'yearLevel'] as const;

function Req() {
  return (
    <span aria-hidden className="text-primary">
      *
    </span>
  );
}

function TextField({ form, name, label, ...input }: { form: Form; name: FieldPath<OnboardingInput>; label: string } & Omit<React.ComponentProps<'input'>, 'form' | 'name'>) {
  const err = form.formState.errors[name as keyof OnboardingInput];
  const numeric = input.type === 'number';
  return (
    <Field data-invalid={!!err}>
      <FieldLabel htmlFor={name}>
        {label} <Req />
      </FieldLabel>
      <Input
        id={name}
        aria-invalid={!!err}
        aria-describedby={err ? `${name}-error` : undefined}
        {...input}
        {...form.register(name, numeric ? { setValueAs: (v) => (v === '' ? undefined : Number(v)) } : {})}
      />
      <FieldError id={`${name}-error`} errors={[err]} />
    </Field>
  );
}

function SelectField({
  form,
  name,
  label,
  options,
  placeholder,
  disabled,
}: {
  form: Form;
  name: 'gender' | 'tshirtSize' | 'collegeId' | 'courseId' | 'yearLevel';
  label: string;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const err = form.formState.errors[name];
  const numeric = name === 'collegeId' || name === 'courseId' || name === 'yearLevel';
  return (
    <Field data-invalid={!!err}>
      <FieldLabel htmlFor={name}>
        {label} {name !== 'courseId' && <Req />}
      </FieldLabel>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value == null ? '' : String(field.value)}
            onValueChange={(v) => {
              field.onChange(numeric ? Number(v) : v);
              // Courses are per college, so a new college clears the course.
              if (name === 'collegeId') form.setValue('courseId', null);
            }}
            disabled={disabled}
          >
            <SelectTrigger id={name} className="w-full" aria-invalid={!!err} aria-describedby={err ? `${name}-error` : undefined}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError id={`${name}-error`} errors={[err]} />
    </Field>
  );
}

export function PersonalFields({ form }: { form: Form }) {
  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <TextField form={form} name="firstName" label="First name" autoComplete="given-name" />
      <TextField form={form} name="lastName" label="Last name" autoComplete="family-name" />
      <TextField form={form} name="studentNumber" label="Student number" inputMode="numeric" />
      <SelectField
        form={form}
        name="gender"
        label="Gender"
        placeholder="Select"
        options={[
          { value: 'M', label: 'Male' },
          { value: 'F', label: 'Female' },
        ]}
      />
      <TextField form={form} name="batchYear" label="Batch year (school year you joined)" type="number" min={2000} max={2100} />
      <TextField form={form} name="heightCm" label="Height (cm)" type="number" min={100} max={230} />
      <SelectField
        form={form}
        name="tshirtSize"
        label="T-shirt size"
        placeholder="Select"
        options={TSHIRT_SIZES.map((s) => ({ value: s, label: s }))}
      />
    </FieldGroup>
  );
}

export function AcademicFields({ form, catalog }: { form: Form; catalog: CatalogResponse | undefined }) {
  const collegeId = form.watch('collegeId');
  const courses = catalog?.colleges.find((c) => c.id === collegeId)?.courses ?? [];
  return (
    <FieldGroup className="grid gap-4">
      <SelectField
        form={form}
        name="collegeId"
        label="College"
        placeholder={catalog ? 'Select your college' : 'Loading…'}
        disabled={!catalog}
        options={(catalog?.colleges ?? []).map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))}
      />
      <SelectField
        form={form}
        name="courseId"
        label="Course"
        placeholder={!collegeId ? 'Pick a college first' : courses.length ? 'Select your course' : 'No courses listed yet'}
        disabled={!collegeId || !courses.length}
        options={courses.map((c) => ({ value: String(c.id), label: `${c.code} · ${c.name}` }))}
      />
      <SelectField
        form={form}
        name="yearLevel"
        label="Year level"
        placeholder="Select"
        options={[1, 2, 3, 4, 5].map((y) => ({ value: String(y), label: `Year ${y}` }))}
      />
    </FieldGroup>
  );
}

/** Maps the API's field-level errors (409 student number, 422 course) onto the form. Returns true when handled. */
export function applyServerError(form: Form, e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  const field = (e.details as { field?: keyof OnboardingInput } | undefined)?.field;
  if (field) {
    form.setError(field, { message: e.message }, { shouldFocus: true });
    return true;
  }
  return false;
}
