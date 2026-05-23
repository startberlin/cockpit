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
} from "./shared";

const TRANSITION_LABELS: Record<
  "cancelled" | "alumni" | "supporting_alumni",
  { title: string; kicker: string; lead: string }
> = {
  cancelled: {
    title: "Membership Cancellation",
    kicker: "Membership · End of Tenure",
    lead: "This document confirms the end of the membership described below in START Berlin e.V.",
  },
  alumni: {
    title: "Alumni Transition",
    kicker: "Membership · Alumni",
    lead: "This document confirms the transition of the person named below to Alumni status in START Berlin e.V.",
  },
  supporting_alumni: {
    title: "Supporting Alumni Transition",
    kicker: "Membership · Supporting Alumni",
    lead: "This document confirms the transition of the person named below to Supporting Alumni status in START Berlin e.V.",
  },
};

const REASON_LABELS: Record<"resigned" | "removed_by_board", string> = {
  resigned: "Voluntary resignation",
  removed_by_board: "Removal by board decision",
};

export interface MembershipTransitionTemplateData {
  legalMembershipId: string;
  firstName: string;
  lastName: string;
  transitionType: "cancelled" | "alumni" | "supporting_alumni";
  transitionDate: Date;
  reason?: "resigned" | "removed_by_board";
  renderedAt: Date;
}

export function renderMembershipTransitionTemplate(
  data: MembershipTransitionTemplateData,
): ReactElement<DocumentProps> {
  const { title, kicker, lead } = TRANSITION_LABELS[data.transitionType];
  const transitionOn = data.transitionDate.toISOString().substring(0, 10);
  const renderedOn = data.renderedAt.toISOString().substring(0, 10);

  return (
    <Document>
      <Page size="A4" style={PAGE_STYLE}>
        <View style={WRAPPER}>
          <BrandStripe />
          <AccentSquare />
          <View style={CONTENT}>
            <DocHeader docType={title} />
            <AccentRule />
            <DocTitle kicker={kicker}>{title}</DocTitle>
            <Lead>{lead}</Lead>

            <View style={{ marginTop: "11mm" }}>
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
                {data.firstName} {data.lastName}
              </Text>
            </View>

            <View style={{ marginTop: "11mm" }}>
              <FieldRow label="Transition date" value={transitionOn} />
              <FieldRow
                label="Membership number"
                value={data.legalMembershipId}
                mono
              />
              <FieldRow label="New status" value={title} />
              {data.reason ? (
                <FieldRow label="Reason" value={REASON_LABELS[data.reason]} />
              ) : null}
            </View>

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
              This document serves as the official record of the membership
              transition described above. It was generated electronically in the
              START Cockpit.
            </Text>

            <ESig text="This document was generated electronically in the START Cockpit and is valid without a signature." />
          </View>

          <DocFooter
            meta={[
              { key: "Tenure", value: data.legalMembershipId },
              { key: "Rendered", value: renderedOn },
              { key: "Document", value: "MTR-CFM · v1" },
            ]}
          />
        </View>
      </Page>
    </Document>
  );
}
