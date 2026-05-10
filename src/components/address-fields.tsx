"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";
import { useDebounce } from "use-debounce";
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  COUNTRY_OPTIONS,
  type CountryOption,
  getCountryOption,
} from "@/lib/countries";
import {
  type AddressSuggestion,
  fetchPhotonAddressSuggestions,
} from "@/lib/photon-address";

type CountryComboboxValue = Pick<CountryOption, "label" | "value"> & {
  code?: string;
};

function getCountryComboboxValue(country: string): CountryComboboxValue | null {
  if (!country) return null;
  return getCountryOption(country) ?? { label: country, value: country };
}

interface AddressFieldsProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  setValue: UseFormSetValue<TFieldValues>;
  disabled?: boolean;
}

export function AddressFields<TFieldValues extends FieldValues = FieldValues>({
  control,
  setValue,
  disabled,
}: AddressFieldsProps<TFieldValues>) {
  const [streetSuggestionsOpen, setStreetSuggestionsOpen] = useState(false);
  const [userHasEditedStreet, setUserHasEditedStreet] = useState(false);

  const setAddressField = useCallback(
    (name: string, value: string, options?: { shouldValidate?: boolean }) => {
      setValue(
        name as Path<TFieldValues>,
        value as PathValue<TFieldValues, Path<TFieldValues>>,
        options,
      );
    },
    [setValue],
  );

  const streetValue = useWatch({
    control,
    name: "street" as Path<TFieldValues>,
  }) as string;
  const [debouncedStreet] = useDebounce(streetValue ?? "", 300);
  const shouldSearchStreet = debouncedStreet.trim().length > 2;
  const shouldFetchAddressSuggestions =
    shouldSearchStreet && userHasEditedStreet;

  const addressSuggestionsQuery = useQuery({
    queryKey: ["photon-address", debouncedStreet],
    queryFn: () => fetchPhotonAddressSuggestions(debouncedStreet),
    enabled: shouldFetchAddressSuggestions,
    retry: false,
  });
  const addressSuggestions = addressSuggestionsQuery.data ?? [];
  const canShowAddressSuggestions =
    shouldFetchAddressSuggestions && addressSuggestions.length > 0;

  useEffect(() => {
    setStreetSuggestionsOpen(canShowAddressSuggestions);
  }, [canShowAddressSuggestions]);

  const applyAddressSuggestion = useCallback(
    (suggestion: AddressSuggestion | null) => {
      if (!suggestion) return;
      setAddressField("street", suggestion.street, { shouldValidate: true });
      setAddressField("zip", suggestion.zip, { shouldValidate: true });
      setAddressField("city", suggestion.city, { shouldValidate: true });
      setAddressField("state", suggestion.state, { shouldValidate: true });
      setAddressField("country", suggestion.country, {
        shouldValidate: true,
      });
      setUserHasEditedStreet(false);
      setStreetSuggestionsOpen(false);
    },
    [setAddressField],
  );

  return (
    <FieldSet>
      <FieldLegend>Address</FieldLegend>
      <FieldGroup>
        <Controller
          name={"street" as Path<TFieldValues>}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Street</FieldLabel>
              <Combobox<AddressSuggestion>
                items={addressSuggestions}
                filter={null}
                open={streetSuggestionsOpen && canShowAddressSuggestions}
                onOpenChange={(open) => {
                  setStreetSuggestionsOpen(open && canShowAddressSuggestions);
                }}
                inputValue={field.value}
                onInputValueChange={(value) => {
                  setUserHasEditedStreet(true);
                  setAddressField("street", value, { shouldValidate: true });
                }}
                onValueChange={applyAddressSuggestion}
                itemToStringLabel={(s) => s.street}
                itemToStringValue={(s) => s.street}
                isItemEqualToValue={(item, value) => item.id === value.id}
              >
                <ComboboxInput
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  placeholder="Hauptstraße 42"
                  disabled={disabled}
                  showTrigger={false}
                  className="w-full"
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {shouldSearchStreet && !addressSuggestionsQuery.isFetching
                      ? "No address suggestions found."
                      : null}
                  </ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(suggestion: AddressSuggestion) => (
                        <ComboboxItem key={suggestion.id} value={suggestion}>
                          {suggestion.label}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="flex gap-4">
          <Controller
            name={"zip" as Path<TFieldValues>}
            control={control}
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
                  disabled={disabled}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name={"city" as Path<TFieldValues>}
            control={control}
            render={({ field, fieldState }) => (
              <Field className="flex-1" data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>City</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  placeholder="Berlin"
                  disabled={disabled}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
        <Controller
          name={"state" as Path<TFieldValues>}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Bundesland / State</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name={"country" as Path<TFieldValues>}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Country</FieldLabel>
              <Combobox<CountryComboboxValue>
                items={COUNTRY_OPTIONS}
                value={getCountryComboboxValue(field.value)}
                onValueChange={(country) => {
                  setAddressField("country", country?.value ?? "", {
                    shouldValidate: true,
                  });
                }}
                itemToStringLabel={(c) => c.label}
                itemToStringValue={(c) => c.value}
                isItemEqualToValue={(item, value) => item.value === value.value}
              >
                <ComboboxInput
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
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
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </FieldSet>
  );
}
