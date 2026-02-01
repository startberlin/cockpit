import { NextRequest, NextResponse } from "next/server";
import { addGroupCriteria, addUsersMatchingCriteria } from "@/db/groups";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await addGroupCriteria(body);
    
    // Auto-add existing users that match the criteria
    if (result.data) {
      const criteriaFilter = {
        department: body.department,
        roles: body.roles,
        status: body.status,
        batchNumber: body.batchNumber,
      };
      
      const addedUsersCount = await addUsersMatchingCriteria(body.groupId, criteriaFilter);
      
      return NextResponse.json({ 
        criteria: result.data,
        addedUsersCount 
      });
    }
    
    return NextResponse.json({ criteria: result.data });
  } catch (error) {
    console.error("Error adding group criteria:", error);
    return NextResponse.json(
      { error: "Failed to add group criteria" },
      { status: 500 }
    );
  }
}