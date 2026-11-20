import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

/**
 * Avatar orang (frontend-guide §15.4). Dipakai di mana pun nama orang tampil. Versi kartu profil
 * yang bisa diklik (UserProfileCard) ada di F4/F7.
 */
export function UserAvatar({
  name,
  src,
  className,
  shape = "circle",
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
  shape?: "circle" | "rounded" | "square";
}) {
  const radius = shape === "circle" ? "rounded-full" : shape === "rounded" ? "rounded-lg" : "rounded-none";
  return (
    <Avatar className={cn("size-8", radius, className)}>
      {src && <AvatarImage src={src} alt={name ?? ""} className={cn("object-cover", radius)} />}
      <AvatarFallback className={cn("bg-primary/10 text-xs font-medium text-primary", radius)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
