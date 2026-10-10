import type { Block, RichTextDoc } from "./blocks";

/**
 * A fully populated issue used by three things: the React Email preview
 * (`npm run email:dev`), the local seed script, and the render tests.
 *
 * Keeping one fixture means a block that renders badly shows up in all three at
 * once. The copy is representative of the formats the team described in the
 * kickoff, not lorem ipsum, so layout problems with realistic line lengths are
 * visible.
 *
 * Images point at Cockpit's own `public/` assets so the fixture works offline.
 */

function para(
  ...spans: (string | { text: string; href: string })[]
): RichTextDoc {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: spans.map((span) =>
          typeof span === "string"
            ? { type: "text", text: span }
            : {
                type: "text",
                text: span.text,
                marks: [{ type: "link", attrs: { href: span.href } }],
              },
        ),
      },
    ],
  };
}

export function sampleBlocks(assetBase: string): Block[] {
  return [
    {
      id: "b-hero",
      kind: "hero",
      image: {
        url: `${assetBase}/og-image.png`,
        alt: "START Berlin",
        width: 1200,
        height: 630,
      },
      eyebrow: "Issue 01 · October 2026",
      headline: "Berlin's founders, in your inbox once a month",
      subheadline:
        "What actually happened at our events, who is hiring, and the three startups we could not stop talking about.",
    },
    {
      id: "b-intro",
      kind: "text",
      body: para(
        "Hi ",
        "{{{contact.first_name|there}}}",
        ", welcome to the first issue. We keep this short on purpose: two sections you read properly beat six you skim.",
      ),
    },
    { id: "b-div-1", kind: "divider" },
    {
      id: "b-news",
      kind: "linkList",
      title: "Berlin startup news",
      items: [
        {
          title: "Seed round closes for a Kreuzberg climate-tech team",
          url: "https://www.start-berlin.com",
          source: "Funding",
          blurb:
            "Eight million euros to take industrial heat recovery out of the pilot phase.",
        },
        {
          title: "Two Berlin marketplaces merge ahead of a Series A",
          url: "https://www.start-berlin.com",
          source: "Deals",
          blurb: "The combined team keeps both brands for now.",
        },
        {
          title: "A new founder residency opens applications at HU",
          url: "https://www.start-berlin.com",
          source: "Ecosystem",
          blurb: "Six months, no equity, applications close end of the month.",
        },
      ],
    },
    {
      id: "b-startups",
      kind: "startupSpotlight",
      title: "Three startups we like",
      items: [
        {
          name: "Halden",
          oneLiner:
            "Turns warehouse sensor noise into a maintenance schedule people actually follow.",
          url: "https://www.start-berlin.com",
          tag: "Hardware",
          logo: {
            url: `${assetBase}/logo-black.png`,
            alt: "Halden",
            width: 678,
            height: 310,
          },
        },
        {
          name: "Nebenan Health",
          oneLiner:
            "Booking layer for physiotherapy practices that still run on paper.",
          url: "https://www.start-berlin.com",
          tag: "Health",
        },
        {
          name: "Kleiner Vogel",
          oneLiner:
            "Payroll for companies whose staff work across three countries.",
          url: "https://www.start-berlin.com",
          tag: "Fintech",
        },
      ],
    },
    {
      id: "b-event",
      kind: "eventRecap",
      title: "What we learned at Founders Night #12",
      dateLabel: "Event recap · 14 September",
      image: {
        url: `${assetBase}/og-image.png`,
        alt: "Founders Night",
        width: 1200,
        height: 630,
      },
      body: para(
        "Ninety people, four founders on stage, and one recurring theme: nobody in the room had raised on the terms they expected. The most useful half hour happened after the panel, when two of the speakers stayed to walk through their actual cap tables.",
      ),
      ctaLabel: "See the photos",
      ctaHref: "https://www.start-berlin.com",
    },
    {
      id: "b-interview",
      kind: "interview",
      name: "Marlene Ruck",
      role: "Partner",
      company: "Spreequell Ventures",
      portrait: {
        url: `${assetBase}/logo-black.png`,
        alt: "Marlene Ruck",
        width: 678,
        height: 310,
      },
      quote:
        "We pass on strong teams every week. It is almost never about the deck.",
      body: para(
        "We asked her what she wishes first-time founders knew before the first call, and what she thinks Berlin still gets wrong about seed stage.",
      ),
      href: "https://www.start-berlin.com",
    },
    {
      id: "b-alumni",
      kind: "alumniStory",
      name: "Tobias Lenz",
      batchLabel: "Batch 7",
      headline:
        "From a START project group to leading engineering at a Series B",
      body: para(
        "Tobias joined as a second-semester student who mostly wanted to meet people. Seven years later he runs a team of twenty-two.",
      ),
      href: "https://www.start-berlin.com",
    },
    {
      id: "b-jobs",
      kind: "jobHighlight",
      title: "Hiring in the network",
      items: [
        {
          company: "Halden",
          role: "Founding Backend Engineer",
          location: "Berlin · Hybrid",
          url: "https://www.start-berlin.com",
        },
        {
          company: "Nebenan Health",
          role: "Product Designer",
          location: "Berlin · On-site",
          url: "https://www.start-berlin.com",
        },
      ],
    },
    { id: "b-div-2", kind: "divider" },
    {
      id: "b-cta",
      kind: "button",
      label: "Come to the next Founders Night",
      href: "https://www.start-berlin.com",
      align: "center",
    },
  ];
}

export const SAMPLE_SUBJECT =
  "Founders Night, three startups, and who's hiring";
export const SAMPLE_PREVIEW_TEXT =
  "Plus: what Marlene Ruck wishes first-time founders knew.";
export const SAMPLE_EYEBROW = "Issue 01 · October 2026";
