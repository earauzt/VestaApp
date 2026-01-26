import { useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { 
  Paperclip, 
  Upload, 
  FileImage, 
  FilePdf, 
  File, 
  CheckCircle,
  X,
  Receipt,
  Invoice,
  Eye
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ATTACHMENT_TYPES = [
  { value: "receipt", label: "Recibo", icon: Receipt },
  { value: "invoice", label: "Factura", icon: Invoice },
  { value: "other", label: "Otro documento", icon: File }
];

export function AttachmentUploader({ open, onOpenChange, transaction, onUploadComplete }) {
  const { getAuthHeaders } = useAuth();
  const [file, setFile] = useState(null);
  const [attachmentType, setAttachmentType] = useState("receipt");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Generate preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (droppedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(droppedFile);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const getFileIcon = (fileName) => {
    const ext = fileName?.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return FileImage;
    if (ext === "pdf") return FilePdf;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!file || !transaction) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("attachment_type", attachmentType);

      const response = await axios.post(
        `${API}/transactions/${transaction.id}/attachments`,
        formData,
        { 
          headers: { 
            ...getAuthHeaders(),
            "Content-Type": "multipart/form-data"
          } 
        }
      );

      toast.success("Archivo adjuntado correctamente");
      onUploadComplete?.();
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al subir archivo");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setAttachmentType("receipt");
    onOpenChange(false);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  if (!transaction) return null;

  const FileIcon = file ? getFileIcon(file.name) : File;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip size={24} className="text-primary" />
            Adjuntar Documento
          </DialogTitle>
          <DialogDescription>
            Adjunta un recibo o factura a esta transacción
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Info */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">{transaction.description}</p>
              <p className="text-xs text-muted-foreground">{transaction.date}</p>
            </div>
            <p className="font-mono font-semibold">{formatCurrency(transaction.amount)}</p>
          </div>
          
          {/* Existing attachments */}
          {transaction.attachments?.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Archivos adjuntos:</p>
              <div className="flex flex-wrap gap-1">
                {transaction.attachments.map((att, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1">
                    <Paperclip size={12} />
                    {att.split("_").pop()}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Attachment Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de documento</label>
          <Select value={attachmentType} onValueChange={setAttachmentType}>
            <SelectTrigger data-testid="attachment-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTACHMENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <span className="flex items-center gap-2">
                    <type.icon size={16} />
                    {type.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
            file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          data-testid="file-drop-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileChange}
            data-testid="file-input"
          />
          
          {file ? (
            <div className="space-y-3">
              {preview ? (
                <div className="relative mx-auto w-32 h-32 rounded-lg overflow-hidden border">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <FileIcon size={48} className="mx-auto text-primary" />
              )}
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setPreview(null);
                }}
                className="gap-1"
              >
                <X size={14} />
                Cambiar archivo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload size={40} className="mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Arrastra un archivo aquí</p>
                <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Imágenes, PDF, Word (máx. 10MB)
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={loading || !file}
            className="gap-2"
            data-testid="upload-attachment-btn"
          >
            {loading ? (
              <>Subiendo...</>
            ) : (
              <>
                <CheckCircle size={18} />
                Adjuntar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentViewer({ attachments, transactionId }) {
  const [viewingImage, setViewingImage] = useState(null);

  if (!attachments?.length) return null;

  const isImage = (filename) => {
    const ext = filename?.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  };

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {attachments.map((att, i) => (
          <Badge 
            key={i} 
            variant="outline" 
            className="text-xs gap-1 cursor-pointer hover:bg-muted"
            onClick={() => {
              if (isImage(att)) {
                setViewingImage(`${API}/attachments/${att}`);
              } else {
                window.open(`${API}/attachments/${att}`, "_blank");
              }
            }}
          >
            <Paperclip size={12} />
            {att.includes("receipt") ? "Recibo" : att.includes("invoice") ? "Factura" : "Doc"}
            <Eye size={12} />
          </Badge>
        ))}
      </div>

      {/* Image Viewer Modal */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="sm:max-w-[800px] p-2">
          {viewingImage && (
            <img 
              src={viewingImage} 
              alt="Attachment" 
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
