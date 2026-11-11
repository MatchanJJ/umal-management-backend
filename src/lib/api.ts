'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hc, type InferRequestType } from 'hono/client';
import type { AppType } from '../../server/app';
import type { AccessRequestDTO, BulkAccessResult, MeResponse, MemberDTO, Paged, TermDTO } from '../../shared/api';
import type { CatalogResponse, OnboardingInput, ProfileInput } from '../../shared/profile';
import type { ClassEntry, ScheduleResponse, UnavailabilityDTO } from '../../shared/schedule';
import type { Settings } from '../../shared/settings';
import type { AssignmentDTO, CreateAssignmentsInput } from '../../shared/assignments';
import type { EventDTO, EventInput, EventPatch } from '../../shared/events';
import type { SessionResponse, TurnResponse } from '../../shared/ai';
import type { Constraints, Pins } from '../../shared/constraints';
import type { AccessStatus, Role } from '../../shared/enums';

export const client = hc<AppType>('/', { init: { credentials: 'same-origin' } });

/** Error carrying the API's `{ error: { code, message, details? } }` body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  throw new ApiError(res.status, body.error?.code ?? 'HTTP_' + res.status, body.error?.message ?? res.statusText, body.error?.details);
}

// ── /api/me ───────────────────────────────────────────────────────────────
export type MeState = { kind: 'signed_out' } | { kind: 'signed_in'; me: MeResponse };

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<MeState> => {
      const res = await client.api.me.$get();
      if (res.status === 401) return { kind: 'signed_out' };
      return { kind: 'signed_in', me: await unwrap<MeResponse>(res) };
    },
    staleTime: 60_000,
  });
}

// ── Access queue ──────────────────────────────────────────────────────────
export function useAccessRequests(status: AccessStatus, page = 1) {
  return useQuery({
    queryKey: ['access-requests', status, page],
    queryFn: async () =>
      unwrap<Paged<AccessRequestDTO>>(
        await client.api['access-requests'].$get({ query: { status, page: String(page), pageSize: '25' } }),
      ),
  });
}

export function usePendingAccessCount(enabled: boolean) {
  return useQuery({
    queryKey: ['access-requests', 'pending', 'count'],
    enabled,
    queryFn: async () =>
      (
        await unwrap<Paged<AccessRequestDTO>>(
          await client.api['access-requests'].$get({ query: { status: 'pending', pageSize: '1' } }),
        )
      ).total,
    refetchInterval: 60_000,
  });
}

function useInvalidateAccess() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['access-requests'] });
}

export function useApproveAccess() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: Role }) =>
      unwrap<AccessRequestDTO>(
        await client.api['access-requests'][':id'].approve.$post({ param: { id: String(id) }, json: { role } }),
      ),
    onSuccess: invalidate,
  });
}

export function useRejectAccess() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: async ({ id, note }: { id: number; note?: string }) =>
      unwrap<AccessRequestDTO>(
        await client.api['access-requests'][':id'].reject.$post({ param: { id: String(id) }, json: { note } }),
      ),
    onSuccess: invalidate,
  });
}

type BulkInput = InferRequestType<(typeof client.api)['access-requests']['bulk']['$post']>['json'];

export function useBulkApprove() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: async (json: BulkInput) =>
      unwrap<BulkAccessResult>(await client.api['access-requests'].bulk.$post({ json })),
    onSuccess: invalidate,
  });
}

// ── Catalog + own profile ─────────────────────────────────────────────────
/** Active colleges/courses; `all` (advisers) includes inactive ones. */
export function useCatalog(all = false) {
  return useQuery({
    queryKey: ['catalog', all],
    queryFn: async () => unwrap<CatalogResponse>(await client.api.catalog.$get({ query: all ? { all: '1' } : {} })),
    staleTime: 5 * 60_000,
  });
}

