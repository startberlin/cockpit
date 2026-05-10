"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { AlertCircleIcon, Loader2, Plus } from "lucide-react";
import * as React from "react";
import { createBatchAction } from "@/app/(authenticated)/(app)/people/batches/create-batch-action";
import { createBatchSchema } from "@/app/(authenticated)/(app)/people/batches/create-batch-schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleError } from "@/lib/utils";

interface BatchSelectProps {
  batches: { number: number }[];
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
}

export function BatchSelect({
  batches,
  value,
  onChange,
  disabled,
}: BatchSelectProps) {
  const [extraBatches, setExtraBatches] = React.useState<{ number: number }[]>(
    [],
  );
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);

  const allBatches = React.useMemo(() => {
    const existing = new Set(batches.map((b) => b.number));
    const extras = extraBatches.filter((b) => !existing.has(b.number));
    return [...batches, ...extras].sort((a, b) => a.number - b.number);
  }, [batches, extraBatches]);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    createBatchAction,
    zodResolver(createBatchSchema),
    {
      actionProps: {
        onSuccess: () => {
          const newNumber = form.getValues("number");
          setExtraBatches((prev) => [...prev, { number: newNumber }]);
          onChange(newNumber);
          setQuickCreateOpen(false);
          form.reset();
        },
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          number: undefined as unknown as number,
          startDate: "",
        },
      },
    },
  );

  return (
    <>
      <Select
        value={value != null ? String(value) : ""}
        onValueChange={(v) => onChange(v === "" ? undefined : Number(v))}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="No batch (optional)" />
        </SelectTrigger>
        <SelectContent>
          {allBatches.map((b) => (
            <SelectItem key={b.number} value={String(b.number)}>
              Batch {b.number}
            </SelectItem>
          ))}
          <SelectSeparator />
          <div className="px-2 py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setQuickCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New batch…
            </button>
          </div>
        </SelectContent>
      </Select>

      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new batch</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmitWithAction}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="qc-number">Batch number</FieldLabel>
                <Input
                  id="qc-number"
                  type="number"
                  placeholder="5"
                  min={1}
                  aria-invalid={!!form.formState.errors.number}
                  disabled={action.isPending}
                  {...form.register("number", { valueAsNumber: true })}
                />
                <FieldError errors={[form.formState.errors.number]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="qc-startDate">Start date</FieldLabel>
                <Input
                  id="qc-startDate"
                  type="date"
                  aria-invalid={!!form.formState.errors.startDate}
                  disabled={action.isPending}
                  {...form.register("startDate")}
                />
                <FieldError errors={[form.formState.errors.startDate]} />
              </Field>
            </FieldGroup>

            {form.formState.errors.root && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>An error occurred</AlertTitle>
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!form.formState.isValid || action.isPending}
              >
                {action.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create batch"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
