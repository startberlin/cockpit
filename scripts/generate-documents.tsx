#!/usr/bin/env tsx
/**
 * Generates all three START Berlin PDF documents with the new designer templates.
 * Run: npm exec tsx scripts/generate-documents.tsx
 * Output: scripts/output/*.pdf
 */

import {
  Document,
  Font,
  Image,
  Page,
  Text,
  View,
  renderToFile,
} from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Colors  (oklch → approx hex)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  brand: "#0E1540", // oklch(0.1307 0.0905 264.05) – deep navy
  brandAccent: "#42B7C8", // oklch(0.7499 0.1301 211.57) – sky cyan
  ink: "#2C2620", // oklch(0.18  0.005  56)      – warm near-black
  inkSoft: "#504840", // oklch(0.35  0.008  56)      – warm dark grey
  inkMuted: "#8A8078", // oklch(0.55  0.012  58)      – warm medium grey
  rule: "#DAD4CE", // oklch(0.86  0.004  50)      – warm light rule
  ruleSoft: "#ECE9E5", // oklch(0.93  0.003  50)      – very light rule
  paperAlt: "#FAFAF8", // e-sig / integrity bg
  voteYesBg: "#E8F5EC",
  voteYesFg: "#2D6A42",
  voteNoBg: "#FBE9E7",
  voteNoFg: "#8B2E1A",
  white: "#FFFFFF",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────────────────────────────────────
const ASSETS = "/Users/soenke/Downloads/START Cockpit New Nav (1)";
const LOGO = path.join(ASSETS, "assets/logo-black.png");
const FONTS = path.join(ASSETS, "fonts");

Font.register({
  family: "Avenir",
  fonts: [
    { src: path.join(FONTS, "avenirnext-medium.otf"), fontWeight: 400 },
    { src: path.join(FONTS, "avenirnext-bold.otf"), fontWeight: 700 },
    { src: path.join(FONTS, "avenirnext-heavy.otf"), fontWeight: 900 },
  ],
});

// Disable automatic hyphenation — let words wrap naturally at spaces only.
Font.registerHyphenationCallback((word) => [word]);

// ─────────────────────────────────────────────────────────────────────────────
// Mock data (matches SAMPLE from documents-app.jsx)
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE = {
  member: {
    name: "Peter Partnerships",
    address: "Lehderstraße 59 · 13086 Berlin · Germany",
    street: "Lehderstraße 59",
    zip: "13086",
    city: "Berlin",
    state: "",
    country: "Germany",
    email: "peter@partnerships.io",
  },
  admittedOn: "2026-05-10",
  submittedOn: "2026-05-10",
  renderedOn: "2026-05-10",
  tenureId: "lm_DLXmMna2a4VQ3hGV",
  applicationId: "ma_9g7rXYJfR6FgPtFR",
  resolutionId: "brs_nePhM7ZaTzTAcKHz",
  sha256: "3a32bfa20236c1e8ad9d35e8d5ff04c7b9a812c6f1e92d4b6ae0a1b0c47de912",
  board: [
    {
      name: "Paul",
      role: "President",
      roleKey: "president",
      vote: "—",
      date: "—",
    },
    {
      name: "Victoria",
      role: "Vice President",
      roleKey: "vice_president",
      vote: "yes",
      date: "2026-05-10",
    },
    {
      name: "Hans",
      role: "Head of Finance",
      roleKey: "head_of_finance",
      vote: "yes",
      date: "2026-05-10",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared component helpers
// ─────────────────────────────────────────────────────────────────────────────

// The brand stripe + accent square are absolute-positioned over the full page.
// The page itself has no padding; a content View carries the insets.
const PAGE_STYLE = {
  fontFamily: "Avenir",
  backgroundColor: C.white,
} as const;

// Wrapper with explicit A4 dimensions — gives Yoga a firm reference for all
// absolute children (BrandStripe, AccentSquare, DocFooter) and prevents the
// blank-page overflow bug that occurs when Page children use position:absolute.
const WRAPPER = {
  width: "210mm",
  height: "297mm",
} as const;

// Content area insets: 18mm top, 22mm sides, 52mm bottom (20mm + 32mm footer zone).
const CONTENT = {
  paddingTop: "18mm",
  paddingLeft: "22mm",
  paddingRight: "22mm",
  paddingBottom: "52mm",
} as const;

function BrandStripe() {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "6mm",
        height: "297mm", // explicit A4 height — bottom:0 triggers Yoga blank-page bug
        backgroundColor: C.brand,
      }}
    />
  );
}

