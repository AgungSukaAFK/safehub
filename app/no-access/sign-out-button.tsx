"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutEverywhereLocal } from "@/lib/signout";

export function NoAccessSignOut() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOutEverywhereLocal();
      }}
    >
      <LogOut /> {pending ? "Keluar..." : "Keluar dan masuk dengan akun lain"}
    </Button>
  );
}
