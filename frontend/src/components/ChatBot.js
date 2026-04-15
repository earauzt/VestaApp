import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { toast } from "sonner";
import { 
  ChatCircleDots, 
  PaperPlaneTilt, 
  X, 
  SpinnerGap,
  Robot,
  User
} from "@phosphor-icons/react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ChatBot() {
  const { getAuthHeaders, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      setMessages([{
        role: "assistant",
        content: `¡Hola ${user?.name?.split(" ")[0] || ""}! 👋\n\nSoy tu asistente financiero. Puedo ayudarte con:\n\n• Analizar tus gastos del mes\n• Comparar con tu presupuesto\n• Dar consejos de ahorro\n• Explicar temas tributarios del SRI\n\n¿En qué puedo ayudarte hoy?`
      }]);
    }
  }, [isOpen, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post(
        `${API}/chat`,
        { message: userMessage, session_id: sessionId },
        { headers: getAuthHeaders() }
      );

      setSessionId(response.data.session_id);
      setMessages(prev => [...prev, { role: "assistant", content: response.data.response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo." 
      }]);
      toast.error("Error en el chat");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    "¿Cómo van mis gastos este mes?",
    "¿Estoy dentro del presupuesto?",
    "¿Cuánto he gastado en comida?",
    "¿Consejos para ahorrar?"
  ];

  return (
    <>
      {/* Chat Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="chat-toggle"
      >
        {isOpen ? <X size={24} /> : <ChatCircleDots size={28} weight="fill" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] h-[500px] max-h-[calc(100vh-150px)]"
            data-testid="chat-window"
          >
            <Card className="flex flex-col h-full shadow-2xl border-2">
              {/* Header */}
              <div className="p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <Robot size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Asistente Financiero</h3>
                    <p className="text-xs opacity-80">Powered by OpenAI</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
                {messages.map((msg, index) => (
                  <motion.div
                    key={`${msg.role}-${msg.timestamp || index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted border"
                    }`}>
                      {msg.role === "user" ? <User size={16} /> : <Robot size={16} />}
                    </div>
                    <div className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border rounded-bl-md"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
                
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center">
                      <Robot size={16} />
                    </div>
                    <div className="bg-card border p-3 rounded-2xl rounded-bl-md">
                      <SpinnerGap size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions */}
              {messages.length <= 1 && (
                <div className="px-4 py-2 border-t bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Preguntas rápidas:</p>
                  <div className="flex flex-wrap gap-1">
                    {quickQuestions.map((q, i) => (
                      <button
                        key={q}
                        onClick={() => { setMessage(q); }}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t bg-card rounded-b-lg">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1"
                    disabled={loading}
                    data-testid="chat-input"
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={!message.trim() || loading}
                    size="icon"
                    data-testid="chat-send"
                  >
                    <PaperPlaneTilt size={20} weight="fill" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
