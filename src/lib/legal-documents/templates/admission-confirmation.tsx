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

export interface AdmissionConfirmationTemplateData {
  legalMembershipId: string;
  subjectName: string;
  subjectAddress?: string;
  board: Array<{ name: string; role: string }>;
  activatedAt: Date;
  renderedAt: Date;
}

export function renderAdmissionConfirmationTemplate(
  data: AdmissionConfirmationTemplateData,
): ReactElement<DocumentProps> {
  const admittedOn = data.activatedAt.toISOString().substring(0, 10);
  const renderedOn = data.renderedAt.toISOString().substring(0, 10);

  return (
    <Document>
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
              The board of START Berlin e.V. hereby confirms the admission of
              the person named below as an ordinary member of the association.
            </Lead>

            {/* 01 Member */}
            <View style={{ marginTop: "11mm" }}>
              <SectionLabel no="01">Member</SectionLabel>
              <Text style={{
                fontFamily: "Avenir", fontWeight: 900,
                fontSize: 22, letterSpacing: -0.1, color: C.ink, lineHeight: 1.1,
              }}>{data.subjectName}</Text>
              {data.subjectAddress ? (
                <Text style={{
                  fontFamily: "Avenir", fontWeight: 400,
                  marginTop: "2mm", fontSize: 10, color: C.inkMuted,
                }}>{data.subjectAddress}</Text>
              ) : null}
            </View>

            {/* Details */}
            <View style={{ marginTop: "11mm" }}>
              <FieldRow label="Admitted on"       value={admittedOn} />
              <FieldRow label="Membership number" value={data.legalMembershipId} mono />
              <FieldRow label="Member type"       value="Ordinary member" />
              <FieldRow label="Annual fee"        value="EUR 40.00" />
            </View>

            {/* Hint */}
            <Text style={{
              fontFamily: "Avenir", fontWeight: 400,
              marginTop: "10mm", fontSize: 8.5, color: C.inkMuted, lineHeight: 1.5,
              borderTopWidth: 1, borderTopColor: C.ruleSoft, paddingTop: "4mm",
            }}>
              The bylaws (Satzung) and financial regulations (Finanzordnung)
              are stored in the START Cockpit and can be requested from the
              board or the Head of Finance.
            </Text>

            {/* Board roster */}
            {data.board.length > 0 ? (
              <View style={{
                marginTop: "10mm",
                borderTopWidth: 1, borderTopColor: C.rule, paddingTop: "4mm",
              }}>
                <Text style={{
                  fontFamily: "Avenir", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1.1,
                  fontSize: 7.5, color: C.inkMuted, marginBottom: "3mm",
                }}>Issued by the board</Text>
                <View style={{ flexDirection: "row", gap: 20 }}>
                  {data.board.map((m) => (
                    <View key={m.name} style={{ flex: 1 }}>
                      <Text style={{
                        fontFamily: "Avenir", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: 0.8,
                        fontSize: 7, color: C.inkMuted,
                      }}>{m.role}</Text>
                      <Text style={{
                        fontFamily: "Avenir", fontWeight: 700,
                        fontSize: 10, color: C.ink, marginTop: 2,
                      }}>{m.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <ESig text="This document was generated electronically in the START Cockpit and is valid without a signature." />
          </View>

          <DocFooter meta={[
            { key: "Tenure",   value: data.legalMembershipId },
            { key: "Rendered", value: renderedOn },
            { key: "Document", value: "ADM-CFM · v1" },
          ]} />
        </View>
      </Page>
    </Document>
  );
}
