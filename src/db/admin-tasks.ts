"server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import {
  hasAdminGrant,
  hasPeopleAdminGrant,
  isLegalOfficer,
  type UserAuthority,
} from "@/lib/permissions";
import db from ".";
import type { Department } from "./schema/auth";
import { user } from "./schema/auth";
import { legalMembership } from "./schema/legal-membership";
import { membershipTransitionRequest } from "./schema/membership-transition-request";

export type AdminTaskKind =
  | "admission"
  | "alumni_request"
  | "supporting_alumni_request"
  | "cancellation";

export type AdminTaskStatus = "open" | "completed";

export type AdminTaskCompletedStatus =
  | "admitted"
  | "cancelled"
  | "manual_followup"
  | "executed"
  | "retracted"
  | "expired"
  | "acknowledged";

export interface AdminTaskRow {
  kind: AdminTaskKind;
  legalMembershipId: string | null;
  transitionRequestId: string | null;
  userId: string;
  userName: string;
  department: Department | null;
  createdAt: Date;
  deadline: Date;
  taskStatus: AdminTaskStatus;
  completedStatus: AdminTaskCompletedStatus | null;
}

export interface TaskMember {
  id: string;
  name: string;
}

export interface GetAdminTasksPageResult {
  rows: AdminTaskRow[];
  total: number;
  pageCount: number;
}

function getHeadedDepartments(authority: UserAuthority): Department[] {
  return authority.positions
    .filter(
      (p): p is Extract<typeof p, { scope: "department" }> =>
        p.scope === "department" && p.position === "department_head",
    )
    .map((p) => p.department);
}

function canViewAllTransitions(authority: UserAuthority): boolean {
  return hasPeopleAdminGrant(authority) || isLegalOfficer(authority);
}

function canViewAllAdmissions(authority: UserAuthority): boolean {
  return hasAdminGrant(authority) || isLegalOfficer(authority);
}

function canViewAnyAdmission(authority: UserAuthority): boolean {
  return (
    canViewAllAdmissions(authority) ||
    getHeadedDepartments(authority).length > 0
  );
}

function addDeadlineDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function fetchAdmissionTasks(
  departmentFilter: Department[] | null,
  memberIdFilter?: string[],
): Promise<AdminTaskRow[]> {
  if (departmentFilter !== null && departmentFilter.length === 0) return [];

  const conditions = [isNotNull(legalMembership.boardResolutionText)];
  if (memberIdFilter && memberIdFilter.length > 0) {
    conditions.push(inArray(legalMembership.userId, memberIdFilter));
  }
  if (departmentFilter !== null && departmentFilter.length > 0) {
    conditions.push(inArray(user.department, departmentFilter));
  }

  const rows = await db
    .select({
      id: legalMembership.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: legalMembership.status,
      startedAt: legalMembership.startedAt,
      createdAt: legalMembership.createdAt,
    })
    .from(legalMembership)
    .innerJoin(user, eq(user.id, legalMembership.userId))
    .where(and(...conditions));

  return rows.map((row): AdminTaskRow => {
    const isOpen = row.status === "admission_pending";
    let completedStatus: AdminTaskCompletedStatus | null = null;
    if (!isOpen) {
      if (row.status === "active") completedStatus = "admitted";
      else if (row.status === "cancelled") completedStatus = "cancelled";
      else if (row.status === "manual_followup")
        completedStatus = "manual_followup";
    }
    return {
      kind: "admission",
      legalMembershipId: row.id,
      transitionRequestId: null,
      userId: row.userId,
      userName: `${row.firstName} ${row.lastName}`.trim(),
      department: row.department,
      createdAt: row.createdAt,
      deadline: addDeadlineDays(row.startedAt, 90),
      taskStatus: isOpen ? "open" : "completed",
      completedStatus,
    };
  });
}

async function fetchTransitionTasks(
  departmentFilter: Department[] | null,
  memberIdFilter?: string[],
): Promise<AdminTaskRow[]> {
  if (departmentFilter !== null && departmentFilter.length === 0) return [];

  const conditions = [
    inArray(membershipTransitionRequest.type, [
      "alumni_request",
      "supporting_alumni_request",
    ]),
  ];
  if (memberIdFilter && memberIdFilter.length > 0) {
    conditions.push(
      inArray(membershipTransitionRequest.userId, memberIdFilter),
    );
  }
  if (departmentFilter !== null && departmentFilter.length > 0) {
    conditions.push(inArray(user.department, departmentFilter));
  }

  const rows = await db
    .select({
      id: membershipTransitionRequest.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      type: membershipTransitionRequest.type,
      status: membershipTransitionRequest.status,
      requestedAt: membershipTransitionRequest.requestedAt,
      createdAt: membershipTransitionRequest.createdAt,
    })
    .from(membershipTransitionRequest)
    .innerJoin(user, eq(user.id, membershipTransitionRequest.userId))
    .where(and(...conditions));

  return rows.map((row): AdminTaskRow => {
    const isOpen = row.status === "pending";
    return {
      kind: row.type as "alumni_request" | "supporting_alumni_request",
      legalMembershipId: null,
      transitionRequestId: row.id,
      userId: row.userId,
      userName: `${row.firstName} ${row.lastName}`.trim(),
      department: row.department,
      createdAt: row.createdAt,
      deadline: addDeadlineDays(row.requestedAt, 30),
      taskStatus: isOpen ? "open" : "completed",
      completedStatus: isOpen ? null : (row.status as AdminTaskCompletedStatus),
    };
  });
}

