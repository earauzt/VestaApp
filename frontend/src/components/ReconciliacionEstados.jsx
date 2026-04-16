import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { ReconciliationHeader } from "./ReconciliationHeader";
import { MatchingPanel } from "./MatchingPanel";
import { TransactionList } from "./TransactionList";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ReconciliacionEstados() {
  const { getAuthHeaders } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedBank, setSelectedBank] = useState("auto");
  const [reconciliationData, setReconciliationData] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [confirmingMatches, setConfirmingMatches] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API}/reconciliation/history`, { headers: getAuthHeaders() });
      setHistory(response.data.statements || []);
      setShowHistory(true);
    } catch (error) {
      toast.error("Error al cargar historial");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setReconciliationData(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bank_name", selectedBank);

    try {
      const response = await axios.post(
        `${API}/reconciliation/upload-statement`,
        formData,
        {
          headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
          timeout: 120000
        }
      );

      if (process.env.NODE_ENV === 'development') console.log("Reconciliation response:", response.data);

      if (response.data.transactions && response.data.transactions.length > 0) {
        setReconciliationData(response.data);
        const newItems = response.data.transactions
          .filter(t => t.status === "new")
          .map(t => t.temp_id);
        setSelectedItems(newItems);
        toast.success(`Estado de cuenta procesado: ${response.data.summary.total} transacciones (${response.data.summary.matched} coinciden, ${response.data.summary.new} nuevas)`);
      } else {
        toast.warning("No se encontraron transacciones en el estado de cuenta. Verifica que el archivo sea legible.");
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Upload error:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Error al procesar estado de cuenta";
      toast.error(errorMsg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const toggleSelectItem = (tempId) => {
    setSelectedItems(prev =>
      prev.includes(tempId)
        ? prev.filter(id => id !== tempId)
        : [...prev, tempId]
    );
  };

  const selectAllNew = () => {
    const newItems = reconciliationData.transactions
      .filter(t => t.status === "new")
      .map(t => t.temp_id);
    setSelectedItems(newItems);
  };

  const handleConfirmReconciliation = async () => {
    if (!reconciliationData) return;
    setConfirmingMatches(true);

    try {
      const confirmedMatches = reconciliationData.transactions.map(t => {
        if (t.status === "matched") {
          return { temp_id: t.temp_id, action: "match", matched_id: t.matched_transaction_id };
        } else if (selectedItems.includes(t.temp_id)) {
          return {
            temp_id: t.temp_id,
            action: "create",
            transaction_data: {
              amount: t.amount, date: t.date, description: t.description,
              establishment: t.establishment, category: t.suggested_category || "otros",
              sri_category: t.suggested_sri_category, subcategory: t.suggested_subcategory
            },
            category: t.suggested_category,
            sri_category: t.suggested_sri_category,
            subcategory: t.suggested_subcategory
          };
        } else {
          return { temp_id: t.temp_id, action: "skip" };
        }
      });

      const response = await axios.post(
        `${API}/reconciliation/confirm-matches`,
        { statement_id: reconciliationData.statement_id, confirmed_matches: confirmedMatches },
        { headers: getAuthHeaders() }
      );

      toast.success(`Reconciliacion completada: ${response.data.created} creadas, ${response.data.matched} vinculadas`);
      setReconciliationData(null);
      setSelectedItems([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al confirmar reconciliacion");
    } finally {
      setConfirmingMatches(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReconciliationHeader
        selectedBank={selectedBank}
        onBankChange={setSelectedBank}
        onFileUpload={handleFileUpload}
        uploading={uploading}
        onLoadHistory={loadHistory}
        loadingHistory={loadingHistory}
      />

      <MatchingPanel
        showHistory={showHistory}
        history={history}
        reconciliationData={reconciliationData}
        onCloseHistory={() => setShowHistory(false)}
        formatCurrency={formatCurrency}
      />

      <AnimatePresence>
        {reconciliationData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <TransactionList
              reconciliationData={reconciliationData}
              selectedItems={selectedItems}
              onToggleSelect={toggleSelectItem}
              onSelectAllNew={selectAllNew}
              onConfirm={handleConfirmReconciliation}
              onCancel={() => setReconciliationData(null)}
              confirming={confirmingMatches}
              formatCurrency={formatCurrency}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
