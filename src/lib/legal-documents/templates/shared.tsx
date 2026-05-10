import { Image, Text, View } from "@react-pdf/renderer";
import { C, LOGO, ORG_LINES } from "./brand";

export function BrandStripe() {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "6mm",
        height: "297mm",
        backgroundColor: C.brand,
      }}
    />
  );
}

export function AccentSquare() {
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

export function DocHeader({ docType }: { docType: string }) {
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

export function AccentRule() {
  return (
    <View style={{ marginTop: "10mm", height: 2, flexDirection: "row" }}>
      <View style={{ width: "28%", backgroundColor: C.brand }} />
      <View style={{ width: "8%", backgroundColor: C.brandAccent }} />
      <View style={{ flex: 1, backgroundColor: C.rule }} />
    </View>
  );
}

export function DocTitle({
  kicker,
  children,
}: {
  kicker?: string;
  children: string;
}) {
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

export function Lead({ children }: { children: string }) {
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

export function SectionLabel({
  no,
  children,
}: {
  no?: string;
  children: string;
}) {
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

export function FieldRow({
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

export function OrgBlock() {
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
      {ORG_LINES.map((line, i) => (
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

export function DocFooter({
  meta,
}: {
  meta: Array<{ key: string; value: string }>;
}) {
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

export function ESig({ text }: { text: string }) {
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

export function VoteChip({ vote }: { vote: string }) {
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
