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
} from "./shared";

export interface AppendixPageData {
  letter: string;
  title: string;
  docId: string;
  legalMembershipId: string;
  renderedAt: Date;
}

export function renderAppendixPage(
  data: AppendixPageData,
): ReactElement<DocumentProps> {
  const renderedOn = data.renderedAt.toISOString().substring(0, 10);

  return (
    <Document>
      <Page size="A4" style={PAGE_STYLE}>
        <View style={WRAPPER}>
          <BrandStripe />
          <AccentSquare />
          <View style={CONTENT}>
            <DocHeader docType={`Appendix ${data.letter}`} />
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
                  Appendix {data.letter}
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
                {data.title}
              </Text>
            </View>
          </View>

          <DocFooter
            meta={[
              { key: "Document", value: data.docId },
              { key: "Tenure", value: data.legalMembershipId },
              { key: "Rendered", value: renderedOn },
            ]}
          />
        </View>
      </Page>
    </Document>
  );
}
