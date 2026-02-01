"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UserDetail } from "@/db/people";
import { DetailField } from "./detail-field";

interface ContactCardProps {
  user: UserDetail;
}

export function ContactCard({ user }: ContactCardProps) {
  const hasAddress = user.street || user.city || user.zip || user.country;

  const formatAddress = () => {
    if (!hasAddress) return "";
    return [
      user.street,
      [user.zip, user.city, user.state].filter(Boolean).join(" "),
      user.country,
    ]
      .filter(Boolean)
      .join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Details</CardTitle>
        <CardDescription>How to reach this member</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <DetailField
            icon={Mail}
            label="Company Email"
            value={user.email}
            copyValue={user.email}
            copyLabel="Copy email"
          />

          <Separator />

          <DetailField
            icon={Mail}
            label="Personal Email"
            value={user.personalEmail}
            copyValue={user.personalEmail}
            copyLabel="Copy email"
          />

          <Separator />

          <DetailField
            icon={Phone}
            label="Phone"
            value={
              user.phone || (
                <span className="text-muted-foreground italic">Not provided</span>
              )
            }
            copyValue={user.phone}
            copyLabel="Copy phone"
          />

          <Separator />

          <DetailField
            icon={MapPin}
            label="Address"
            value={
              hasAddress ? (
                <div className="leading-relaxed">
                  {user.street && <div>{user.street}</div>}
                  <div>
                    {user.zip && <span>{user.zip} </span>}
                    {user.city}
                    {user.state && <span>, {user.state}</span>}
                  </div>
                  {user.country && <div>{user.country}</div>}
                </div>
              ) : (
                <span className="text-muted-foreground italic">Not provided</span>
              )
            }
            copyValue={hasAddress ? formatAddress() : undefined}
            copyLabel="Copy address"
          />
        </div>
      </CardContent>
    </Card>
  );
}
