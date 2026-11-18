"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useIsClient } from "usehooks-ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { saveCompanyAction } from "../actions/mutations";
import { type SaveCompanyInput, saveCompanySchema } from "../actions/schemas";
import { editorValidationMessage } from "../lib/editor-schemas";
import { FormError, FormSection, TextField } from "./form-fields";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

function ContactHeading({ index }: { index: number }) {
  const { control } = useFormContext<SaveCompanyInput>();
  const name = useWatch({ control, name: `contacts.${index}.name` });
  return (
    <h3 className="min-w-0 break-words text-sm font-medium">
      {name?.trim() || `Contact ${index + 1}`}
    </h3>
  );
}

function ContactNotes({ index }: { index: number }) {
  const { getValues } = useFormContext<SaveCompanyInput>();
  const [open, setOpen] = useState(() =>
    Boolean(getValues(`contacts.${index}.notes`)),
  );
  return (
    <details
      className="group/contact-notes"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-sm text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon
          className="size-3.5 -rotate-90 group-open/contact-notes:rotate-0"
          aria-hidden="true"
        />
        Contact notes
      </summary>
      <div className="pt-2">
        <TextField
          name={`contacts.${index}.notes`}
          label="Notes"
          multiline
          rows={3}
          maxLength={4000}
        />
      </div>
    </details>
  );
}