export function useOnboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: OnboardingInput) => unwrap<MemberDTO>(await client.api.me.onboarding.$post({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: ProfileInput) => unwrap<MemberDTO>(await client.api.me.profile.$patch({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

// ── Settings: terms, catalog, general (adviser) ───────────────────────────
export function useTerms() {
  return useQuery({ queryKey: ['terms'], queryFn: async () => unwrap<TermDTO[]>(await client.api.terms.$get()) });
}

function useInvalidate(...keys: string[][]) {
  const qc = useQueryClient();
  return () => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useCreateTerm() {
  const onSuccess = useInvalidate(['terms']);
  return useMutation({
    mutationFn: async (json: { name: string; startDate: string; endDate: string }) =>
      unwrap<TermDTO>(await client.api.terms.$post({ json })),
    onSuccess,
  });
}

export function useActivateTerm() {
  const onSuccess = useInvalidate(['terms'], ['me']);
  return useMutation({
    mutationFn: async (id: number) => unwrap<TermDTO>(await client.api.terms[':id'].activate.$post({ param: { id: String(id) } })),
    onSuccess,
  });
}

export function useSaveCollege() {
  const onSuccess = useInvalidate(['catalog']);
  return useMutation({
    mutationFn: async ({ id, ...json }: { id?: number; code?: string; name?: string; active?: boolean }) =>
      unwrap(
        id
          ? await client.api.catalog.colleges[':id'].$patch({ param: { id: String(id) }, json })
          : await client.api.catalog.colleges.$post({ json: json as { code: string; name: string } }),
      ),
    onSuccess,
  });
}

export function useSaveCourse() {
  const onSuccess = useInvalidate(['catalog']);
  return useMutation({
    mutationFn: async ({ id, ...json }: { id?: number; collegeId?: number; code?: string; name?: string; active?: boolean }) =>
      unwrap(
        id
          ? await client.api.catalog.courses[':id'].$patch({ param: { id: String(id) }, json })
          : await client.api.catalog.courses.$post({ json: json as { collegeId: number; code: string; name: string } }),
      ),
    onSuccess,
  });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: async () => unwrap<Settings>(await client.api.settings.$get()) });
}

export function useSaveSettings() {
  const onSuccess = useInvalidate(['settings']);
  return useMutation({
    mutationFn: async (json: Partial<Settings>) => unwrap<Settings>(await client.api.settings.$put({ json })),
    onSuccess,
  });
}

// ── Own class schedule ────────────────────────────────────────────────────
export function useSchedule(termId?: number) {
  return useQuery({
    queryKey: ['schedule', termId ?? 'active'],
    queryFn: async () =>
      unwrap<ScheduleResponse>(await client.api.me.schedule.$get({ query: termId ? { termId: String(termId) } : {} })),
  });
}

export async function fetchSchedule(termId: number) {
  return unwrap<ScheduleResponse>(await client.api.me.schedule.$get({ query: { termId: String(termId) } }));
}

export function useSaveSchedule() {
  const onSuccess = useInvalidate(['schedule'], ['me']);
  return useMutation({
    mutationFn: async (json: { termId: number; entries: ClassEntry[] }) => unwrap(await client.api.me.schedule.$put({ json })),
    onSuccess,
  });
}

// ── Own assignments + unavailability ──────────────────────────────────────
export type MyAssignment = {
  assignmentId: number;
  status: 'assigned' | 'attended' | 'no_show' | 'excused';
  eventId: number;
  eventTitle: string;
  venue: string | null;
  shiftId: number;
  shiftLabel: string;
  startAt: string;
  endAt: string;
  hours: number;
};
export type MyAssignments = {
  upcoming: MyAssignment[];
  past: MyAssignment[];
  termStats: { hours: number; shifts: number; attended: number; noShow: number };
};

export function useMyAssignments() {
  return useQuery({ queryKey: ['my-assignments'], queryFn: async () => unwrap<MyAssignments>(await client.api.me.assignments.$get()) });
}

export function useUnavailability() {
  return useQuery({
    queryKey: ['unavailability'],
    queryFn: async () => unwrap<UnavailabilityDTO[]>(await client.api.me.unavailability.$get()),
  });
}

export function useAddUnavailability() {
  const onSuccess = useInvalidate(['unavailability']);
  return useMutation({
    mutationFn: async (json: InferRequestType<typeof client.api.me.unavailability.$post>['json']) =>
      unwrap<UnavailabilityDTO>(await client.api.me.unavailability.$post({ json })),
    onSuccess,
  });
}

export function useDeleteUnavailability() {
  const onSuccess = useInvalidate(['unavailability']);
  return useMutation({
    mutationFn: async (id: number) => unwrap(await client.api.me.unavailability[':id'].$delete({ param: { id: String(id) } })),
    onSuccess,
  });
}

// ── Events, roster, manual assignment ─────────────────────────────────────
export type RosterAssignment = { id: number; memberId: number; name: string; status: string; source: string; conflictOverride: boolean };
export type Roster = {
  version: number;
  shifts: { shiftId: number; label: string; startAt: string; endAt: string; requiredVolunteers: number; assignments: RosterAssignment[] }[];
};
export type Candidate = {
  member: { id: number; firstName: string | null; lastName: string | null; email: string; studentNumber: string | null; collegeCode: string | null; yearLevel: number | null; termHours: number };
  eligibility: { hard: string[]; soft: string[] };
  score: { total: number; loadGap: number; recency: number; reliability: number };
};

export function useEvents(status?: EventDTO['status']) {
  return useQuery({
    queryKey: ['events', status ?? 'all'],
    queryFn: async () => unwrap<{ items: EventDTO[]; total: number }>(await client.api.events.$get({ query: status ? { status } : {} })),
  });
}

export function useEvent(id: number | null) {
  return useQuery({
    queryKey: ['event', id],
    enabled: id !== null,
    queryFn: async () => unwrap<EventDTO>(await client.api.events[':id'].$get({ param: { id: String(id) } })),
  });
}

export function useRoster(id: number | null) {
  return useQuery({
    queryKey: ['roster', id],
    enabled: id !== null,
    queryFn: async () => unwrap<Roster>(await client.api.events[':id'].roster.$get({ param: { id: String(id) } })),
  });
}

/** Everything that changes when an event or its roster changes. */
function useInvalidateEvent() {
  const qc = useQueryClient();
  return (id?: number) =>
    Promise.all([qc.invalidateQueries({ queryKey: ['events'] }), qc.invalidateQueries({ queryKey: ['event', id] }), qc.invalidateQueries({ queryKey: ['roster', id] }), qc.invalidateQueries({ queryKey: ['candidates', id] })]);
}

export function useCreateEvent() {
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: async (json: EventInput) => unwrap<EventDTO>(await client.api.events.$post({ json })),
    onSuccess: () => invalidate(),
  });
}

export function usePatchEvent(id: number) {
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: async (json: EventPatch) => unwrap<EventDTO>(await client.api.events[':id'].$patch({ param: { id: String(id) }, json })),
    onSettled: () => invalidate(id),
  });
}

