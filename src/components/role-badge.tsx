import type { Role } from "@/lib/roles/types";

export function RoleBadge({ role, className = "" }: { role: Role; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium ${className}`}
      style={{
        color: role.color,
        borderColor: `${role.color}66`,
        background: `${role.color}22`,
      }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: role.color }} aria-hidden />
      {role.name}
    </span>
  );
}
