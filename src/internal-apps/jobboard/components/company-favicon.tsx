"use client";

import { Building2Icon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function CompanyFavicon({
  companyId,
  size,
}: {
  companyId: string;
  size: number;
}) {
  const [failedCompany, setFailedCompany] = useState("");
  if (failedCompany === companyId)
    return (
      <Building2Icon
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="shrink-0 text-muted-foreground"
      />
    );
  return (
    <Image
      unoptimized
      src={`/api/jobboard/companies/${encodeURIComponent(companyId)}/favicon`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      onError={() => setFailedCompany(companyId)}
    />
  );
}
