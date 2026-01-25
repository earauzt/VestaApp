import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  Envelope, 
  Camera, 
  FileXls,
  CloudArrowUp,
  SpinnerGap,
  CheckCircle,
  Receipt
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Upload() {
  const { getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState("email");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Email state
  const [emailContent, setEmailContent] = useState("");

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailContent.trim()) {
      toast.error("Ingresa el contenido del email");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("email_content", emailContent);

      const response = await axios.post(`${API}/process/email`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
      });

      setResult(response.data);
      toast.success("Email procesado exitosamente");
      setEmailContent("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando email");
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecciona una imagen");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await axios.post(`${API}/process/receipt`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
      });

      setResult(response.data);
      toast.success("Recibo procesado exitosamente");
      setSelectedFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando recibo");
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecciona un archivo Excel");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await axios.post(`${API}/process/excel`, formData, {
        headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" }
      });

      setResult(response.data);
      toast.success("Excel procesado exitosamente");
      setSelectedFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando Excel");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const uploadTypes = [
    { 
      id: "email", 
      label: "Email", 
      icon: Envelope,
      description: "Pega el contenido de emails de consumo de tu tarjeta PacifiCard"
    },
    { 
      id: "receipt", 
      label: "Recibo/Factura", 
      icon: Camera,
      description: "Sube fotos de recibos o facturas para procesamiento OCR con AI"
    },
    { 
      id: "excel", 
      label: "Excel", 
      icon: FileXls,
      description: "Carga tu archivo Excel de planificación financiera"
    }
  ];

  return (
    <div className="space-y-6" data-testid="upload-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cargar Datos</h1>
        <p className="text-muted-foreground">
          Procesa emails, recibos y archivos Excel con AI
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg">Selecciona el tipo de datos</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                {uploadTypes.map((type) => (
                  <TabsTrigger 
                    key={type.id} 
                    value={type.id}
                    className="gap-2"
                    data-testid={`tab-${type.id}`}
                  >
                    <type.icon size={18} />
                    <span className="hidden sm:inline">{type.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Email Tab */}
              <TabsContent value="email">
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contenido del email</Label>
                    <p className="text-sm text-muted-foreground">
                      Pega aquí el contenido del email de consumo de tu tarjeta PacifiCard
                    </p>
                    <Textarea
                      placeholder="Estimado cliente, Por su seguridad, Banco del Pacífico S.A. le comunica que ha realizado una transacción..."
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      rows={8}
                      className="resize-none"
                      data-testid="email-content"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full gap-2"
                    data-testid="process-email-btn"
                  >
                    {loading ? (
                      <SpinnerGap size={18} className="animate-spin" />
                    ) : (
                      <CloudArrowUp size={18} />
                    )}
                    {loading ? "Procesando..." : "Procesar Email"}
                  </Button>
                </form>
              </TabsContent>

              {/* Receipt Tab */}
              <TabsContent value="receipt">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Foto del recibo o factura</Label>
                    <p className="text-sm text-muted-foreground">
                      La AI extraerá los datos automáticamente usando OCR
                    </p>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      dragActive 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    data-testid="receipt-dropzone"
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <CheckCircle size={48} className="mx-auto text-emerald-500" />
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                        >
                          Cambiar archivo
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Camera size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-2">
                          Arrastra una imagen aquí o
                        </p>
                        <label>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                            data-testid="receipt-input"
                          />
                          <Button variant="outline" asChild>
                            <span>Seleccionar archivo</span>
                          </Button>
                        </label>
                      </>
                    )}
                  </div>

                  <Button 
                    onClick={handleReceiptUpload}
                    disabled={loading || !selectedFile}
                    className="w-full gap-2"
                    data-testid="process-receipt-btn"
                  >
                    {loading ? (
                      <SpinnerGap size={18} className="animate-spin" />
                    ) : (
                      <CloudArrowUp size={18} />
                    )}
                    {loading ? "Procesando con AI..." : "Procesar Recibo"}
                  </Button>
                </div>
              </TabsContent>

              {/* Excel Tab */}
              <TabsContent value="excel">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Archivo Excel de planificación</Label>
                    <p className="text-sm text-muted-foreground">
                      Sube tu archivo Excel con el presupuesto familiar
                    </p>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      dragActive 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    data-testid="excel-dropzone"
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <CheckCircle size={48} className="mx-auto text-emerald-500" />
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                        >
                          Cambiar archivo
                        </Button>
                      </div>
                    ) : (
                      <>
                        <FileXls size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-2">
                          Arrastra tu archivo Excel aquí o
                        </p>
                        <label>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                            data-testid="excel-input"
                          />
                          <Button variant="outline" asChild>
                            <span>Seleccionar archivo</span>
                          </Button>
                        </label>
                      </>
                    )}
                  </div>

                  <Button 
                    onClick={handleExcelUpload}
                    disabled={loading || !selectedFile}
                    className="w-full gap-2"
                    data-testid="process-excel-btn"
                  >
                    {loading ? (
                      <SpinnerGap size={18} className="animate-spin" />
                    ) : (
                      <CloudArrowUp size={18} />
                    )}
                    {loading ? "Procesando..." : "Procesar Excel"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="bento-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt size={20} />
              Resultado del procesamiento
            </CardTitle>
            <CardDescription>
              Las transacciones procesadas aparecerán aquí
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <SpinnerGap size={48} className="animate-spin mb-4" />
                <p>Procesando con AI...</p>
                <p className="text-sm">Esto puede tomar unos segundos</p>
              </div>
            ) : result ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={24} className="text-emerald-500" />
                  <span className="font-medium">{result.message}</span>
                </div>

                {result.transaction && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(result.transaction.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descripción:</span>
                      <span>{result.transaction.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoría:</span>
                      <Badge>{result.transaction.category}</Badge>
                    </div>
                    {result.transaction.establishment && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Establecimiento:</span>
                        <span>{result.transaction.establishment}</span>
                      </div>
                    )}
                  </div>
                )}

                {result.transactions && result.transactions.length > 0 && (
                  <div className="space-y-2">
                    {result.transactions.map((t, i) => (
                      <div key={i} className="p-4 rounded-lg bg-muted space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monto:</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(t.amount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Descripción:</span>
                          <span>{t.description}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Categoría:</span>
                          <Badge>{t.category}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {result.budget && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingresos totales:</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        {formatCurrency(result.budget.total_income)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos presupuestados:</span>
                      <span className="font-mono font-semibold text-red-600">
                        {formatCurrency(result.budget.total_expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ítems del presupuesto:</span>
                      <span>{result.budget.items?.length || 0}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CloudArrowUp size={48} className="mb-4 opacity-50" />
                <p>Los resultados aparecerán aquí</p>
                <p className="text-sm">Selecciona un tipo de dato y procésalo</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="bento-card">
        <CardHeader>
          <CardTitle className="text-lg">Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {uploadTypes.map((type, i) => (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary h-fit">
                  <type.icon size={24} />
                </div>
                <div>
                  <h3 className="font-medium mb-1">{type.label}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
