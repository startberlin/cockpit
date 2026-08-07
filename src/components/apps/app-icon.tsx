import Image from "next/image";
import { getAppIcon } from "./app-icons";

/**
 * Renders an app's icon, whichever kind it is. Shared by the launcher cards and
 * the sidebar so the image/lucide branch lives in one place.
 */
export function AppIconGlyph({
  appId,
  size = 24,
  className,
  alt = "",
}: {
  appId: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const icon = getAppIcon(appId);
  if (!icon) return null;

  if (icon.kind === "image") {
    return (
      <Image
        src={icon.src}
        alt={alt}
        width={size}
        height={size}
        className={className}
      />
    );
  }

  return <icon.icon className={className} aria-hidden />;
}
