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
  field: {
    marginBottom: 6,
    flexDirection: "row",
  },
  fieldLabel: {
    width: "30%",
    color: BRAND.color.secondary,
  },
  fieldValue: {
    width: "70%",
  },
  declarationRow: {
    flexDirection: "row",
    marginBottom: 5,
    alignItems: "flex-start",
  },
  checkMark: {
    fontFamily: BRAND.font.bold,
    marginRight: 6,
    color: "#000000",
  },
  declarationText: {
    flex: 1,
    lineHeight: 1.4,
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

const DECLARATION_LABELS: Record<string, string> = {
  naturalPerson: "I confirm that I am a natural person.",
  legalCapacity: "I confirm that I have full legal capacity.",
  supportsPurpose: "I support the purpose of START Berlin e.V.",
  acceptsBylaws: "I accept the bylaws of START Berlin e.V.",
  acceptsPrivacyNotice: "I have read and accept the privacy notice.",
  acknowledgesFee:
    "I acknowledge that a yearly membership fee of 40 EUR applies.",
};

export interface MembershipApplicationTemplateData {
  legalMembershipId: string;
  applicationId: string;
  subjectName: string;
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

export function renderMembershipApplicationTemplate(
  data: MembershipApplicationTemplateData,
): ReactElement<DocumentProps> {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Aufnahmeantrag</Text>
          <Text style={styles.subtitle}>{BRAND.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Angaben zur Person</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <Text style={styles.fieldValue}>{data.subjectName}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Straße</Text>
            <Text style={styles.fieldValue}>{data.address.street}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PLZ / Ort</Text>
            <Text style={styles.fieldValue}>
              {data.address.zip} {data.address.city}
            </Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Bundesland</Text>
            <Text style={styles.fieldValue}>{data.address.state}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Land</Text>
            <Text style={styles.fieldValue}>{data.address.country}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Erklärungen</Text>
          {Object.entries(data.declarations).map(([key, value]) => (
            <View key={key} style={styles.declarationRow}>
              <Text style={styles.checkMark}>{value ? "✓" : "✗"}</Text>
              <Text style={styles.declarationText}>
                {DECLARATION_LABELS[key] ?? key}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Eingereicht am</Text>
            <Text style={styles.fieldValue}>
              {formatDate(data.submittedAt)}
            </Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Antragsversion</Text>
            <Text style={styles.fieldValue}>{data.applicationVersion}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Gebührenversion</Text>
            <Text style={styles.fieldValue}>{data.feeTextVersion}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Antrag: {data.applicationId}</Text>
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
