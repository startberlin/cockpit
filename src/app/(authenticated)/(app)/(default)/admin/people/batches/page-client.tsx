"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircleIcon, Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsBoolean, useQueryState } from "nuqs";
import * as React from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { handleError } from "@/lib/utils";
import { createBatchAction } from "./create-batch-action";
import { createBatchSchema } from "./create-batch-schema";
import { updateBatchAction } from "./update-batch-action";
import { updateBatchSchema } from "./update-batch-schema";

type Batch = { number: number; startDate: string };

interface BatchesPageClientProps {
  batches: Batch[];
}

export default function BatchesPageClient({ batches }: BatchesPageClientProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [createOpen, setCreateOpen] = useQueryState(
    "create",
    parseAsBoolean.withDefault(false),
  );
  const [editTarget, setEditTarget] = React.useState<Batch | null>(null);

  const columns: ColumnDef<Batch>[] = [
    {
      accessorKey: "number",
      header: "Batch",
      cell: ({ row }) => (
        <span className="font-medium">#{row.original.number}</span>
      ),
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => <span>{row.original.startDate}</span>,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditTarget(row.original)}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit batch #{row.original.number}</span>
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: batches,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const {
    form: createForm,
    handleSubmitWithAction: handleCreateSubmit,
    action: createAction,
  } = useHookFormAction(createBatchAction, zodResolver(createBatchSchema), {
    actionProps: {
      onSuccess: () => {
        setCreateOpen(false);
        createForm.reset();
        router.refresh();
        toast.success("Batch created");
      },
      onError: handleError,
    },
    formProps: {
      defaultValues: { number: undefined as unknown as number, startDate: "" },
    },
  });

  const {
    form: editForm,
    handleSubmitWithAction: handleEditSubmit,
    action: editAction,
  } = useHookFormAction(updateBatchAction, zodResolver(updateBatchSchema), {
    actionProps: {
      onSuccess: () => {
        setEditTarget(null);
        router.refresh();
        toast.success("Batch updated");
      },
      onError: handleError,
    },
    formProps: {
      defaultValues: { number: 0, startDate: "" },
    },
  });

  React.useEffect(() => {
    if (editTarget) {
      editForm.reset({
        number: editTarget.number,
        startDate: editTarget.startDate,
      });
    }
  }, [editTarget, editForm]);

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <h1 className="text-xl font-semibold">Batches</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create batch
        </Button>
      </div>

      {batches.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No batches yet. Create the first one.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create batch</DialogTitle>
          </DialogHeader>
          <form className="flex flex-col gap-y-6" onSubmit={handleCreateSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="create-number">Batch number</FieldLabel>
                <Input
                  id="create-number"
                  type="number"
                  placeholder="5"
                  min={1}
                  aria-invalid={!!createForm.formState.errors.number}
                  disabled={createAction.isPending}
                  {...createForm.register("number", { valueAsNumber: true })}
                />
                <FieldError errors={[createForm.formState.errors.number]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-startDate">Start date</FieldLabel>
                <Input
                  id="create-startDate"
                  type="date"
                  aria-invalid={!!createForm.formState.errors.startDate}
                  disabled={createAction.isPending}
                  {...createForm.register("startDate")}
                />
                <FieldError errors={[createForm.formState.errors.startDate]} />
              </Field>
            </FieldGroup>

            {createForm.formState.errors.root && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>An error occurred</AlertTitle>
                <AlertDescription>
                  {createForm.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  !createForm.formState.isValid || createAction.isPending
                }
              >
                {createAction.isPending ? (
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

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit batch #{editTarget?.number}</DialogTitle>
            <DialogDescription>
              Batch number is fixed. You can only update the start date.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-y-6" onSubmit={handleEditSubmit}>
            <input
              type="hidden"
              {...editForm.register("number", { valueAsNumber: true })}
            />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="edit-startDate">Start date</FieldLabel>
                <Input
                  id="edit-startDate"
                  type="date"
                  aria-invalid={!!editForm.formState.errors.startDate}
                  disabled={editAction.isPending}
                  {...editForm.register("startDate")}
                />
                <FieldError errors={[editForm.formState.errors.startDate]} />
              </Field>
            </FieldGroup>

            {editForm.formState.errors.root && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertTitle>An error occurred</AlertTitle>
                <AlertDescription>
                  {editForm.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!editForm.formState.isValid || editAction.isPending}
              >
                {editAction.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