function AccentSquare() {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: "38mm",
        width: "6mm",
        height: "6mm",
        backgroundColor: C.brandAccent,
      }}
    />
  );
}

function DocHeader({ docType }: { docType: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <Image src={LOGO} style={{ height: "14mm" }} />
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.7,
          fontSize: 8,
          color: C.ink,
        }}
      >
        {docType}
      </Text>
    </View>
  );
}

function AccentRule() {
  return (
    <View style={{ marginTop: "10mm", height: 2, flexDirection: "row" }}>
      <View style={{ width: "28%", backgroundColor: C.brand }} />
      <View style={{ width: "8%", backgroundColor: C.brandAccent }} />
      <View style={{ flex: 1, backgroundColor: C.rule }} />
    </View>
  );
}

function DocTitle({ kicker, children }: { kicker?: string; children: string }) {
  return (
    <View style={{ marginTop: "16mm" }}>
      {kicker ? (
        <Text
          style={{
            fontFamily: "Avenir",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1.3,
            fontSize: 7,
            color: C.brandAccent,
            marginBottom: "5mm",
          }}
        >
          {kicker}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 900,
          fontSize: 32,
          lineHeight: 1.02,
          color: C.brand,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function Lead({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: "Avenir",
        fontWeight: 400,
        marginTop: "8mm",
        fontSize: 10,
        lineHeight: 1.55,
        color: C.inkSoft,
      }}
    >
      {children}
    </Text>
  );
}

function SectionLabel({ no, children }: { no?: string; children: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: C.ink,
        paddingTop: "4mm",
        marginBottom: "5mm",
        gap: 6,
      }}
    >
      {no ? (
        <View
          style={{
            backgroundColor: C.ink,
            paddingHorizontal: 4,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontFamily: "Avenir",
              fontWeight: 700,
              fontSize: 7,
              letterSpacing: 0.6,
              color: C.white,
            }}
          >
            {no}
          </Text>
        </View>
      ) : null}
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.1,
          fontSize: 8,
          color: C.ink,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function FieldRow({
  label,
  value,
  mono,
  noBorder,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  noBorder?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        paddingVertical: "2.5mm",
        ...(noBorder
          ? {}
          : { borderBottomWidth: 1, borderBottomColor: C.ruleSoft }),
      }}
    >
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontSize: 7.5,
          color: C.inkMuted,
          width: "38mm",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 400,
          flex: 1,
          fontSize: 10,
          color: C.ink,
          ...(mono ? { letterSpacing: 0.1 } : {}),
        }}
      >
        {value ?? "—"}
      </Text>
    </View>
  );
}

