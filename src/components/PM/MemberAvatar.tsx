import { PMMember } from "../../types/pm";

interface MemberAvatarProps {
  member: PMMember | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { dim: "w-5 h-5", text: "text-[9px]" },
  md: { dim: "w-7 h-7", text: "text-xs" },
  lg: { dim: "w-9 h-9", text: "text-sm" },
};

export function MemberAvatar({ member, size = "md", className = "" }: MemberAvatarProps) {
  const s = sizes[size];
  if (!member) {
    return (
      <div
        className={`${s.dim} rounded-full bg-muted flex items-center justify-center border border-border ${className}`}
        title="Unassigned"
      >
        <span className={`${s.text} text-muted-foreground font-mono`}>–</span>
      </div>
    );
  }
  return (
    <div
      className={`${s.dim} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ backgroundColor: member.avatar_color }}
      title={member.name}
    >
      <span className={`${s.text} text-white font-semibold font-mono`}>{member.initials}</span>
    </div>
  );
}