export function useDailyShifts(id: number) {
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: async (json: InferRequestType<(typeof client.api.events)[':id']['shifts']['daily']['$post']>['json']) =>
      unwrap<EventDTO>(await client.api.events[':id'].shifts.daily.$post({ param: { id: String(id) }, json })),
    onSettled: () => invalidate(id),
  });
}

export function useCancelEvent(id: number) {
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: async (json: { reason: string; expectedVersion: number }) =>
      unwrap<EventDTO>(await client.api.events[':id'].cancel.$post({ param: { id: String(id) }, json })),
    onSettled: () => invalidate(id),
  });
}

export function useCandidates(eventId: number, shiftId: number | null, search: string) {
  return useQuery({
    queryKey: ['candidates', eventId, shiftId, search],
    enabled: shiftId !== null,
    queryFn: async () =>
      unwrap<{ items: Candidate[] }>(
        await client.api.events[':id'].candidates.$get({ param: { id: String(eventId) }, query: { shiftId: String(shiftId), ...(search ? { search } : {}) } }),
      ),
  });
}

/** On 409 the roster is refetched (onSettled) so the adviser sees the other person's change. */
export function useAddAssignments(eventId: number) {
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: async (json: CreateAssignmentsInput) =>
      unwrap<{ created: AssignmentDTO[]; version: number }>(await client.api.events[':id'].assignments.$post({ param: { id: String(eventId) }, json })),
    onSettled: () => invalidate(eventId),
  });
}

export function useCancelAssignment(eventId: number) {
  const invalidate = useInvalidateEvent();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      unwrap(await client.api.assignments[':id'].cancel.$post({ param: { id: String(id) }, json: { reason } })),
    onSettled: () => invalidate(eventId),
  });
}

// ── AssignAI ──────────────────────────────────────────────────────────────
/** Starts or resumes this adviser's open session (the POST is idempotent). */
export function useAiSession(eventId: number) {
  return useQuery({
    queryKey: ['ai-session', eventId],
    queryFn: async () => unwrap<SessionResponse>(await client.api.events[':id']['ai-sessions'].$post({ param: { id: String(eventId) } })),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useAiTurn(sessionId: number) {
  return useMutation({
    mutationFn: async (json: { message: string; pins: Pins; scope: { shiftIds: number[] } }) =>
      unwrap<TurnResponse>(await client.api['ai-sessions'][':id'].turns.$post({ param: { id: String(sessionId) }, json })),
  });
}

export function useAiConstraints(sessionId: number) {
  return useMutation({
    mutationFn: async (json: { constraints: Constraints; pins: Pins; scope: { shiftIds: number[] } }) =>
      unwrap<TurnResponse>(await client.api['ai-sessions'][':id'].constraints.$put({ param: { id: String(sessionId) }, json })),
  });
}
