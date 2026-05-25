import { Heading, Text } from "react-email";
import { COCKPIT_URL } from "@/emails/components/cockpit-url";
import { EmailCta } from "@/emails/components/email-cta";
import { EmailShell } from "@/emails/components/email-shell";

interface ProposalRow {
  userName: string;
  amount: number;
  activationDate: string;
}

interface PaymentProposalsDigestEmailProps {
  firstName: string;
  proposals: ProposalRow[];
  receivingReason?: string;
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: "bold",
  color: "#78716C",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  backgroundColor: "#F5F5F4",
  borderBottom: "2px solid #E7E5E4",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "14px",
  color: "#1C1917",
  borderBottom: "1px solid #E7E5E4",
};

const tfootTdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#1C1917",
  borderTop: "2px solid #1C1917",
};

function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export const PaymentProposalsDigestEmail = ({
  firstName,
  proposals,
  receivingReason,
}: PaymentProposalsDigestEmailProps) => {
  const count = proposals.length;
  const totalCents = proposals.reduce((sum, p) => sum + p.amount, 0);

  return (
    <EmailShell
      preview={`${count} membership payment proposal${count === 1 ? "" : "s"} awaiting review`}
      eyebrow="Finance"
      receivingReason={receivingReason}
      campaign="payment-proposals-digest"
    >
      <Heading className="mt-0 mb-[24px] p-0 font-bold text-[24px] text-[#1C1917]">
        {count} payment proposal{count === 1 ? "" : "s"} need review
      </Heading>
      <Text className="mt-0 mb-[16px] text-[15px] text-[#78716C] leading-[1.65]">
        Hi {firstName},
      </Text>
      <Text className="mt-0 mb-[24px] text-[15px] text-[#78716C] leading-[1.65]">
        The following membership payment proposal{count === 1 ? " is" : "s are"}{" "}
        open and awaiting processing in START Cockpit.
      </Text>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "24px",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Member</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Due date</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p, i) => (
            <tr key={i}>
              <td style={tdStyle}>{p.userName}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {p.activationDate}
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {formatEur(p.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={tfootTdStyle}>Total</td>
            <td style={tfootTdStyle} />
            <td style={{ ...tfootTdStyle, textAlign: "right" }}>
              {formatEur(totalCents)}
            </td>
          </tr>
        </tfoot>
      </table>

      <EmailCta
        href={`${COCKPIT_URL}/admin/payments`}
        label="Review proposals"
        campaign="payment-proposals-digest"
      />
    </EmailShell>
  );
};

PaymentProposalsDigestEmail.PreviewProps = {
  firstName: "Sönke",
  proposals: [
    { userName: "Anna Müller", amount: 4000, activationDate: "2026-05-01" },
    { userName: "Ben Schmidt", amount: 4000, activationDate: "2026-05-01" },
    { userName: "Clara Weber", amount: 4000, activationDate: "2026-04-15" },
  ],
  receivingReason:
    "You're receiving this because you're a finance administrator at START Berlin.",
} as PaymentProposalsDigestEmailProps;

export default PaymentProposalsDigestEmail;
