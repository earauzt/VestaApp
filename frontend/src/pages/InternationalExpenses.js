import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Airplane,
  CreditCard,
  Globe,
  MapPin,
  Warning,
  ArrowDown
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InternationalExpenses() {
  const { getAuthHeaders } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [paymentSourceTx, setPaymentSourceTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("international");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [intlRes, paymentRes] = await Promise.all([
        axios.get(`${API}/transactions/international`, { headers: getAuthHeaders() }),
        axios.get(`${API}/transactions/by-payment-source?payment_source=internacional`, { headers: getAuthHeaders() })
      ]);
      setTransactions(intlRes.data.transactions || []);
      setPaymentSourceTx(paymentRes.data.transactions || []);
    } catch (error) {
      toast.error("Error al cargar gastos internacionales");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const totalInternational = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalForeignCard = paymentSourceTx.reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Cargando gastos internacionales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="international-expenses-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Globe size={32} className="text-amber-500" weight="duotone" />
          Gastos Internacionales
        </h1>
        <p className="text-muted-foreground">
          Gastos en el extranjero y pagos con tarjeta internacional
        </p>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Warning size={24} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">
                Gastos No Deducibles para SRI Ecuador
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Los gastos realizados en el extranjero y pagados con tarjeta internacional 
                no son deducibles según la Ley de Régimen Tributario Interno del Ecuador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bento-card border-amber-200 dark:border-amber-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Gastos Internacionales</p>
                  <p className="stat-number text-amber-600">
                    {formatCurrency(totalInternational)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {transactions.length} transacciones
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30">
                  <Airplane size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bento-card border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pagos con Tarjeta Extranjera</p>
                  <p className="stat-number text-blue-600">
                    {formatCurrency(totalForeignCard)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {paymentSourceTx.length} transacciones
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                  <CreditCard size={24} weight="duotone" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Transactions Tabs */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg">Detalle de Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="international" className="gap-2">
                <Airplane size={18} />
                Viajes Internacionales ({transactions.length})
              </TabsTrigger>
              <TabsTrigger value="foreign-card" className="gap-2">
                <CreditCard size={18} />
                Tarjeta Extranjera ({paymentSourceTx.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="international">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Airplane size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No hay gastos internacionales registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((t, index) => (
                    <TransactionRow key={t.id || index} transaction={t} formatCurrency={formatCurrency} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="foreign-card">
              {paymentSourceTx.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No hay pagos con tarjeta extranjera registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentSourceTx.map((t, index) => (
                    <TransactionRow key={t.id || index} transaction={t} formatCurrency={formatCurrency} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionRow({ transaction, formatCurrency }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30">
          <ArrowDown size={20} weight="bold" />
        </div>
        <div>
          <p className="font-medium">{transaction.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {transaction.date ? format(new Date(transaction.date), "d MMM yyyy", { locale: es }) : ""}
            </span>
            {transaction.country && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin size={14} />
                {transaction.country}
              </span>
            )}
            {transaction.establishment && (
              <span className="text-sm text-muted-foreground">
                • {transaction.establishment}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
            No deducible
          </Badge>
          {transaction.payment_source === "internacional" && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
              Tarjeta extranjera
            </Badge>
          )}
        </div>
        <span className="font-mono font-semibold text-amber-600">
          -{formatCurrency(transaction.amount)}
        </span>
      </div>
    </motion.div>
  );
}
