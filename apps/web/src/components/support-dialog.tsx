"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ContactLinks } from "@/components/contact-links";
import { getContactLinks } from "@/lib/contact";

/**
 * Shown in the app shell for every role - no backend, no ticketing, just
 * quick contact links reused from the same lib/contact.ts config the
 * landing page footer reads from. WhatsApp and email are the primary
 * actions (a real support conversation), the socials below are secondary.
 */
export function SupportDialog() {
  const [open, setOpen] = useState(false);
  const links = getContactLinks();
  const whatsapp = links.find((l) => l.key === "whatsapp");
  const email = links.find((l) => l.key === "email");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2">
          <LifeBuoy className="size-4" />
          Need help?
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Need help?</DialogTitle>
          <DialogDescription>Reach out and we&apos;ll get back to you.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {whatsapp?.href ? (
            <Button asChild>
              <a href={whatsapp.href} target="_blank" rel="noopener noreferrer">
                Message us on WhatsApp
              </a>
            </Button>
          ) : (
            <Button disabled title="WhatsApp - Coming soon">
              Message us on WhatsApp
            </Button>
          )}
          {email?.href ? (
            <Button asChild variant="outline">
              <a href={email.href} target="_blank" rel="noopener noreferrer">
                Email us
              </a>
            </Button>
          ) : (
            <Button disabled variant="outline" title="Email - Coming soon">
              Email us
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center border-t border-border pt-4">
          <ContactLinks />
        </div>
      </DialogContent>
    </Dialog>
  );
}
