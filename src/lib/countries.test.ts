import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COUNTRY_OPTIONS,
  DEFAULT_COUNTRY,
  findCountryByName,
  getCountryOption,
  getDefaultCountry,
} from "./countries";

describe("countries", () => {
  it("includes Germany as the default country", () => {
    assert.equal(DEFAULT_COUNTRY, "Germany");
    assert.equal(getDefaultCountry(null), "Germany");
    assert.equal(getDefaultCountry(""), "Germany");
    assert.equal(getDefaultCountry("Austria"), "Austria");
  });

  it("finds Germany and Austria by display name", () => {
    assert.equal(findCountryByName("Germany")?.code, "DE");
    assert.equal(findCountryByName("austria")?.code, "AT");
    assert.equal(getCountryOption("Germany")?.code, "DE");
  });

  it("does not expose duplicate submitted values", () => {
    const values = COUNTRY_OPTIONS.map((country) => country.value);
    assert.equal(new Set(values).size, values.length);
  });
});
