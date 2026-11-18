"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions/server";
import { JobboardError, service } from "../lib/service";
import { jobboardActionClient as actionClient } from "./client";
import {
  acceptSubmissionSchema,
  companySearchSchema,
  deleteCompanySchema,
  editJobExpirySchema,
  publishJobSchema,
  rejectSubmissionSchema,
  saveCompanySchema,
  saveJobSchema,
  setJobStatusSchema,
  submissionReviewSchema,
} from "./schemas";

async function requireJobboardPermission(
  permission: "apps.jobboard.access" | "apps.jobboard.publish",
) {
  if (await can(permission)) return;
  throw new JobboardError(
    "forbidden",
    permission === "apps.jobboard.publish"
      ? "Publication changes require a Partnerships lead or Cockpit admin."
      : "You do not have access to edit the Jobboard.",
    403,
  );
}

export const refreshCompaniesAction = actionClient
  .inputSchema(companySearchSchema)
  .action(async ({ parsedInput }) => {
    await requireJobboardPermission("apps.jobboard.access");
    return {
      companies: await service.listCompanyOptions(
        parsedInput.q,
        parsedInput.selectedId,
      ),
    };
  });

export const loadSubmissionReviewAction = actionClient
  .inputSchema(submissionReviewSchema)
  .action(async ({ parsedInput }) => {
    await requireJobboardPermission("apps.jobboard.access");
    const review = await service.getSubmissionReview(parsedInput.id);
    const companies =
      review.submission.status === "pending_review"
        ? await service.listCompanyOptions()
        : [];
    return {
      ...review,
      companies: companies.map(({ id, name }) => ({ id, name })),
    };
  });

export const saveCompanyAction = actionClient
  .inputSchema(saveCompanySchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.access");
    const company = await service.saveCompany(parsedInput, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
    return { id: company.id, updatedAt: company.updatedAt.toISOString() };
  });

export const saveJobAction = actionClient
  .inputSchema(saveJobSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.access");
    const job = await service.saveJob(parsedInput, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
    return { id: job.id, draftVersion: job.draftVersion };
  });

export const publishJobAction = actionClient
  .inputSchema(publishJobSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.publish");
    const job = await service.publishJob(parsedInput, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
    return { id: job.id };
  });

export const setJobStatusAction = actionClient
  .inputSchema(setJobStatusSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    let transition: typeof parsedInput.status | "archive_draft" =
      parsedInput.status;
    if (parsedInput.status === "closed") {
      await requireJobboardPermission("apps.jobboard.access");
      if (!(await can("apps.jobboard.publish"))) transition = "archive_draft";
    } else {
      await requireJobboardPermission("apps.jobboard.publish");
    }
    await service.setJobStatus(parsedInput.id, transition, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
  });

export const editJobExpiryAction = actionClient
  .inputSchema(editJobExpirySchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.publish");
    const job = await service.editJobExpiry(parsedInput, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
    return { id: job.id };
  });

export const acceptSubmissionAction = actionClient
  .inputSchema(acceptSubmissionSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.access");
    const job = await service.acceptSubmission(
      parsedInput.id,
      parsedInput.companyId,
      { id: user.id, name: user.name },
    );
    revalidatePath("/jobboard", "layout");
    return { id: job.id };
  });

export const rejectSubmissionAction = actionClient
  .inputSchema(rejectSubmissionSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.access");
    await service.rejectSubmission(parsedInput.id, parsedInput.note, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
  });

export const deleteCompanyAction = actionClient
  .inputSchema(deleteCompanySchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    await requireJobboardPermission("apps.jobboard.access");
    await service.deleteCompany(parsedInput.id, {
      id: user.id,
      name: user.name,
    });
    revalidatePath("/jobboard", "layout");
  });
