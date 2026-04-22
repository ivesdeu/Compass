import type { CrmPillColorKey } from '@/lib/crm-customers-schema';

const colorMap: Record<
  CrmPillColorKey,
  { bg: string; text: string; dot: string }
> = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  red: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  green: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-400' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', dot: 'bg-pink-400' },
};

export type SelectPillProps = {
  label: string;
  color: CrmPillColorKey;
};

export function SelectPill({ label, color }: SelectPillProps) {
  const { bg, text, dot } = colorMap[color] ?? colorMap.gray;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
