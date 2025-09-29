import merge from "lodash.merge";
import type { Metadata } from "next";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
};

const applicationName = "START Berlin Cockpit";
const author: Metadata["authors"] = {
  name: "START Berlin",
  url: "https://start-berlin.com",
};
const publisher = "START Berlin";
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const createMetadata = ({
  title,
  description,
  image,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = `${title} | ${applicationName}`;

  const ogImageUrl = productionUrl
    ? new URL(`${protocol}://${productionUrl}/api/og`)
    : new URL(`${protocol}://localhost:3000/api/og`);

  ogImageUrl.searchParams.set("title", title);
  ogImageUrl.searchParams.set("subtitle", description);

  const defaultMetadata: Metadata = {
    title: parsedTitle,
    description,
    applicationName,
    metadataBase: productionUrl
      ? new URL(`${protocol}://${productionUrl}`)
      : undefined,
    authors: [author],
    creator: author.name,
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    openGraph: {
      title: parsedTitle,
      description,
      type: "website",
      siteName: applicationName,
      locale: "en_US",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    publisher,
    twitter: {
      card: "summary_large_image",
    },
  };

  const metadata: Metadata = merge(defaultMetadata, properties);

  return metadata;
};
