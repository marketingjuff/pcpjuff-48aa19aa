import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function CopEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <div className="text-lg font-semibold">{titulo}</div>
        <div className="text-sm text-muted-foreground">Em construção. Será liberada nos próximos prompts.</div>
      </CardContent>
    </Card>
  );
}
