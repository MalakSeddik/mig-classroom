import { logout } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

/**
 * A form that submits directly to a Server Action - no client-side
 * JavaScript needed for this to work.
 */
export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline">
        Log out
      </Button>
    </form>
  );
}
