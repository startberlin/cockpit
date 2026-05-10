"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { useQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { User } from "@/db/schema/auth";
import { authClient } from "@/lib/auth-client";
import {
  COUNTRY_OPTIONS,
  type CountryOption,
  getCountryOption,
  getDefaultCountry,
} from "@/lib/countries";
import {
  type AddressSuggestion,
  fetchPhotonAddressSuggestions,
} from "@/lib/photon-address";
import { handleError } from "@/lib/utils";
import { stepAddressDataSchema } from "../onboarding-validation";
import { completeOnboardingAddressStep } from "./step-address-action";

interface StepAddressProps {
  user: User;
}

type CountryComboboxValue = Pick<CountryOption, "label" | "value"> & {
  code?: string;
};

function getCountryComboboxValue(country: string): CountryComboboxValue | null {
  if (!country) {
    return null;
  }

  return getCountryOption(country) ?? { label: country, value: country };
}

export function StepAddress({ user }: StepAddressProps) {
  const session = authClient.useSession();
  const router = useRouter();
  const [streetSuggestionsOpen, setStreetSuggestionsOpen] = useState(false);
  const [selectedStreetValue, setSelectedStreetValue] = useState("");

  const onCompletedStep = useCallback(() => {
    if (!session || !session.data || !session.data.user) {
      console.error("User not loaded/signed in. Can't refresh page.");
      return;
    }
    router.push("/");
  }, [router, session]);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    completeOnboardingAddressStep,
    zodResolver(stepAddressDataSchema),
    {
      actionProps: {
        onSuccess: onCompletedStep,
        onError: handleError,
      },
      formProps: {
        defaultValues: {
          street: user.street ?? "",
          city: user.city ?? "",
          state: user.state ?? "",
          zip: user.zip ?? "",
          country: getDefaultCountry(user.country),
        },
        mode: "onChange",
      },
    },
  );

  const streetValue = form.watch("street");
  const [debouncedStreet] = useDebounce(streetValue, 300);
  const shouldSearchStreet = debouncedStreet.trim().length > 2;
  const shouldFetchAddressSuggestions =
    shouldSearchStreet && debouncedStreet !== selectedStreetValue;
  const addressSuggestionsQuery = useQuery({
    queryKey: ["photon-address", debouncedStreet],
    queryFn: () => fetchPhotonAddressSuggestions(debouncedStreet),
    enabled: shouldFetchAddressSuggestions,
    retry: false,
  });
  const addressSuggestions = addressSuggestionsQuery.data ?? [];
  const hasAddressSuggestions = addressSuggestions.length > 0;
  const canShowAddressSuggestions =
    shouldFetchAddressSuggestions && hasAddressSuggestions;

  useEffect(() => {
    if (canShowAddressSuggestions) {
      setStreetSuggestionsOpen(true);
      return;
    }

    setStreetSuggestionsOpen(false);
  }, [canShowAddressSuggestions]);

  const applyAddressSuggestion = useCallback(
    (suggestion: AddressSuggestion | null) => {
      if (!suggestion) {
        return;
      }

      form.setValue("street", suggestion.street, { shouldValidate: true });
      form.setValue("zip", suggestion.zip, { shouldValidate: true });
      form.setValue("city", suggestion.city, { shouldValidate: true });
      form.setValue("state", suggestion.state, { shouldValidate: true });
      form.setValue("country", suggestion.country, { shouldValidate: true });
      setSelectedStreetValue(suggestion.street);
      setStreetSuggestionsOpen(false);
    },
    [form],
  );

  return (
    <div className="p-0">
      <FieldDescription className="flex flex-row gap-1.5 pt-0.5 text-xs mb-6">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        We only show this to people who need it for administration.
      </FieldDescription>
      <form className="flex flex-col gap-y-8" onSubmit={handleSubmitWithAction}>
        <FieldSet>
          <FieldLegend>Address</FieldLegend>
          <FieldGroup>
            <Controller
              name="street"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Street</FieldLabel>
                  <Combobox<AddressSuggestion>
                    items={addressSuggestions}
                    filter={null}
                    open={streetSuggestionsOpen && canShowAddressSuggestions}
                    onOpenChange={(open) => {
                      setStreetSuggestionsOpen(
                        open && canShowAddressSuggestions,
                      );
                    }}
                    inputValue={field.value}
                    onInputValueChange={(value) => {
                      form.setValue(field.name, value, {
                        shouldValidate: true,
                      });
                    }}
                    onValueChange={applyAddressSuggestion}
                    itemToStringLabel={(suggestion) => suggestion.street}
                    itemToStringValue={(suggestion) => suggestion.street}
                    isItemEqualToValue={(item, value) => item.id === value.id}
                  >
                    <ComboboxInput
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Hauptstraße 42"
                      disabled={action.isPending}
                      showTrigger={false}
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>
                        {shouldSearchStreet &&
                        !addressSuggestionsQuery.isFetching
                          ? "No address suggestions found."
                          : null}
                      </ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxCollection>
                          {(suggestion: AddressSuggestion) => (
                            <ComboboxItem
                              key={suggestion.id}
                              value={suggestion}
                            >
                              {suggestion.label}
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <div className="flex gap-4">
              <Controller
                name="zip"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    className="w-1/4 min-w-24"
                    data-invalid={fieldState.invalid}
                  >
                    <FieldLabel htmlFor={field.name}>PLZ</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="10115"
                      disabled={action.isPending}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="city"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field className="flex-1" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>City</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      placeholder="Berlin"
                      disabled={action.isPending}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
            <Controller
              name="state"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Bundesland / State
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={action.isPending}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="country"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Country</FieldLabel>
                  <Combobox<CountryComboboxValue>
                    items={COUNTRY_OPTIONS}
                    value={getCountryComboboxValue(field.value)}
                    onValueChange={(country) => {
                      form.setValue(field.name, country?.value ?? "", {
                        shouldValidate: true,
                      });
                    }}
                    itemToStringLabel={(country) => country.label}
                    itemToStringValue={(country) => country.value}
                    isItemEqualToValue={(item, value) =>
                      item.value === value.value
                    }
                  >
                    <ComboboxInput
                      id={field.name}
                      aria-invalid={fieldState.invalid}
                      disabled={action.isPending}
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No countries found.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxCollection>
                          {(country: CountryOption) => (
                            <ComboboxItem key={country.code} value={country}>
                              {country.label}
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>
        <Button
          type="submit"
          disabled={!form.formState.isValid || action.isPending}
        >
          Finish
        </Button>
      </form>
    </div>
  );
}
