"use client";

import { AsYouType, type CountryCode } from "libphonenumber-js";
import * as React from "react";
import { Input } from "@/components/ui/input";

interface PhoneNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  defaultCountry?: CountryCode;
  onChange?: (value: string | undefined) => void;
}

export const PhoneNumberInput = React.forwardRef<
  HTMLInputElement,
  PhoneNumberInputProps
>(({ defaultCountry = "US", onChange, ...props }, ref) => {
  const [formattedValue, setFormattedValue] = React.useState(
    props.value
      ? new AsYouType(defaultCountry).input(props.value.toString())
      : "",
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatter = new AsYouType(defaultCountry);
    const formatted = formatter.input(inputValue);
    const e164 = formatter.getNumberValue() || undefined;

    setFormattedValue(formatted);
    onChange?.(e164);
  };

  return (
    <Input
      {...props}
      ref={ref}
      value={formattedValue}
      onChange={handleChange}
      autoComplete="tel"
      type="tel"
    />
  );
});

PhoneNumberInput.displayName = "PhoneNumberInput";
