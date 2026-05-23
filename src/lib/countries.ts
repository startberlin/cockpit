import countries, { type Alpha2Code } from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export type CountryCode = Alpha2Code;

export interface CountryOption {
  code: CountryCode;
  label: string;
  value: string;
}

export const DEFAULT_COUNTRY = "Germany";

const LOCALE = "en";

function isCountryCode(code: string): code is CountryCode {
  return countries.isValid(code.toUpperCase());
}

export const COUNTRY_OPTIONS: CountryOption[] = Object.entries(
  countries.getNames(LOCALE, { select: "official" }),
)
  .map(([code, label]) => ({
    code: code as CountryCode,
    label,
    value: label,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, LOCALE));

/**
 * Country name -> country option
 *
 * Example:
 * "Germany" -> { code: "DE", label: "Germany", value: "Germany" }
 */
export function findCountryByName(name: string): CountryOption | undefined {
  const alpha2Code = countries.getAlpha2Code(name.trim(), LOCALE);

  if (!alpha2Code) {
    return undefined;
  }

  return findCountryByCode(alpha2Code);
}

/**
 * Country code -> country option
 *
 * Example:
 * "DE" -> { code: "DE", label: "Germany", value: "Germany" }
 */
export function findCountryByCode(code: string): CountryOption | undefined {
  const normalizedCode = code.trim().toUpperCase();

  if (!isCountryCode(normalizedCode)) {
    return undefined;
  }

  const label = countries.getName(normalizedCode, LOCALE, {
    select: "official",
  });

  if (!label) {
    return undefined;
  }

  return {
    code: normalizedCode,
    label,
    value: label,
  };
}

/**
 * Accepts either a country name or an alpha-2 country code.
 *
 * Examples:
 * "Germany" -> Germany option
 * "DE"      -> Germany option
 */
export function getCountryOption(
  country: string | null | undefined,
): CountryOption | undefined {
  if (!country) {
    return undefined;
  }

  const trimmedCountry = country.trim();

  if (!trimmedCountry) {
    return undefined;
  }

  if (trimmedCountry.length === 2) {
    const byCode = findCountryByCode(trimmedCountry);

    if (byCode) {
      return byCode;
    }
  }

  return findCountryByName(trimmedCountry);
}

/**
 * Country name -> alpha-2 code
 *
 * Example:
 * "Germany" -> "DE"
 */
export function getCountryCodeByName(
  name: string | null | undefined,
): CountryCode | undefined {
  if (!name) {
    return undefined;
  }

  const alpha2Code = countries.getAlpha2Code(name.trim(), LOCALE);

  return alpha2Code as CountryCode | undefined;
}

/**
 * Alpha-2 code -> country name
 *
 * Example:
 * "DE" -> "Germany"
 */
export function getCountryNameByCode(
  code: string | null | undefined,
): string | undefined {
  if (!code) {
    return undefined;
  }

  const country = findCountryByCode(code);

  return country?.label;
}

export function getDefaultCountry(existingCountry: string | null | undefined) {
  const trimmedCountry = existingCountry?.trim();
  return trimmedCountry || DEFAULT_COUNTRY;
}