function OrgBlock() {
  return (
    <View>
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontSize: 8.5,
          color: C.ink,
          marginBottom: 2,
        }}
      >
        START Berlin e.V.
      </Text>
      {[
        "Luisenstraße 53 · c/o HU-Gründerhaus · 10117 Berlin",
        "Vereinsregister VR 32262 B · Amtsgericht Charlottenburg, Berlin",
        "vorstand@start-berlin.com · start-berlin.com",
      ].map((line, i) => (
        <Text
          key={i}
          style={{
            fontFamily: "Avenir",
            fontWeight: 400,
            fontSize: 8,
            color: C.inkMuted,
            lineHeight: 1.5,
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

function DocFooter({ meta }: { meta: Array<{ key: string; value: string }> }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: "20mm",
        left: "22mm",
        right: "22mm",
        borderTopWidth: 1,
        borderTopColor: C.rule,
        paddingTop: "5mm",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <OrgBlock />
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        {meta.map((m, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", gap: 17, alignItems: "baseline" }}
          >
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                fontSize: 7.5,
                color: C.inkMuted,
              }}
            >
              {m.key}
            </Text>
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 400,
                fontSize: 8.5,
                color: C.ink,
                letterSpacing: 0.1,
              }}
            >
              {m.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ESig({ text }: { text: string }) {
  return (
    <View
      style={{
        marginTop: "10mm",
        flexDirection: "row",
        gap: 8,
        padding: "4mm",
        borderWidth: 1,
        borderColor: C.rule,
        backgroundColor: C.paperAlt,
        alignItems: "flex-start",
      }}
    >
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 900,
          fontSize: 12,
          color: C.brandAccent,
          lineHeight: 1,
        }}
      >
        ■
      </Text>
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 400,
          flex: 1,
          fontSize: 8.5,
          lineHeight: 1.45,
          color: C.ink,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Admission Confirmation
// ─────────────────────────────────────────────────────────────────────────────

function AdmissionConfirmationPage() {
  const d = SAMPLE;
  return (
    <Page size="A4" style={PAGE_STYLE}>
      <View style={WRAPPER}>
        <BrandStripe />
        <AccentSquare />
        <View style={CONTENT}>
          <DocHeader docType="Admission Confirmation" />
          <AccentRule />
          <DocTitle kicker="Membership · Confirmation">
            Admission Confirmation
          </DocTitle>
          <Lead>
            The board of START Berlin e.V. hereby confirms the admission of the
            person named below as an ordinary member of the association.
          </Lead>

          {/* 01 Member */}
          <View style={{ marginTop: "11mm" }}>
            <SectionLabel no="01">Member</SectionLabel>
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: -0.1,
                color: C.ink,
                lineHeight: 1.1,
              }}
            >
              {d.member.name}
            </Text>
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 400,
                marginTop: "2mm",
                fontSize: 10,
                color: C.inkMuted,
              }}
            >
              {d.member.address}
            </Text>
          </View>

          {/* Details */}
          <View style={{ marginTop: "11mm" }}>
            <FieldRow label="Admitted on" value={d.admittedOn} />
            <FieldRow label="Membership number" value={d.tenureId} mono />
            <FieldRow label="Member type" value="Ordinary member" />
            <FieldRow label="Annual fee" value="EUR 40.00" />
          </View>

          {/* Hint */}
          <Text
            style={{
              fontFamily: "Avenir",
              fontWeight: 400,
              marginTop: "10mm",
              fontSize: 8.5,
              color: C.inkMuted,
              lineHeight: 1.5,
              borderTopWidth: 1,
              borderTopColor: C.ruleSoft,
              paddingTop: "4mm",
            }}
          >
            The bylaws (Satzung) and financial regulations (Finanzordnung) are
            stored in the START Cockpit and can be requested from the board or
            the Head of Finance.
          </Text>

          {/* Board roster */}
          <View
            style={{
              marginTop: "10mm",
              borderTopWidth: 1,
              borderTopColor: C.rule,
              paddingTop: "4mm",
            }}
          >
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.1,
                fontSize: 7.5,
                color: C.inkMuted,
                marginBottom: "3mm",
              }}
            >
              Issued by the board
            </Text>
            <View style={{ flexDirection: "row", gap: 20 }}>
              {d.board.map((m) => (
                <View key={m.name} style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Avenir",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontSize: 7,
                      color: C.inkMuted,
                    }}
                  >
                    {m.role}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Avenir",
                      fontWeight: 700,
                      fontSize: 10,
                      color: C.ink,
                      marginTop: 2,
                    }}
                  >
                    {m.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <ESig text="This document was generated electronically in the START Cockpit and is valid without a signature." />
        </View>

        <DocFooter
          meta={[
            { key: "Tenure", value: d.tenureId },
            { key: "Rendered", value: d.renderedOn },
            { key: "Document", value: "ADM-CFM · v1" },
          ]}
        />
      </View>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Membership Application
// ─────────────────────────────────────────────────────────────────────────────

const DECLARATIONS = [
  "I confirm that I am a natural person.",
  "I confirm that I have full legal capacity.",
  "I support the purpose of START Berlin e.V.",
  "I accept the bylaws (Satzung) of START Berlin e.V.",
  "I have read and accept the privacy notice.",
  "I acknowledge that, in accordance with §2 of the Financial Regulations of START Berlin e.V., a membership fee of €20 per semester applies. Upon joining, €40 are due for the first year; subsequent annual payments of €40 are due every 12 months. I understand that the membership fee is non-refundable if I leave the association early.",
];

function DeclarationItem({ text }: { text: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: "3mm",
        alignItems: "flex-start",
        paddingTop: "3mm",
        borderTopWidth: 1,
        borderTopColor: C.ruleSoft,
      }}
    >
      <View
        style={{
          width: "5mm",
          height: "5mm",
          flexShrink: 0,
          borderWidth: 1.5,
          borderColor: C.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Avenir",
            fontWeight: 900,
            fontSize: 9,
            color: C.brand,
            lineHeight: 1,
          }}
        >
          ×
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "Avenir",
          fontWeight: 400,
          flex: 1,
          fontSize: 8.5,
          lineHeight: 1.4,
          color: C.ink,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function MembershipApplicationPage() {
  const d = SAMPLE;
  const leftDecls = DECLARATIONS.filter((_, i) => i % 2 === 0);
  const rightDecls = DECLARATIONS.filter((_, i) => i % 2 !== 0);

  return (
    <Page size="A4" style={PAGE_STYLE}>
      <View style={WRAPPER}>
        <BrandStripe />
        <AccentSquare />
        <View style={CONTENT}>
          <DocHeader docType="Membership Application" />
          <AccentRule />
          <DocTitle kicker="Membership · Application">
            Membership Application
          </DocTitle>
          <Lead>
            I hereby apply for admission as an ordinary member of START Berlin
            e.V. The information below is complete and truthful.
          </Lead>

          {/* 01 Personal details */}
          <View style={{ marginTop: "11mm" }}>
            <SectionLabel no="01">Personal details</SectionLabel>
            <View style={{ flexDirection: "row", gap: "14mm" }}>
              <View style={{ flex: 1 }}>
                <FieldRow label="Name" value={d.member.name} />
                <FieldRow label="Street" value={d.member.street} />
                <FieldRow
                  label="Postal code / City"
                  value={`${d.member.zip} ${d.member.city}`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldRow label="State" value={d.member.state || undefined} />
                <FieldRow label="Country" value={d.member.country} />
                <FieldRow label="Email" value={d.member.email} />
              </View>
            </View>
          </View>

          {/* 02 Declarations */}
          <View style={{ marginTop: "11mm" }}>
            <SectionLabel no="02">Declarations</SectionLabel>
            <View style={{ flexDirection: "row", gap: "10mm" }}>
              <View style={{ flex: 1, gap: "4mm" }}>
                {leftDecls.map((decl, i) => (
                  <DeclarationItem key={i} text={decl} />
                ))}
              </View>
              <View style={{ flex: 1, gap: "4mm" }}>
                {rightDecls.map((decl, i) => (
                  <DeclarationItem key={i} text={decl} />
                ))}
              </View>
            </View>
          </View>

          {/* Submitted on */}
          <View style={{ marginTop: "11mm" }}>
            <FieldRow label="Submitted on" value={d.submittedOn} />
          </View>

          <ESig text="This application was submitted electronically through the START Cockpit and is valid without a signature." />
        </View>

        <DocFooter
          meta={[
            { key: "Application", value: d.applicationId },
            { key: "Tenure", value: d.tenureId },
            { key: "Rendered", value: d.renderedOn },
          ]}
        />
      </View>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Board Resolution
// ─────────────────────────────────────────────────────────────────────────────

function VoteChip({ vote }: { vote: string }) {
  if (vote === "yes") {
    return (
      <View
        style={{
          backgroundColor: C.voteYesBg,
          paddingHorizontal: 5,
          paddingVertical: 2,
          alignSelf: "flex-start",
        }}
      >
        <Text
          style={{
            fontFamily: "Avenir",
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: 0.5,
            color: C.voteYesFg,
          }}
        >
          YES
        </Text>
      </View>
    );
  }
  if (vote === "no") {
    return (
      <View
        style={{
          backgroundColor: C.voteNoBg,
          paddingHorizontal: 5,
          paddingVertical: 2,
          alignSelf: "flex-start",
        }}
      >
        <Text
          style={{
            fontFamily: "Avenir",
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: 0.5,
            color: C.voteNoFg,
          }}
        >
          NO
        </Text>
      </View>
    );
  }
  if (vote === "abstain") {
    return (
      <View
        style={{
          backgroundColor: C.ruleSoft,
          paddingHorizontal: 5,
          paddingVertical: 2,
          alignSelf: "flex-start",
        }}
      >
        <Text
          style={{
            fontFamily: "Avenir",
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: 0.5,
            color: C.inkSoft,
          }}
        >
          ABS.
        </Text>
      </View>
    );
  }
  return (
    <Text
      style={{
        fontFamily: "Avenir",
        fontWeight: 400,
        fontSize: 9,
        color: C.inkMuted,
      }}
    >
      —
    </Text>
  );
}

function BoardResolutionPage() {
  const d = SAMPLE;
  const board = d.board;
  const yes = board.filter((b) => b.vote === "yes").length;
  const no = board.filter((b) => b.vote === "no").length;
  const abs = board.filter((b) => b.vote === "abstain").length;

  return (
    <Page size="A4" style={PAGE_STYLE}>
      <View style={WRAPPER}>
        <BrandStripe />
        <AccentSquare />
        <View style={CONTENT}>
          <DocHeader docType="Board Resolution" />
          <AccentRule />
          <DocTitle kicker="Board · Resolution">Board Resolution</DocTitle>

          {/* Meta strip (3 col) */}
          <View
            style={{
              flexDirection: "row",
              gap: "10mm",
              marginTop: "14mm",
              borderTopWidth: 1,
              borderTopColor: C.rule,
              borderBottomWidth: 1,
              borderBottomColor: C.rule,
              paddingVertical: "4mm",
            }}
          >
            {[
              { label: "Resolution ID", value: d.resolutionId, mono: true },
              { label: "Date", value: d.renderedOn },
              { label: "Quorum", value: `${yes + no + abs} / ${board.length}` },
            ].map((f) => (
              <View key={f.label} style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    fontSize: 7.5,
                    color: C.inkMuted,
                    marginBottom: 2,
                  }}
                >
                  {f.label}
                </Text>
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 400,
                    fontSize: 9.5,
                    color: C.ink,
                    ...(f.mono ? { letterSpacing: 0.1 } : {}),
                  }}
                >
                  {f.value}
                </Text>
              </View>
            ))}
          </View>

          {/* 01 Resolution text */}
          <View style={{ marginTop: "11mm" }}>
            <SectionLabel no="01">Resolution text</SectionLabel>
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 400,
                fontSize: 10,
                lineHeight: 1.55,
                color: C.ink,
              }}
            >
              {"The board resolves to admit "}
              <Text style={{ fontFamily: "Avenir", fontWeight: 900 }}>
                {d.member.name}
              </Text>
              {
                " as an ordinary member of START Berlin e.V. with effect from the date stated above. The formal requirements have been reviewed and are met."
              }
            </Text>
          </View>

          {/* 02 Vote table */}
          <View style={{ marginTop: "11mm" }}>
            <SectionLabel no="02">Vote</SectionLabel>
            {/* Header row */}
            <View
              style={{
                flexDirection: "row",
                borderBottomWidth: 1.5,
                borderBottomColor: C.ink,
                paddingBottom: "3mm",
              }}
            >
              {(["Name", "Role", "Role key", "Vote", "Date"] as const).map(
                (h, i) => (
                  <Text
                    key={i}
                    style={{
                      fontFamily: "Avenir",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      fontSize: 7.5,
                      color: C.ink,
                      width:
                        i === 0
                          ? "30%"
                          : i === 1
                            ? "30%"
                            : i === 2
                              ? "20%"
                              : "10%",
                    }}
                  >
                    {h}
                  </Text>
                ),
              )}
            </View>
            {/* Body rows */}
            {board.map((b, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: "3.5mm",
                  borderBottomWidth: 1,
                  borderBottomColor: C.ruleSoft,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 400,
                    fontSize: 9.5,
                    color: C.ink,
                    width: "30%",
                  }}
                >
                  {b.name}
                </Text>
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 400,
                    fontSize: 9.5,
                    color: C.ink,
                    width: "30%",
                  }}
                >
                  {b.role}
                </Text>
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 400,
                    fontSize: 9.5,
                    color: C.ink,
                    width: "20%",
                    letterSpacing: 0.1,
                  }}
                >
                  {b.roleKey}
                </Text>
                <View style={{ width: "10%" }}>
                  <VoteChip vote={b.vote} />
                </View>
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 400,
                    fontSize: 9.5,
                    color: C.ink,
                    width: "10%",
                    letterSpacing: 0.1,
                  }}
                >
                  {b.date}
                </Text>
              </View>
            ))}
            {/* Tally */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderTopWidth: 1.5,
                borderTopColor: C.ink,
                paddingTop: "4mm",
              }}
            >
              <Text
                style={{
                  fontFamily: "Avenir",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  fontSize: 7.5,
                  color: C.inkMuted,
                }}
              >
                Tally
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View
                  style={{
                    backgroundColor: C.voteYesBg,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Avenir",
                      fontWeight: 700,
                      fontSize: 8,
                      letterSpacing: 0.5,
                      color: C.voteYesFg,
                    }}
                  >
                    {yes} YES
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: C.voteNoBg,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Avenir",
                      fontWeight: 700,
                      fontSize: 8,
                      letterSpacing: 0.5,
                      color: C.voteNoFg,
                    }}
                  >
                    {no} NO
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: C.ruleSoft,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Avenir",
                      fontWeight: 700,
                      fontSize: 8,
                      letterSpacing: 0.5,
                      color: C.inkSoft,
                    }}
                  >
                    {abs} ABS.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 03 Integrity */}
          <View style={{ marginTop: "11mm" }}>
            <SectionLabel no="03">Integrity</SectionLabel>
            <View
              style={{
                borderWidth: 1,
                borderColor: C.rule,
                padding: "5mm",
                backgroundColor: C.paperAlt,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: "4mm",
                  alignItems: "baseline",
                  paddingBottom: "3mm",
                  borderBottomWidth: 1,
                  borderBottomColor: C.ruleSoft,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.9,
                    fontSize: 7.5,
                    color: C.inkMuted,
                    width: "20mm",
                  }}
                >
                  SHA-256
                </Text>
                <Text
                  style={{
                    fontFamily: "Avenir",
                    fontWeight: 400,
                    flex: 1,
                    fontSize: 8.5,
                    color: C.ink,
                    letterSpacing: 0.1,
                  }}
                >
                  {d.sha256}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Avenir",
                  fontWeight: 400,
                  marginTop: "3mm",
                  fontSize: 7.5,
                  color: C.inkMuted,
                  lineHeight: 1.5,
                }}
              >
                This resolution was recorded digitally in the START Berlin e.V.
                Cockpit. The checksum above binds the resolution text, the vote
                and the timestamp together. Any change produces a different
                checksum.
              </Text>
            </View>
          </View>
        </View>

        <DocFooter
          meta={[
            { key: "Resolution", value: d.resolutionId },
            { key: "Tenure", value: d.tenureId },
            { key: "Rendered", value: d.renderedOn },
          ]}
        />
      </View>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Appendix title pages
