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
  body: {
    marginBottom: 24,
    lineHeight: 1.6,
    fontSize: 11,
  },
  field: {
    marginBottom: 6,
    flexDirection: "row",
  },
  fieldLabel: {
    width: "40%",
    color: BRAND.color.secondary,
  },
  fieldValue: {
    width: "60%",
  },
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

export interface AdmissionConfirmationTemplateData {
  legalMembershipId: string;
  subjectName: string;
  activatedAt: Date;
  renderedAt: Date;
}

export function renderAdmissionConfirmationTemplate(
  data: AdmissionConfirmationTemplateData,
): ReactElement<DocumentProps> {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Aufnahmebestätigung</Text>
          <Text style={styles.subtitle}>{BRAND.name}</Text>
        </View>

        <View style={styles.body}>
          <Text>
            Der Vorstand der {BRAND.name} bestätigt die Aufnahme von{" "}
            <Text style={{ fontFamily: BRAND.font.bold }}>
              {data.subjectName}
            </Text>{" "}
            als ordentliches Mitglied des Vereins.
          </Text>
        </View>

        <View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Aufgenommen am</Text>
            <Text style={styles.fieldValue}>
              {formatDate(data.activatedAt)}
            </Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mitgliedsnummer</Text>
            <Text style={styles.fieldValue}>{data.legalMembershipId}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Tenure: {data.legalMembershipId}
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
