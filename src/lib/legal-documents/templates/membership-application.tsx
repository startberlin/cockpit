import {
  Document,
  type DocumentProps,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { C, CONTENT, PAGE_STYLE, WRAPPER } from "./brand";
import {
  AccentRule,
  AccentSquare,
  BrandStripe,
  DocFooter,
  DocHeader,
  DocTitle,
  ESig,
  FieldRow,
  Lead,
  SectionLabel,
} from "./shared";

const DECLARATION_LABELS: Record<string, string> = {
  naturalPerson: "I confirm that I am a natural person.",
  legalCapacity: "I confirm that I have full legal capacity.",
  supportsPurpose: "I support the purpose of START Berlin e.V.",
  acceptsBylaws: "I accept the bylaws (Satzung) of START Berlin e.V.",
  acceptsFinancialRegulations:
    "I accept the Financial Regulations (Finanzordnung) of START Berlin e.V.",
  acknowledgesFee:
    "I acknowledge that, in accordance with §2 of the Financial Regulations of START Berlin e.V., a membership fee of €20 per semester applies. Upon joining, €40 are due for the first year; subsequent annual payments of €40 are due every 12 months. I understand that the membership fee is non-refundable if I leave the association early.",
};

const DECLARATION_ORDER = [
  "naturalPerson",
  "legalCapacity",
  "supportsPurpose",
  "acceptsBylaws",
  "acceptsFinancialRegulations",
  "acknowledgesFee",
];

export interface MembershipApplicationTemplateData {
  legalMembershipId: string;
  applicationId: string;
  subjectName: string;
  email?: string;
  birthDate: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  declarations: Record<string, boolean>;
  feeTextVersion: string;
  applicationVersion: string;
  submittedAt: Date;
  renderedAt: Date;
}

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

export function renderMembershipApplicationTemplate(
  data: MembershipApplicationTemplateData,
): ReactElement<DocumentProps> {
  const submittedOn = data.submittedAt.toISOString().substring(0, 10);
  const renderedOn = data.renderedAt.toISOString().substring(0, 10);

  const declarations = DECLARATION_ORDER.filter(
    (key) => data.declarations[key],
  ).map((key) => DECLARATION_LABELS[key] ?? key);

  const leftDecls = declarations.filter((_, i) => i % 2 === 0);
  const rightDecls = declarations.filter((_, i) => i % 2 !== 0);

  return (
    <Document>
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
                  <FieldRow label="Name" value={data.subjectName} />
                  <FieldRow label="Street" value={data.address.street} />
                  <FieldRow
                    label="Postal code / City"
                    value={`${data.address.zip} ${data.address.city}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldRow
                    label="State"
                    value={data.address.state || undefined}
                  />
                  <FieldRow label="Country" value={data.address.country} />
                  <FieldRow label="Email" value={data.email} />
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
              <FieldRow label="Submitted on" value={submittedOn} />
            </View>

            <ESig text="This application was submitted electronically through the START Cockpit and is valid without a signature." />
          </View>

          <DocFooter
            meta={[
              { key: "Application", value: data.applicationId },
              { key: "Tenure", value: data.legalMembershipId },
              { key: "Rendered", value: renderedOn },
            ]}
          />
        </View>
      </Page>
    </Document>
  );
}
