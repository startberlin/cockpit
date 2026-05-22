import { Text } from "react-email";

interface EmailReminderBannerProps {
  daysOpen: number;
}

export function EmailReminderBanner({ daysOpen }: EmailReminderBannerProps) {
  const dayWord = daysOpen === 1 ? "day" : "days";
  return (
    <Text className="mt-0 mb-[24px] px-[14px] py-[10px] text-[13px] text-[#78716C] leading-[1.55] border-l-[3px] border-[#1C1917] bg-[#F5F5F4]">
      Reminder — this action has been open for {daysOpen} {dayWord}.
    </Text>
  );
}
