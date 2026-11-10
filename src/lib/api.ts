'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hc, type InferRequestType } from 'hono/client';
import type { AppType } from '../../server/app';
import type { AccessRequestDTO, BulkAccessResult, MeResponse, MemberDTO, Paged } from '../../shared/api';
import type { CatalogResponse, OnboardingInput, ProfileInput } from '../../shared/profile';
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
export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => unwrap<CatalogResponse>(await client.api.catalog.$get()),
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
