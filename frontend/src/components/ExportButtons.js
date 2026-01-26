import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Export, 
  FileXls, 
  FilePdf, 
  CaretDown,
  Download,
  CalendarBlank
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function ExportButtons({ startDate, endDate, year }) {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(null);

  const downloadFile = async (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    setLoading("excel");
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const response = await axios.get(
        `${API}/export/transactions/excel?${params.toString()}`,
        { 
          headers: getAuthHeaders(),
          responseType: "blob"
        }
      );

      const filename = `transacciones_${new Date().toISOString().split("T")[0]}.xlsx`;
      await downloadFile(response.data, filename);
      toast.success("Excel exportado correctamente");
    } catch (error) {
      toast.error("Error al exportar Excel");
    } finally {
      setLoading(null);
    }
  };

  const handleExportSRIPdf = async () => {
    setLoading("pdf");
    try {
      const params = new URLSearchParams();
      if (year) params.append("year", year);
      params.append("cargas_familiares", "3"); // Default for this user

      const response = await axios.get(
        `${API}/export/sri/pdf?${params.toString()}`,
        { 
          headers: getAuthHeaders(),
          responseType: "blob"
        }
      );

      const filename = `reporte_sri_${year || new Date().getFullYear()}.pdf`;
      await downloadFile(response.data, filename);
      toast.success("Reporte SRI exportado correctamente");
    } catch (error) {
      toast.error("Error al exportar PDF");
    } finally {
      setLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="export-dropdown">
          <Export size={18} />
          Exportar
          <CaretDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Exportar datos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleExportExcel}
          disabled={loading === "excel"}
          className="gap-2 cursor-pointer"
          data-testid="export-excel-btn"
        >
          <FileXls size={18} className="text-emerald-600" />
          <div className="flex-1">
            <p className="font-medium">Excel (.xlsx)</p>
            <p className="text-xs text-muted-foreground">Todas las transacciones</p>
          </div>
          {loading === "excel" && <Download size={16} className="animate-bounce" />}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={handleExportSRIPdf}
          disabled={loading === "pdf"}
          className="gap-2 cursor-pointer"
          data-testid="export-sri-pdf-btn"
        >
          <FilePdf size={18} className="text-red-600" />
          <div className="flex-1">
            <p className="font-medium">Reporte SRI (PDF)</p>
            <p className="text-xs text-muted-foreground">Gastos personales deducibles</p>
          </div>
          {loading === "pdf" && <Download size={16} className="animate-bounce" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <CalendarBlank size={12} className="inline mr-1" />
          {startDate && endDate 
            ? `${startDate} a ${endDate}` 
            : `Año ${year || new Date().getFullYear()}`}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
