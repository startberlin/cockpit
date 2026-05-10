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
import { AlertCircleIcon, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
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

type Batch = { number: number; startDate: string };

interface BatchesPageClientProps {
  batches: Batch[];
}

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
    cell: () => null,
  },
];

export default function BatchesPageClient({ batches }: BatchesPageClientProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [createOpen, setCreateOpen] = React.useState(false);

  const table = useReactTable({
    data: batches,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    createBatchAction,
    zodResolver(createBatchSchema),
    {
      actionProps: {
        onSuccess: () => {
          setCreateOpen(false);
          form.reset();
          router.refresh();
          toast.success("Batch created");
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
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmitWithAction}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="number">Batch number</FieldLabel>
                <Input
                  id="number"
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
                <FieldLabel htmlFor="startDate">Start date</FieldLabel>
                <Input
                  id="startDate"
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
