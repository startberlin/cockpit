"use client";

import {
  BanknoteIcon,
  BriefcaseBusinessIcon,
  ChevronDownIcon,
  Link2Icon,
  LockKeyholeIcon,
  type LucideIcon,
  MapPinIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SaveJobInput } from "../actions/schemas";
import { addJobboardUtmParameters } from "../lib/application-url";
import { employmentTypes, seniorities } from "../lib/contracts";
import { ListField, NumberField, SelectField, TextField } from "./form-fields";
import {
  type CompanyRefreshState,
  JobCompanySelect,
} from "./job-company-select";
import {
  employmentLabels,
  type JobEditorCompany,
  remoteLabels,
  seniorityLabels,
} from "./job-editor-data";

function EditorSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <details
      open
      id={id}
      className="group/section min-w-0 border-b pb-3 last:border-b-0"
    >
      <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <h2 className="flex min-h-11 items-center gap-2 text-base font-semibold">
          <Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          {title}
          <ChevronDownIcon
            aria-hidden="true"
            className="ml-auto size-4 shrink-0 -rotate-90 text-muted-foreground group-open/section:rotate-0"
          />
        </h2>
      </summary>
      <div className="space-y-4 py-3">{children}</div>
    </details>
  );
}

function ApplicationLinkField() {
  const { control, setValue } = useFormContext<SaveJobInput>();
  const url = useWatch({ control, name: "content.applyUrl" });
  const tagged = addJobboardUtmParameters(url);
  const complete = tagged !== null && tagged === url.trim();
  return (
    <div className="space-y-2 border-b pb-6">
      <TextField
        name="content.applyUrl"
        label="Application URL"
        required
        type="url"
        maxLength={2048}
        placeholder="https://company.com/careers/role"
        help="Add the START Berlin referral campaign to a public job link. Existing partner parameters are kept. You can edit the final URL before saving."
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!tagged || complete}
        onClick={() => {
          if (tagged)
            setValue("content.applyUrl", tagged, {
              shouldDirty: true,
              shouldValidate: true,
            });
        }}
      >
        <Link2Icon aria-hidden="true" />
        {complete ? "UTM parameters present" : "Add UTM parameters"}
      </Button>
    </div>
  );
}