// ─────────────────────────────────────────────────────────────────────────────

function AppendixPage({
  letter,
  title,
  docId,
}: {
  letter: string;
  title: string;
  docId: string;
}) {
  const d = SAMPLE;
  return (
    <Page size="A4" style={PAGE_STYLE}>
      <View style={WRAPPER}>
        <BrandStripe />
        <AccentSquare />
        <View style={CONTENT}>
          <DocHeader docType={`Appendix ${letter}`} />
          <AccentRule />

          <View style={{ marginTop: "22mm" }}>
            <View
              style={{
                backgroundColor: C.brand,
                paddingHorizontal: 10,
                paddingVertical: 4,
                alignSelf: "flex-start",
                marginBottom: "8mm",
              }}
            >
              <Text
                style={{
                  fontFamily: "Avenir",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.3,
                  fontSize: 8,
                  color: C.white,
                }}
              >
                Appendix {letter}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Avenir",
                fontWeight: 900,
                fontSize: 48,
                lineHeight: 0.95,
                color: C.brand,
              }}
            >
              {title}
            </Text>
          </View>
        </View>

        <DocFooter
          meta={[
            { key: "Document", value: docId },
            { key: "Tenure", value: d.tenureId },
            { key: "Rendered", value: d.renderedOn },
          ]}
        />
      </View>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate
// ─────────────────────────────────────────────────────────────────────────────

const OUT = path.resolve(process.cwd(), "scripts/output");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function main() {
  console.log("Generating START Berlin PDF documents…\n");

  await renderToFile(
    <Document>
      <AdmissionConfirmationPage />
    </Document>,
    path.join(OUT, "admission-confirmation.pdf"),
  );
  console.log("  ✓ admission-confirmation.pdf");

  await renderToFile(
    <Document>
      <MembershipApplicationPage />
      <AppendixPage letter="A" title="Bylaws (Satzung)" docId="ANX-A" />
      <AppendixPage
        letter="B"
        title="Financial Regulations (Finanzordnung)"
        docId="ANX-B"
      />
    </Document>,
    path.join(OUT, "membership-application.pdf"),
  );
  console.log("  ✓ membership-application.pdf");

  await renderToFile(
    <Document>
      <BoardResolutionPage />
    </Document>,
    path.join(OUT, "board-resolution.pdf"),
  );
  console.log("  ✓ board-resolution.pdf");

  console.log(`\nOutput → ${OUT}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
