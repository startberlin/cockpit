import {
  Document,
  type DocumentProps,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { BRAND } from "./brand";

const styles = StyleSheet.create({
  page: {
    fontFamily: BRAND.font.regular,
    fontSize: 10,
    paddingHorizontal: 40,
    paddingVertical: 48,
    color: BRAND.color.primary,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.color.border,
    paddingBottom: 12,
  },
  title: {
    fontFamily: BRAND.font.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: BRAND.color.secondary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: BRAND.font.bold,
    fontSize: 11,
    marginBottom: 8,
  },
  resolutionBox: {
    borderWidth: 1,
    borderColor: BRAND.color.border,
    padding: 12,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.color.border,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.color.border,
  },
  colName: { width: "35%" },
  colFunction: { width: "30%" },
  colVote: { width: "20%" },
  colDate: { width: "15%" },
  colHeader: {
    fontFamily: BRAND.font.bold,
    fontSize: 9,
    color: BRAND.color.secondary,
  },
  colValue: { fontSize: 9 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BRAND.color.border,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: BRAND.color.secondary,
  },
});

export interface BoardResolutionTemplateData {
  legalMembershipId: string;
  resolutionId: string;
  resolutionText: string;
  resolutionTextHash: string;
  subjectName: string;
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
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Vorstandsbeschluss</Text>
          <Text style={styles.subtitle}>{BRAND.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beschlusstext</Text>
          <View style={styles.resolutionBox}>
            <Text>{data.resolutionText}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abstimmungsergebnis</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colName, styles.colHeader]}>Name</Text>
              <Text style={[styles.colFunction, styles.colHeader]}>
                Funktion
              </Text>
              <Text style={[styles.colVote, styles.colHeader]}>Stimme</Text>
              <Text style={[styles.colDate, styles.colHeader]}>Datum</Text>
            </View>
            {data.participants.map((p) => {
              const vote = data.votes.find((v) => v.voterUserId === p.userId);
              return (
                <View key={p.userId} style={styles.tableRow}>
                  <Text style={[styles.colName, styles.colValue]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.colFunction, styles.colValue]}>
                    {p.officerFunction}
                  </Text>
                  <Text style={[styles.colVote, styles.colValue]}>
                    {vote?.value ?? "—"}
                  </Text>
                  <Text style={[styles.colDate, styles.colValue]}>
                    {vote ? formatDate(vote.castAt) : "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Tenure: {data.legalMembershipId}
          </Text>
          <Text style={styles.footerText}>Resolution: {data.resolutionId}</Text>
          <Text style={styles.footerText}>
            SHA-256: {data.resolutionTextHash.substring(0, 12)}…
          </Text>
          <Text style={styles.footerText}>
            Rendered: {formatDate(data.renderedAt)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function formatDate(date: Date) {
  return date.toISOString().substring(0, 10);
}
