import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const navItems = [
  { label: "Dashboard", active: true },
  { label: "Assignments", active: false },
  { label: "Grades", active: false },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-8">
          <Image
            src="/mig-logo.png"
            alt="MIG Classroom logo"
            width={54}
            height={44}
            priority
          />
          <nav className="flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <a
                key={item.label}
                href="#"
                className={
                  item.active
                    ? "border-b-2 border-accent pb-1 text-accent"
                    : "pb-1 text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Theme preview
          </h1>
          <p className="mt-1 text-muted-foreground">
            A quick look at the MIG Classroom brand colors in action.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button>Primary action</Button>
          <Button variant="destructive">Delete account</Button>
        </div>

        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>German A1 &mdash; Module 3</CardTitle>
            <CardDescription>
              Next assignment due Friday. Keep up the good work!
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Course completion
            </span>
            <span className="text-sm font-medium">72%</span>
          </CardContent>
        </Card>

        <div>
          <Badge className="bg-gold text-gold-foreground">Certified</Badge>
        </div>
      </main>
    </div>
  );
}
