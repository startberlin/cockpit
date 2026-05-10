export interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

export interface PhotonResponse {
  features?: PhotonFeature[];
}

export interface AddressSuggestion {
  id: string;
  label: string;
  street: string;
  zip: string;
  city: string;
  state: string;
  country: string;
}

function compactParts(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean) as string[];
}

function buildStreet(properties: PhotonFeature["properties"]) {
  const street = properties?.street ?? properties?.name ?? "";
  return compactParts([street, properties?.housenumber]).join(" ");
}

export function normalizePhotonFeature(
  feature: PhotonFeature,
  index = 0,
): AddressSuggestion | null {
  const properties = feature.properties;

  if (!properties) {
    return null;
  }

  const street = buildStreet(properties);
  const zip = properties.postcode?.trim() ?? "";
  const city = properties.city?.trim() ?? "";
  const state = properties.state?.trim() ?? "";
  const country = properties.country?.trim() ?? "";
  const label = compactParts([
    street,
    compactParts([zip, city]).join(" "),
    state,
    country,
  ]).join(", ");

  if (!label) {
    return null;
  }

  return {
    id: [
      street,
      zip,
      city,
      state,
      country,
      properties.countrycode,
      String(index),
    ]
      .filter(Boolean)
      .join("|"),
    label,
    street,
    zip,
    city,
    state,
    country,
  };
}

export function normalizePhotonResponse(
  response: PhotonResponse,
): AddressSuggestion[] {
  return (response.features ?? [])
    .map((feature, index) => normalizePhotonFeature(feature, index))
    .filter((suggestion): suggestion is AddressSuggestion => !!suggestion);
}

export async function fetchPhotonAddressSuggestions(
  query: string,
): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length <= 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    limit: "5",
  });

  const response = await fetch(`https://photon.komoot.io/api?${params}`);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as PhotonResponse;
  return normalizePhotonResponse(data);
}
