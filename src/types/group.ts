export interface GroupCriteria {
  id: string;
  name: string;
  department: string | null;
  roles: string[] | null;
  status: string | null;
  batchNumber: number | null;
  createdAt: string;
  createdBy: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  slug: string;
  members: GroupMember[];
  criteria: GroupCriteria[];
}

export interface GroupMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  status: string;
  batchNumber: number;
  role: "admin" | "member";
}