function CurrencyField() {
  const { control } = useFormContext<SaveJobInput>();
  return (
    <FormField
      control={control}
      name="content.salaryCurrency"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Currency</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? "EUR"}
              maxLength={3}
              placeholder="EUR"
              autoCapitalize="characters"
              onChange={(event) =>
                field.onChange(event.target.value.toUpperCase())
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function JobEditorFields({
  companies,
  disabled,
  companyRefresh,
}: {
  companies: JobEditorCompany[];
  disabled: boolean;
  companyRefresh: CompanyRefreshState;
}) {
  const form = useFormContext<SaveJobInput>();
  const salaryStatus = useWatch({
    control: form.control,
    name: "content.salaryStatus",
  });
  const employmentType = useWatch({
    control: form.control,
    name: "content.employmentType",
  });
  return (
    <fieldset disabled={disabled} className="space-y-5 pb-6">
      <EditorSection id="job-role" title="Role" icon={BriefcaseBusinessIcon}>
        <JobCompanySelect
          companies={companies}
          disabled={disabled}
          refresh={companyRefresh}
        />
        <TextField
          name="content.title"
          label="Job title"
          required
          maxLength={180}
          placeholder="Working Student, Product Operations (all genders)"
        />
        <div className="grid gap-4 @min-[28rem]/editor:grid-cols-2">
          <SelectField
            name="content.employmentType"
            label="Employment type"
            options={employmentTypes.map((value) => ({
              value,
              label: employmentLabels[value],
            }))}
            onValueChange={(value) => {
              if (value !== "internship") {
                form.setValue("content.internshipDurationMonths", null, {
                  shouldDirty: true,
                });
                form.clearErrors("content.internshipDurationMonths");
              }
            }}
          />
          <SelectField
            name="content.seniority"
            label="Experience level"
            options={seniorities.map((value) => ({
              value,
              label: seniorityLabels[value],
            }))}
          />
        </div>
      </EditorSection>
      <div className="border-b pb-6">
        <TextField
          name="content.description"
          label="Description"
          required
          multiline
          rows={10}
          maxLength={20000}
          placeholder={
            "What will this person work on?\n\nDescribe the responsibilities, required experience and what the company offers."
          }
          help="Plain text, 40 to 20,000 characters. Paragraphs and line breaks are preserved."
        />
      </div>
      <EditorSection
        id="job-location"
        title="Location and hours"
        icon={MapPinIcon}
      >
        <SelectField
          name="content.remoteMode"
          label="Work arrangement"
          options={(["onsite", "hybrid", "remote"] as const).map((value) => ({
            value,
            label: remoteLabels[value],
          }))}
        />
        <div className="grid gap-4 @min-[28rem]/editor:grid-cols-2">
          <ListField
            name="content.locations"
            label="Locations *"
            placeholder="Berlin, Munich"
          />
          <ListField
            name="content.countryCodes"
            label="Countries of work *"
            uppercase
            placeholder="DE, AT"
            help="Comma-separated two-letter codes. For remote roles, list countries where the person may work."
          />
        </div>
        <ListField
          name="content.languages"
          label="Required languages *"
          placeholder="English, German"
        />
        <div className="grid gap-4 @min-[28rem]/editor:grid-cols-2">
          <NumberField
            name="content.weeklyHours"
            label="Hours per week"
            min={0.5}
            max={168}
          />
          {employmentType === "internship" ? (
            <NumberField
              name="content.internshipDurationMonths"
              label="Internship duration (months)"
              min={0.1}
              max={60}
            />
          ) : null}
        </div>
      </EditorSection>
      <EditorSection
        id="job-compensation"
        title="Compensation"
        icon={BanknoteIcon}
      >
        <SelectField
          name="content.salaryStatus"
          label="Salary information"
          help={
            salaryStatus === "unpaid"
              ? "Record the legal basis and supporting reference during publication review. A minimum-wage exception alone is not sufficient."
              : "Choose what candidates see. Employers must still provide any legally required pay information."
          }
          options={[
            { value: "not_disclosed", label: "Not disclosed" },
            { value: "disclosed", label: "Show an amount or range" },
            { value: "unpaid", label: "Unpaid, requires review" },
          ]}
          onValueChange={(value) => {
            if (value !== "disclosed") {
              form.setValue("content.salaryMin", null, { shouldDirty: true });
              form.setValue("content.salaryMax", null, { shouldDirty: true });
              form.clearErrors(["content.salaryMin", "content.salaryMax"]);
            }
          }}
        />
        {salaryStatus === "disclosed" ? (
          <div className="grid gap-4 @min-[28rem]/editor:grid-cols-2">
            <NumberField
              name="content.salaryMin"
              label="Amount or lower bound (gross) *"
              min={0.01}
            />
            <NumberField
              name="content.salaryMax"
              label="Upper bound (optional)"
              min={0.01}
            />
            <CurrencyField />
            <SelectField
              name="content.salaryPeriod"
              label="Pay period"
              options={[
                { value: "hour", label: "Per hour" },
                { value: "month", label: "Per month" },
                { value: "year", label: "Per year" },
              ]}
            />
          </div>
        ) : salaryStatus === "unpaid" ? (
          <p className="text-sm text-muted-foreground">
            Explain the unpaid basis during review.
          </p>
        ) : null}
      </EditorSection>
      <ApplicationLinkField />
      <EditorSection
        id="job-private"
        title="Internal notes"
        icon={LockKeyholeIcon}
      >
        <p className="text-sm text-muted-foreground">
          Only visible in Cockpit.
        </p>
        <TextField
          name="notes"
          label="Notes"
          multiline
          rows={4}
          maxLength={10000}
          placeholder="Responsible START person, employer context or the next follow-up."
        />
      </EditorSection>
    </fieldset>
  );
}
