import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-16 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30 mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <Link href="/">
        <Button variant="outline" size="sm">
          <Home className="w-4 h-4 mr-2" />
          Go home
        </Button>
      </Link>
    </div>
  );
}