async function fetchCancellationTasks(
  departmentFilter: Department[] | null,
  memberIdFilter?: string[],
): Promise<AdminTaskRow[]> {
  if (departmentFilter !== null && departmentFilter.length === 0) return [];

  const conditions = [
    eq(membershipTransitionRequest.type, "cancellation"),
    eq(membershipTransitionRequest.reason, "resigned"),
  ];
  if (memberIdFilter && memberIdFilter.length > 0) {
    conditions.push(
      inArray(membershipTransitionRequest.userId, memberIdFilter),
    );
  }
  if (departmentFilter !== null && departmentFilter.length > 0) {
    conditions.push(inArray(user.department, departmentFilter));
  }

  const rows = await db
    .select({
      id: membershipTransitionRequest.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: membershipTransitionRequest.status,
      requestedAt: membershipTransitionRequest.requestedAt,
      createdAt: membershipTransitionRequest.createdAt,
    })
    .from(membershipTransitionRequest)
    .innerJoin(user, eq(user.id, membershipTransitionRequest.userId))
    .where(and(...conditions));

  return rows.map((row): AdminTaskRow => {
    const isOpen = row.status === "pending";
    return {
      kind: "cancellation",
      legalMembershipId: null,
      transitionRequestId: row.id,
      userId: row.userId,
      userName: `${row.firstName} ${row.lastName}`.trim(),
      department: row.department,
      createdAt: row.createdAt,
      deadline: addDeadlineDays(row.requestedAt, 7),
      taskStatus: isOpen ? "open" : "completed",
      completedStatus: isOpen ? null : (row.status as AdminTaskCompletedStatus),
    };
  });
}

function sortTasks(tasks: AdminTaskRow[]): AdminTaskRow[] {
  const open = tasks
    .filter((t) => t.taskStatus === "open")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const completed = tasks
    .filter((t) => t.taskStatus === "completed")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return [...open, ...completed];
}

export async function getAdminTasksPage(
  authority: UserAuthority,
  filters: { types?: AdminTaskKind[]; memberIds?: string[] },
  pagination: { page: number; pageSize: number },
): Promise<GetAdminTasksPageResult> {
  const { types, memberIds } = filters;
  const { page, pageSize } = pagination;

  const headedDepartments = getHeadedDepartments(authority);
  const canViewAllTrans = canViewAllTransitions(authority);
  const transitionDeptFilter: Department[] | null = canViewAllTrans
    ? null
    : headedDepartments;
  const admissionDeptFilter: Department[] | null = canViewAllAdmissions(
    authority,
  )
    ? null
    : headedDepartments;

  const fetchPromises: Promise<AdminTaskRow[]>[] = [];

  const includeKind = (kind: AdminTaskKind) =>
    !types || types.length === 0 || types.includes(kind);

  if (canViewAnyAdmission(authority) && includeKind("admission")) {
    fetchPromises.push(fetchAdmissionTasks(admissionDeptFilter, memberIds));
  }

  const canViewTransitions = canViewAllTrans || headedDepartments.length > 0;
  if (canViewTransitions) {
    if (
      includeKind("alumni_request") ||
      includeKind("supporting_alumni_request")
    ) {
      fetchPromises.push(fetchTransitionTasks(transitionDeptFilter, memberIds));
    }
    if (includeKind("cancellation")) {
      fetchPromises.push(
        fetchCancellationTasks(transitionDeptFilter, memberIds),
      );
    }
  }

  const results = await Promise.all(fetchPromises);
  const allTasks = sortTasks(results.flat());

  const total = allTasks.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = allTasks.slice(start, start + pageSize);

  return { rows, total, pageCount };
}

export async function getAllVisibleTaskMembers(
  authority: UserAuthority,
): Promise<TaskMember[]> {
  const headedDepartments = getHeadedDepartments(authority);
  const canViewAllTrans = canViewAllTransitions(authority);
  const transitionDeptFilter: Department[] | null = canViewAllTrans
    ? null
    : headedDepartments;
  const admissionDeptFilter: Department[] | null = canViewAllAdmissions(
    authority,
  )
    ? null
    : headedDepartments;

  const fetchPromises: Promise<AdminTaskRow[]>[] = [];

  if (canViewAnyAdmission(authority)) {
    fetchPromises.push(fetchAdmissionTasks(admissionDeptFilter));
  }

  const canViewTransitions = canViewAllTrans || headedDepartments.length > 0;
  if (canViewTransitions) {
    fetchPromises.push(fetchTransitionTasks(transitionDeptFilter));
    fetchPromises.push(fetchCancellationTasks(transitionDeptFilter));
  }

  const results = await Promise.all(fetchPromises);
  const allTasks = results.flat();

  const seen = new Set<string>();
  const members: TaskMember[] = [];
  for (const task of allTasks) {
    if (!seen.has(task.userId)) {
      seen.add(task.userId);
      members.push({ id: task.userId, name: task.userName });
    }
  }
  return members.sort((a, b) => a.name.localeCompare(b.name));
}
