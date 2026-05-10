import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePhotonFeature,
  normalizePhotonResponse,
} from "./photon-address";

describe("photon address normalization", () => {
  it("normalizes a full Photon feature into address form values", () => {
    const suggestion = normalizePhotonFeature({
      properties: {
        street: "Hauptstraße",
        housenumber: "42",
        postcode: "10115",
        city: "Berlin",
        state: "Berlin",
        country: "Germany",
      },
    });

    assert.deepEqual(suggestion, {
      id: "Hauptstraße 42|10115|Berlin|Berlin|Germany|0",
      label: "Hauptstraße 42, 10115 Berlin, Berlin, Germany",
      street: "Hauptstraße 42",
      zip: "10115",
      city: "Berlin",
      state: "Berlin",
      country: "Germany",
    });
  });

  it("uses name when street is missing", () => {
    const suggestion = normalizePhotonFeature({
      properties: {
        name: "Alexanderplatz",
        postcode: "10178",
        city: "Berlin",
        country: "Germany",
      },
    });

    assert.equal(suggestion?.street, "Alexanderplatz");
    assert.equal(suggestion?.label, "Alexanderplatz, 10178 Berlin, Germany");
  });

  it("does not add stray whitespace when house number is missing", () => {
    const suggestion = normalizePhotonFeature({
      properties: {
        street: "Hauptstraße",
        city: "Berlin",
      },
    });

    assert.equal(suggestion?.street, "Hauptstraße");
    assert.equal(suggestion?.label, "Hauptstraße, Berlin");
  });

  it("keeps missing optional properties as empty form values", () => {
    const suggestion = normalizePhotonFeature({
      properties: {
        street: "Hauptstraße",
      },
    });

    assert.equal(suggestion?.zip, "");
    assert.equal(suggestion?.city, "");
    assert.equal(suggestion?.state, "");
    assert.equal(suggestion?.country, "");
  });

  it("filters out empty features from responses", () => {
    const suggestions = normalizePhotonResponse({
      features: [
        {},
        { properties: {} },
        { properties: { street: "Hauptstraße" } },
      ],
    });

    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]?.street, "Hauptstraße");
  });
});
