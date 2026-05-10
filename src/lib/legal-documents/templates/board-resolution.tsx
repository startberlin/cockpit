import {
  Document,
  type DocumentProps,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { C, CONTENT, PAGE_STYLE, ROLE_DISPLAY, WRAPPER } from "./brand";
import {
  AccentRule,
  AccentSquare,
  BrandStripe,
  DocFooter,
  DocHeader,
  DocTitle,
  SectionLabel,
  VoteChip,
} from "./shared";

export interface BoardResolutionTemplateData {
  legalMembershipId: string;
  resolutionId: string;
  resolutionText: string;
  resolutionTextHash: string;
  subjectName: string;
  sitzungsleiter: { name: string; officerFunction: string };
  protokollfuehrer: { name: string; officerFunction: string };
  participants: Array<{
    userId: string;
    name: string;
    officerFunction: string;
  }>;
  votes: Array<{
    voterUserId: string;
    voterName: string;
    value: string;
    castAt: Date;
  }>;
  renderedAt: Date;
}

export function renderBoardResolutionTemplate(
  data: BoardResolutionTemplateData,
): ReactElement<DocumentProps> {
  const renderedOn = data.renderedAt.toISOString().substring(0, 10);

  const board = data.participants.map((p) => {
    const vote = data.votes.find((v) => v.voterUserId === p.userId);
    return {
      name:    p.name,
      role:    ROLE_DISPLAY[p.officerFunction] ?? p.officerFunction,
      roleKey: p.officerFunction,
      vote:    vote?.value ?? "—",
      date:    vote ? vote.castAt.toISOString().substring(0, 10) : "—",
    };
  });

  const yes = board.filter((b) => b.vote === "yes").length;
  const no  = board.filter((b) => b.vote === "no").length;
  const abs = board.filter((b) => b.vote === "abstain").length;

  return (
    <Document>
      <Page size="A4" style={PAGE_STYLE}>
        <View style={WRAPPER}>
          <BrandStripe />
          <AccentSquare />
          <View style={CONTENT}>
            <DocHeader docType="Board Resolution" />
            <AccentRule />
            <DocTitle kicker="Board · Resolution">Board Resolution</DocTitle>

            {/* Meta strip */}
            <View style={{
              flexDirection: "row", gap: "10mm",
              marginTop: "14mm",
              borderTopWidth: 1, borderTopColor: C.rule,
              borderBottomWidth: 1, borderBottomColor: C.rule,
              paddingVertical: "4mm",
            }}>
              {[
                { label: "Resolution ID", value: data.resolutionId, mono: true },
                { label: "Date",          value: renderedOn },
                { label: "Quorum",        value: `${yes + no + abs} / ${board.length}` },
              ].map((f) => (
                <View key={f.label} style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: "Avenir", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.8,
                    fontSize: 7.5, color: C.inkMuted, marginBottom: 2,
                  }}>{f.label}</Text>
                  <Text style={{
                    fontFamily: "Avenir", fontWeight: 400,
                    fontSize: 9.5, color: C.ink,
                    ...(f.mono ? { letterSpacing: 0.1 } : {}),
                  }}>{f.value}</Text>
                </View>
              ))}
            </View>

            {/* 01 Resolution text */}
            <View style={{ marginTop: "11mm" }}>
              <SectionLabel no="01">Resolution text</SectionLabel>
              <Text style={{ fontFamily: "Avenir", fontWeight: 400, fontSize: 10, lineHeight: 1.55, color: C.ink }}>
                {data.resolutionText}
              </Text>
            </View>

            {/* 02 Vote table */}
            <View style={{ marginTop: "11mm" }}>
              <SectionLabel no="02">Vote</SectionLabel>
              {/* Header */}
              <View style={{
                flexDirection: "row",
                borderBottomWidth: 1.5, borderBottomColor: C.ink,
                paddingBottom: "3mm",
              }}>
                {(["Name", "Role", "Role key", "Vote", "Date"] as const).map((h, i) => (
                  <Text key={i} style={{
                    fontFamily: "Avenir", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.8,
                    fontSize: 7.5, color: C.ink,
                    width: i === 0 ? "30%" : i === 1 ? "30%" : i === 2 ? "20%" : "10%",
                  }}>{h}</Text>
                ))}
              </View>
              {/* Rows */}
              {board.map((b, i) => (
                <View key={i} style={{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: "3.5mm",
                  borderBottomWidth: 1, borderBottomColor: C.ruleSoft,
                }}>
                  <Text style={{ fontFamily: "Avenir", fontWeight: 400, fontSize: 9.5, color: C.ink, width: "30%" }}>{b.name}</Text>
                  <Text style={{ fontFamily: "Avenir", fontWeight: 400, fontSize: 9.5, color: C.ink, width: "30%" }}>{b.role}</Text>
                  <Text style={{ fontFamily: "Avenir", fontWeight: 400, fontSize: 9.5, color: C.ink, width: "20%", letterSpacing: 0.1 }}>{b.roleKey}</Text>
                  <View style={{ width: "10%" }}><VoteChip vote={b.vote} /></View>
                  <Text style={{ fontFamily: "Avenir", fontWeight: 400, fontSize: 9.5, color: C.ink, width: "10%", letterSpacing: 0.1 }}>{b.date}</Text>
                </View>
              ))}
              {/* Tally */}
              <View style={{
                flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                borderTopWidth: 1.5, borderTopColor: C.ink, paddingTop: "4mm",
              }}>
                <Text style={{
                  fontFamily: "Avenir", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 0.8,
                  fontSize: 7.5, color: C.inkMuted,
                }}>Tally</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ backgroundColor: C.voteYesBg, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: "Avenir", fontWeight: 700, fontSize: 8, letterSpacing: 0.5, color: C.voteYesFg }}>{yes} YES</Text>
                  </View>
                  <View style={{ backgroundColor: C.voteNoBg, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: "Avenir", fontWeight: 700, fontSize: 8, letterSpacing: 0.5, color: C.voteNoFg }}>{no} NO</Text>
                  </View>
                  <View style={{ backgroundColor: C.ruleSoft, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: "Avenir", fontWeight: 700, fontSize: 8, letterSpacing: 0.5, color: C.inkSoft }}>{abs} ABS.</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 03 Integrity */}
            <View style={{ marginTop: "11mm" }}>
              <SectionLabel no="03">Integrity</SectionLabel>
              <View style={{
                borderWidth: 1, borderColor: C.rule,
                padding: "5mm", backgroundColor: C.paperAlt,
              }}>
                <View style={{
                  flexDirection: "row", gap: "4mm", alignItems: "baseline",
                  paddingBottom: "3mm",
                  borderBottomWidth: 1, borderBottomColor: C.ruleSoft,
                }}>
                  <Text style={{
                    fontFamily: "Avenir", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.9,
                    fontSize: 7.5, color: C.inkMuted, width: "20mm",
                  }}>SHA-256</Text>
                  <Text style={{
                    fontFamily: "Avenir", fontWeight: 400,
                    flex: 1, fontSize: 8.5, color: C.ink, letterSpacing: 0.1,
                  }}>{data.resolutionTextHash}</Text>
                </View>
                <Text style={{
                  fontFamily: "Avenir", fontWeight: 400,
                  marginTop: "3mm", fontSize: 7.5, color: C.inkMuted, lineHeight: 1.5,
                }}>
                  This resolution was recorded digitally in the START Berlin e.V. Cockpit. The
                  checksum above binds the resolution text, the vote and the timestamp together.
                  Any change produces a different checksum.
                </Text>
              </View>
            </View>
          </View>

          <DocFooter meta={[
            { key: "Resolution", value: data.resolutionId },
            { key: "Tenure",     value: data.legalMembershipId },
            { key: "Rendered",   value: renderedOn },
          ]} />
        </View>
      </Page>
    </Document>
  );
}
