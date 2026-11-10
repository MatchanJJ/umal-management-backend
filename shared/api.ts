// API response shapes shared by the client and server.
import type { AccessStatus, MemberStatus, Role } from './enums';

export type MemberDTO = {
  id: number;
  email: string;
  role: Role;
  status: MemberStatus;
  firstName: string | null;
  lastName: string | null;
  studentNumber: string | null;
  gender: 'M' | 'F' | null;
  collegeId: number | null;
  courseId: number | null;
  yearLevel: number | null;
  batchYear: number | null;
  heightCm: number | null;
  tshirtSize: string | null;
  onboardedAt: string | null;
};

export type TermDTO = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type MeResponse = {
  user: { id: string; email: string; name: string; image: string | null };
  accessStatus: AccessStatus;
  onboarded: boolean;
  member: MemberDTO | null;
  activeTerm: TermDTO | null;
  scheduleSubmitted: boolean;
};
