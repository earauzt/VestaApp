import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

export default function BandejaStats({ stats = {}, duplicatePairs = [], crossCanalCount = 0, formatCurrency }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card className="bento-card">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pending_review || 0}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </CardContent>
      </Card>
      <Card className="bento-card">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{duplicatePairs.length}</p>
          <p className="text-xs text-muted-foreground">Duplicados</p>
          {crossCanalCount > 0 && (
            <Badge className="mt-1 text-[10px] bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50">
              {crossCanalCount} cross-canal
            </Badge>
          )}
        </CardContent>
      </Card>
      <Card className="bento-card">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.approved || 0}</p>
          <p className="text-xs text-muted-foreground">Aprobados</p>
        </CardContent>
      </Card>
      <Card className="bento-card">
        <CardContent className="p-4 text-center">
          <p className="text-xl font-bold text-primary">{formatCurrency(stats.total_pending_amount)}</p>
          <p className="text-xs text-muted-foreground">Por revisar</p>
        </CardContent>
      </Card>
    </div>
  );
}
