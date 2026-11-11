'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hc, type InferRequestType } from 'hono/client';
import type { AppType } from '../../server/app';
import type { AccessRequestDTO, BulkAccessResult, MeResponse, MemberDTO, Paged, TermDTO } from '../../shared/api';
import type { CatalogResponse, OnboardingInput, ProfileInput } from '../../shared/profile';
import type { ClassEntry, ScheduleResponse } from '../../shared/schedule';
import type { Settings } from '../../shared/settings';
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
