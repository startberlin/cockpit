import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">Group Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          The group you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <Button asChild>
          <Link href="/groups">
            Back to Groups
          </Link>
        </Button>
      </div>
    </div>
  );
}