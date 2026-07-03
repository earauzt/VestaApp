import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

export default function BandejaStats({ stats = {}, duplicatePairs = [], crossCanalCount = 0, formatCurrency, onDuplicatesClick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Card className="bento-card">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pending_review || 0}</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(stats.total_pending_amount)}</p>
          <p className="text-xs text-muted-foreground">por revisar</p>
        </CardContent>
      </Card>
      <Card
        className={`bento-card ${onDuplicatesClick ? "cursor-pointer hover:bg-slate-50 transition-colors" : ""}`}
        onClick={onDuplicatesClick}
        role={onDuplicatesClick ? "button" : undefined}
        tabIndex={onDuplicatesClick ? 0 : undefined}
        onKeyDown={onDuplicatesClick ? (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDuplicatesClick(); }
        } : undefined}
        data-testid="duplicados-stat-card"
      >
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{duplicatePairs.length}</p>
          <p className="text-xs text-muted-foreground">Duplicados</p>
          {crossCanalCount > 0 && (
            <Badge className="mt-1 text-[10px] bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-50">
              {crossCanalCount} detectado{crossCanalCount !== 1 ? "s" : ""} en 2 fuentes
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
    </div>
  );
}