export function CompanyForm({
  company,
  onSaved,
  onStateChange,
}: {
  company?: SaveCompanyInput;
  onSaved?: (id: string, savedCompany: SaveCompanyInput) => void;
  onStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
}) {
  const router = useRouter();
  const hydrated = useIsClient();
  const saving = useRef(false);
  const [removedContact, setRemovedContact] = useState<{
    index: number;
    value: SaveCompanyInput["contacts"][number];
  } | null>(null);
  const { form, action, handleSubmitWithAction } = useHookFormAction(
    saveCompanyAction,
    zodResolver(saveCompanySchema, { error: editorValidationMessage }),
    {
      formProps: {
        defaultValues: company
          ? {
              id: company.id,
              expectedUpdatedAt: company.expectedUpdatedAt,
              name: company.name,
              website: company.website,
              description: company.description,
              notes: company.notes,
              terms: company.terms,
              contacts: company.contacts,
            }
          : {
              name: "",
              website: "",
              description: "",
              notes: "",
              terms: "",
              contacts: [],
            },
      },
      actionProps: {
        onExecute: () => {
          saving.current = true;
        },
        onSettled: () => {
          saving.current = false;
        },
        onSuccess: ({ data, input }) => {
          if (!data) return;
          const savedCompany = saveCompanySchema.parse({
            ...input,
            id: data.id,
            expectedUpdatedAt: data.updatedAt,
          });
          form.reset(savedCompany);
          setRemovedContact(null);
          toast.success("Company saved.");
          if (onSaved) onSaved(data.id, savedCompany);
          else if (!company?.id) {
            router.replace(`/jobboard/companies/${data.id}`);
          }
        },
        onError: ({ error }) =>
          toast.error(
            error.serverError ?? "Check the highlighted company fields.",
          ),
      },
    },
  );
  const contacts = useFieldArray({ control: form.control, name: "contacts" });
  const dirty = form.formState.isDirty;
  useEffect(() => {
    onStateChange?.({ dirty, pending: action.isPending });
  }, [dirty, action.isPending, onStateChange]);
  function removeContact(index: number) {
    if (saving.current) return;
    const value = form.getValues(`contacts.${index}`);
    setRemovedContact({
      index,
      value: {
        ...value,
        role: value.role ?? "",
        phone: value.phone ?? "",
        notes: value.notes ?? "",
      },
    });
    contacts.remove(index);
  }
  return (
    <Form {...form}>
      <UnsavedChangesGuard dirty={dirty} />
      <noscript>Enable JavaScript to edit and save this form.</noscript>
      <form
        method="post"
        onSubmit={handleSubmitWithAction}
        noValidate
        className="min-w-0 space-y-5"
      >
        <fieldset
          disabled={!hydrated || action.isPending}
          className="@container/company min-w-0 space-y-6 rounded-xl border bg-card p-5 sm:p-6"
        >
          <FormSection
            title="Public profile"
            description="Shown on published jobs. Changes appear when each job is published again."
          >
            <div className="grid gap-5 @min-[28rem]/company:grid-cols-2">
              <TextField
                name="name"
                label="Company name"
                required
                maxLength={160}
              />
              <TextField
                name="website"
                label="Website"
                required
                type="url"
                placeholder="https://company.com"
                maxLength={2048}
              />
            </div>
            <TextField
              name="description"
              label="About"
              multiline
              rows={4}
              maxLength={4000}
            />
          </FormSection>
          <FormSection
            title="Private contacts"
            description="Only visible in Cockpit. Add up to 30 recruiting or administration contacts."
            action={
              <div className="flex items-center gap-2">
                {contacts.fields.length ? (
                  <Badge variant="secondary">{contacts.fields.length}</Badge>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={contacts.fields.length >= 30}
                  onClick={() =>
                    contacts.append({
                      name: "",
                      email: "",
                      role: "",
                      phone: "",
                      notes: "",
                    })
                  }
                >
                  <PlusIcon aria-hidden="true" /> Add contact
                </Button>
              </div>
            }
          >
            {contacts.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            ) : null}
            {contacts.fields.map((contact, index) => (
              <div
                key={contact.id}
                className="space-y-3 border-b pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <ContactHeading index={index} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeContact(index)}
                    aria-label={`Remove contact ${index + 1}`}
                  >
                    <Trash2Icon aria-hidden="true" />
                    <span className="hidden sm:inline">Remove</span>
                  </Button>
                </div>
                <div className="grid gap-4 @min-[28rem]/company:grid-cols-2">
                  <TextField
                    name={`contacts.${index}.name`}
                    label="Name"
                    required
                    maxLength={160}
                  />
                  <TextField
                    name={`contacts.${index}.email`}
                    label="Email"
                    required
                    type="email"
                    maxLength={254}
                  />
                  <TextField
                    name={`contacts.${index}.role`}
                    label="Role"
                    maxLength={160}
                  />
                  <TextField
                    name={`contacts.${index}.phone`}
                    label="Phone"
                    type="tel"
                    maxLength={80}
                  />
                </div>
                <ContactNotes index={index} />
              </div>
            ))}
            {removedContact ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-sm" role="status">
                  {removedContact.value.name || "Contact"} removed.
                </p>
                <Button
                  type="button"
                  className="min-h-11"
                  variant="outline"
                  disabled={action.isPending || contacts.fields.length >= 30}
                  onClick={() => {
                    if (
                      saving.current ||
                      !removedContact ||
                      form.getValues("contacts").length >= 30
                    )
                      return;
                    contacts.insert(
                      Math.min(
                        removedContact.index,
                        form.getValues("contacts").length,
                      ),
                      structuredClone(removedContact.value),
                    );
                    setRemovedContact(null);
                  }}
                >
                  Undo
                </Button>
              </div>
            ) : null}
          </FormSection>
          <FormSection
            title="Internal notes"
            description="Agreements and follow-up notes stay in Cockpit."
          >
            <div className="grid gap-5 @min-[28rem]/company:grid-cols-2">
              <TextField
                name="terms"
                label="Agreed terms"
                multiline
                rows={4}
                maxLength={10000}
                help="Agreed services, prices or a reference to the partnership agreement."
              />
              <TextField
                name="notes"
                label="Notes"
                multiline
                rows={4}
                maxLength={10000}
                help="The responsible START person and any follow-up."
              />
            </div>
          </FormSection>
        </fieldset>
        <FormError message={action.result.serverError} />
        {Object.keys(form.formState.errors).length ? (
          <p role="alert" className="text-sm text-destructive">
            Check the highlighted fields before saving.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="inline-flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            {action.isPending ? (
              <Loader2Icon
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : !dirty && company?.id ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <span
                className="size-1.5 rounded-full bg-brand-accent"
                aria-hidden="true"
              />
            )}
            {action.isPending
              ? "Saving"
              : dirty
                ? "Unsaved changes"
                : company?.id
                  ? "Saved"
                  : "New company"}
          </p>
          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    disabled={!hydrated || action.isPending}
                  >
                    Discard
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Discard company changes?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Your unsaved edits, including changes to contacts, will be
                      removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep editing</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        form.reset();
                        setRemovedContact(null);
                      }}
                    >
                      Discard changes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              type="submit"
              className="min-h-11 flex-1 sm:flex-none"
              disabled={!hydrated || action.isPending}
            >
              {action.isPending ? (
                <Loader2Icon
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : null}
              {action.isPending
                ? "Saving"
                : company?.id
                  ? "Save changes"
                  : "Create company"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
