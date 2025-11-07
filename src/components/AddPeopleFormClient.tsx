"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useFieldArray } from "react-hook-form";
import { addPeopleAction } from "@/app/(authenticated)/(app)/add-people/action";
import { addPeopleSchema } from "@/app/(authenticated)/(app)/add-people/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { handleError } from "@/lib/utils";

interface AddPeopleFormClientProps {
  batches: { number: number }[];
  departments: { id: string; name: string }[];
}

export default function AddPeopleFormClient({
  batches,
  departments,
}: AddPeopleFormClientProps) {
  const { form, handleSubmitWithAction } = useHookFormAction(
    addPeopleAction,
    zodResolver(addPeopleSchema),
    {
      actionProps: {
        onError: handleError,
      },
    },
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "users",
  });

  // You may use a helper or hook to handle action responses here as needed.
  // (If you want RHF error integration, see https://next-safe-action.dev/docs/integrations/react-hook-form )

  return (
    <form onSubmit={handleSubmitWithAction} className="flex flex-col gap-6">
      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="rounded-md border p-4 flex flex-col gap-2 relative"
        >
          <div className="flex gap-2">
            <Input
              placeholder="First Name"
              {...form.register(`users.${idx}.firstName`, { required: true })}
            />
            <Input
              placeholder="Last Name"
              {...form.register(`users.${idx}.lastName`, { required: true })}
            />
          </div>
          <Input
            placeholder="Personal Email"
            type="email"
            {...form.register(`users.${idx}.personalEmail`, { required: true })}
          />
          <div className="flex gap-2">
            <select
              className="input"
              {...form.register(`users.${idx}.batchNumber`, {
                required: true,
                valueAsNumber: true,
              })}
            >
              {batches.map((b) => (
                <option value={b.number} key={b.number}>
                  Batch {b.number}
                </option>
              ))}
            </select>
            <select
              className="input"
              {...form.register(`users.${idx}.departmentId`, {
                required: true,
              })}
            >
              {departments.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {fields.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => remove(idx)}
            >
              –
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            firstName: "",
            lastName: "",
            personalEmail: "",
            batchNumber: batches.length ? batches[0].number : 0,
            departmentId: departments.length ? departments[0].id : "",
          })
        }
      >
        + Add Another User
      </Button>
      <Button type="submit">CREATE</Button>
    </form>
  );
}
