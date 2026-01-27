import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Trash2, RefreshCw, Lock, Check, X, AlertCircle, BarChart3, ClipboardList, Eye, EyeOff, Loader2, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import { ReportsTab } from '@/components/admin/ReportsTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Document {
  id: string;
  title: string;
  category: string;
  file_path: string;
  created_at: string;
  chunk_count?: number;
  status?: string;
  error_reason?: string | null;
  processing_status?: string | null;
  processing_progress?: number | null;
}

// Conditional debug logging (only in development)
const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

// Guard function to ensure file is a valid Blob (prevents silent failures)
function assertIsBlobLike(x: unknown, filename: string): asserts x is Blob {
  if (!(x instanceof Blob)) {
    throw new Error(`Upload abortado: "${filename}" não é File/Blob válido.`);
  }
  if (x.size === 0) {
    throw new Error(`Upload abortado: "${filename}" está vazio (0 bytes).`);
  }
}

// Map HTTP status codes to user-friendly error messages
function getUploadErrorMessage(status: number, body: string): string {
  const errorMap: Record<number, string> = {
    400: 'Requisição inválida - verifique o formato do arquivo',
    403: 'URL expirada ou sem permissão - tente novamente',
    404: 'Bucket ou caminho não encontrado - verifique configuração',
    409: 'Conflito - arquivo já existe com mesmo nome',
    413: 'Arquivo muito grande - limite excedido',
    429: 'Muitas requisições - aguarde e tente novamente',
    500: 'Erro interno do servidor - tente novamente',
    502: 'Gateway inválido - serviço temporariamente indisponível',
    503: 'Serviço indisponível - tente novamente em alguns minutos',
  };
  return errorMap[status] || `Erro ${status}: ${body || 'Erro desconhecido'}`;
}

// Get status badge variant and label
function getStatusBadge(status?: string, errorReason?: string | null) {
  switch (status) {
    case 'uploaded':
      return { variant: 'secondary' as const, label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400' };
    case 'processing':
      return { variant: 'secondary' as const, label: 'Processando...', className: 'bg-blue-500/20 text-blue-400' };
    case 'ready':
      return { variant: 'secondary' as const, label: 'Pronto', className: 'bg-green-500/20 text-green-400' };
    case 'failed':
      return { variant: 'destructive' as const, label: 'Falhou', className: 'bg-destructive/20 text-destructive', tooltip: errorReason };
    default:
      return { variant: 'secondary' as const, label: 'Desconhecido', className: 'bg-muted text-muted-foreground' };
  }
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  
  // Track documents being processed
  const [processingDocs, setProcessingDocs] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<number | null>(null);

  const getAdminKey = useCallback(() => adminKey.trim(), [adminKey]);

  const handleAuthExpired = useCallback(() => {
    sessionStorage.removeItem('clara_admin_key');
    setIsAuthenticated(false);
    toast({
      title: 'Sessão expirada',
      description: 'Faça login novamente com a chave de administrador.',
      variant: 'destructive',
    });
  }, [toast]);

  // Check session storage for existing auth
  useEffect(() => {
    const storedKey = sessionStorage.getItem('clara_admin_key');
    const normalized = storedKey?.trim();
    if (normalized) {
      setAdminKey(normalized);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch documents when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll for processing jobs and trigger worker
  useEffect(() => {
    if (!isAuthenticated || processingDocs.size === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const pollAndProcess = async () => {
      const key = getAdminKey();
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documents/process-job`,
          {
            method: 'POST',
            headers: {
              'x-admin-key': key,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }
        );

        if (response.ok) {
          const result = await response.json();
          debugLog('[Admin] Worker result:', result);

          if (result.status === 'completed') {
            setProcessingDocs(prev => {
              const next = new Set(prev);
              next.delete(result.documentId);
              return next;
            });
            
            toast({
              title: 'Processamento concluído',
              description: `Documento processado com sucesso!`,
            });
            
            await fetchDocuments();
          } else if (result.status === 'processing') {
            await fetchDocuments();
          }
        }
      } catch (error) {
        console.error('[Admin] Polling error:', error);
      }
    };

    pollingIntervalRef.current = window.setInterval(pollAndProcess, 3000);
    pollAndProcess();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isAuthenticated, processingDocs.size, getAdminKey, toast]);

  const handleAuthenticate = async () => {
    const key = getAdminKey();
    if (!key) {
      toast({
        title: 'Chave obrigatória',
        description: 'Digite a chave de administrador.',
        variant: 'destructive',
      });
      return;
    }

    setIsAuthenticating(true);
    
    try {
      const authResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': key,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );

      const data = await authResponse
        .json()
        .catch(() => ({ valid: false, error: 'Resposta inválida do servidor', code: 'BAD_RESPONSE' }));

      if (!authResponse.ok || !data?.valid) {
        throw new Error(data?.error || 'Chave de administrador inválida.');
      }

      sessionStorage.setItem('clara_admin_key', key);
      setAdminKey(key);
      setIsAuthenticated(true);
      
      toast({
        title: 'Autenticado',
        description: 'Acesso concedido à área administrativa.',
      });
    } catch (error: any) {
      console.error('[Admin] Authentication failed:', error);
      toast({
        title: 'Acesso negado',
        description: error.message || 'Chave de administrador inválida.',
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const key = getAdminKey();
      const { data, error } = await supabase.functions.invoke('documents', {
        method: 'GET',
        headers: {
          'x-admin-key': key,
        },
      });

      if (error) {
        const msg = (error as any)?.message || '';
        if (msg.includes('401') || msg.toLowerCase().includes('not authorized')) {
          handleAuthExpired();
          return;
        }
        throw error;
      }
      
      const docs = data.documents || [];
      setDocuments(docs);
      
      // Track documents that are still processing
      const stillProcessing = new Set<string>();
      docs.forEach((doc: Document) => {
        if (doc.status === 'processing' || doc.processing_status === 'pending' || doc.processing_status === 'processing') {
          stillProcessing.add(doc.id);
        }
      });
      setProcessingDocs(stillProcessing);
      
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar documentos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Process or reprocess a document
  const handleProcessDocument = async (documentId: string) => {
    const key = getAdminKey();
    
    setProcessingDocs(prev => new Set(prev).add(documentId));
    
    toast({
      title: 'Iniciando processamento...',
      description: 'O documento será processado em background.',
    });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documents/process`,
        {
          method: 'POST',
          headers: {
            'x-admin-key': key,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ document_id: documentId }),
        }
      );

      const result = await response.json();
      debugLog('[Admin] Process result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar documento');
      }

      if (result.status === 'ready') {
        setProcessingDocs(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
        
        toast({
          title: 'Processamento concluído',
          description: result.warning || 'Documento processado com sucesso!',
        });
      } else if (result.status === 'processing') {
        toast({
          title: 'Processando em background',
          description: result.message || 'O documento está sendo processado...',
        });
      }

      await fetchDocuments();

    } catch (error: any) {
      console.error('[Admin] Process error:', error);
      
      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
      
      toast({
        title: 'Erro ao processar',
        description: error.message,
        variant: 'destructive',
      });
      
      await fetchDocuments();
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    debugLog('[Admin] handleFileUpload called with files:', files?.length);
    
    if (!files || files.length === 0) {
      debugLog('[Admin] No files provided');
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    const MAX_PDF_SIZE = 50 * 1024 * 1024;
    const MAX_OTHER_SIZE = 50 * 1024 * 1024;
    
    const validFiles = Array.from(files).filter(file => {
      debugLog(`[Admin] Checking file: ${file.name}, type: ${file.type}, size: ${Math.round(file.size / 1024 / 1024)}MB`);
      
      const isValidType = allowedTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf') || file.name.endsWith('.docx');
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const maxSize = isPDF ? MAX_PDF_SIZE : MAX_OTHER_SIZE;
      const isValidSize = file.size <= maxSize;
      
      if (!isValidType) {
        toast({
          title: `Arquivo ignorado: ${file.name}`,
          description: 'Use apenas PDF, DOCX ou TXT.',
          variant: 'destructive',
        });
        return false;
      }
      
      if (!isValidSize) {
        const fileSizeMB = Math.round(file.size / 1024 / 1024);
        const maxSizeMB = Math.round(maxSize / 1024 / 1024);
        toast({
          title: `Arquivo muito grande: ${file.name}`,
          description: isPDF 
            ? `PDFs têm limite de ${maxSizeMB}MB. Seu arquivo: ${fileSizeMB}MB.`
            : `Limite: ${maxSizeMB}MB. Seu arquivo: ${fileSizeMB}MB.`,
          variant: 'destructive',
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    const totalFiles = validFiles.length;
    let completedFiles = 0;
    let hasErrors = false;

    for (const file of validFiles) {
      try {
        const key = getAdminKey();

        if (!key) {
          handleAuthExpired();
          throw new Error('Chave de administrador ausente.');
        }

        // STEP 1: Get signed upload URL
        debugLog(`[Admin] Getting signed upload URL for ${file.name}...`);
        setUploadProgress(Math.round(((completedFiles + 0.1) / totalFiles) * 100));

        const signedUrlResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin_get_upload_url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-key': key,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              filename: file.name, 
              contentType: file.type || 'application/octet-stream' 
            }),
          }
        );

        if (!signedUrlResponse.ok) {
          const errorData = await signedUrlResponse.json();
          throw new Error(`[${signedUrlResponse.status}] ${errorData.error || 'Falha ao obter URL de upload'}`);
        }

        const signedUrlData = await signedUrlResponse.json();
        debugLog(`[Admin] Got signed URL for path: ${signedUrlData.path}`);
        setUploadProgress(Math.round(((completedFiles + 0.3) / totalFiles) * 100));

        // STEP 2: Upload file via PUT
        assertIsBlobLike(file, file.name);
        
        const uploadFile = async (fileToUpload: File, signedUrl: string): Promise<Response> => {
          const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
          const maxMb = isMobile ? 10 : 50;
          
          if (fileToUpload.size > maxMb * 1024 * 1024) {
            throw new Error(`Arquivo muito grande para este dispositivo (máx ${maxMb}MB).`);
          }

          const timeoutMs = isMobile ? 120000 : 60000;
          const isPdf = (fileToUpload.type?.includes("pdf") || fileToUpload.name?.toLowerCase().endsWith(".pdf"));
          const contentType = fileToUpload.type || (isPdf ? "application/pdf" : "application/octet-stream");
          const body = isPdf ? await fileToUpload.arrayBuffer() : fileToUpload;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const uploadRes = await fetch(signedUrl, {
              method: "PUT",
              headers: { "Content-Type": contentType },
              body,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!uploadRes.ok) {
              const msg = `Upload falhou: HTTP ${uploadRes.status}`;
              if (uploadRes.status === 409) {
                throw new Error(`${msg} (conflito: arquivo já existe)`);
              }
              if (uploadRes.status === 403) {
                throw new Error(`${msg} (permissão/policy do bucket ou URL expirada)`);
              }
              throw new Error(msg);
            }

            return uploadRes;
          } catch (err: any) {
            clearTimeout(timeoutId);
            if (err?.name === "AbortError") {
              throw new Error("Upload excedeu o tempo limite.");
            }
            throw err;
          }
        };

        const MAX_RETRIES = 3;
        const BASE_DELAY = 1000;
        
        const uploadWithRetry = async (fileToUpload: File, signedUrl: string): Promise<Response> => {
          let lastError: Error | null = null;
          
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              return await uploadFile(fileToUpload, signedUrl);
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              
              if (lastError.message.includes("muito grande") || 
                  lastError.message.includes("não autorizado") ||
                  lastError.message.includes("conflito") ||
                  lastError.message.includes("permissão")) {
                throw lastError;
              }
              
              if (attempt < MAX_RETRIES) {
                const delay = BASE_DELAY * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, delay));
              }
            }
          }
          
          throw lastError || new Error("Upload falhou após todas tentativas");
        };

        await uploadWithRetry(file, signedUrlData.signedUrl);
        setUploadProgress(Math.round(((completedFiles + 0.6) / totalFiles) * 100));

        // STEP 3: Process document
        debugLog(`[Admin] Processing document...`);
        
        const processResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documents`,
          {
            method: 'POST',
            headers: {
              'x-admin-key': key,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filePath: signedUrlData.path,
              title: file.name.replace(/\.[^/.]+$/, ''),
              category: 'manual',
              fileType: file.type || signedUrlData.contentType,
              originalName: file.name,
            }),
          }
        );
        
        setUploadProgress(Math.round(((completedFiles + 0.9) / totalFiles) * 100));

        if (!processResponse.ok) {
          if (processResponse.status === 401) {
            handleAuthExpired();
          }

          const errorData = await processResponse.json().catch(() => ({ error: 'Falha ao processar documento.' }));
          
          // Show debug info if available
          if (errorData.debug) {
            console.error('[Admin] Processing failed with debug:', errorData.debug);
          }
          
          // Cleanup uploaded file
          try {
            await supabase.storage.from('knowledge-base').remove([signedUrlData.path]);
          } catch {}
          
          throw new Error(`[${processResponse.status}] ${errorData.error || 'Erro ao processar documento'}`);
        }

        const processResult = await processResponse.json();
        debugLog(`[Admin] Processing result:`, processResult);

        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

        // Check if document is being processed in background
        if (processResult.status === 'processing') {
          setProcessingDocs(prev => new Set(prev).add(processResult.document.id));
          
          toast({
            title: 'Upload iniciado',
            description: `"${file.name}" será processado em background (${processResult.document.totalPages} páginas).`,
          });
        } else {
          toast({
            title: 'Upload concluído',
            description: `"${file.name}" processado com sucesso.${processResult?.warning ? `\n\nAviso: ${processResult.warning}` : ''}`,
          });
        }

      } catch (error: any) {
        hasErrors = true;
        console.error('[Admin] Upload/processing error:', error);
        toast({
          title: `Erro: ${file.name}`,
          description: error.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    }

    await fetchDocuments();

    if (!hasErrors && totalFiles > 1) {
      toast({
        title: 'Todos os uploads concluídos',
        description: `${totalFiles} documentos enviados.`,
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      const key = getAdminKey();
      const { error } = await supabase.functions.invoke(`documents`, {
        method: 'DELETE',
        headers: { 'x-admin-key': key },
        body: { id: documentToDelete.id },
      });

      if (error) {
        const msg = (error as any)?.message || '';
        if (msg.includes('401') || msg.toLowerCase().includes('not authorized')) {
          handleAuthExpired();
          return;
        }
        throw error;
      }

      toast({
        title: 'Documento removido',
        description: `"${documentToDelete.title}" foi removido da base de conhecimento.`,
      });

      setDocuments(docs => docs.filter(d => d.id !== documentToDelete.id));
      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(documentToDelete.id);
        return next;
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-primary/20 text-primary',
      cartilha: 'bg-green-500/20 text-green-400',
      guia: 'bg-blue-500/20 text-blue-400',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  // Auth screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Área Administrativa</CardTitle>
            <CardDescription>
              Digite a chave de administrador para acessar o gerenciamento de documentos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Chave de administrador"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
                className="bg-background/50 border-border pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button 
              onClick={handleAuthenticate}
              disabled={isAuthenticating}
              className="w-full btn-clara-primary"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Acessar
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main admin screen
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 glass-card border-b border-border/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-primary">Administração</h1>
                <p className="text-xs text-muted-foreground">Gerenciamento de documentos</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDocuments}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="documents" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Relatórios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-8">
              {/* Upload Area */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Upload de Documento
                  </CardTitle>
                  <CardDescription>
                    Arraste e solte arquivos ou clique para selecionar. Formatos aceitos: PDF, DOCX, TXT. <strong>Múltiplos arquivos permitidos.</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200
                      ${isDragOver 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }
                      ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
                    `}
                    onClick={() => !isUploading && document.getElementById('file-input')?.click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      multiple
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    
                    {isUploading ? (
                      <div className="space-y-4">
                        <RefreshCw className="w-12 h-12 text-primary mx-auto animate-spin" />
                        <p className="text-muted-foreground">Processando documento...</p>
                        <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className={`w-12 h-12 mx-auto ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="text-lg font-medium">
                            {isDragOver ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            PDF, DOCX ou TXT até 50MB cada • Múltiplos arquivos permitidos
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Documents List */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Base de Conhecimento
                  </CardTitle>
                  <CardDescription>
                    {documents.length} documento{documents.length !== 1 ? 's' : ''} na base
                    {processingDocs.size > 0 && (
                      <span className="ml-2 text-yellow-500">
                        • {processingDocs.size} em processamento
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum documento na base de conhecimento.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Faça upload de documentos para começar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc) => {
                        const statusBadge = getStatusBadge(doc.status, doc.error_reason);
                        const isProcessing = processingDocs.has(doc.id) || doc.status === 'processing';
                        const canProcess = doc.status === 'uploaded' || doc.status === 'failed';
                        
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                {isProcessing ? (
                                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                ) : (
                                  <FileText className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{doc.title}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                                  <Badge variant="secondary" className={getCategoryColor(doc.category)}>
                                    {doc.category}
                                  </Badge>
                                  
                                  {/* Status Badge */}
                                  {statusBadge.tooltip ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant={statusBadge.variant} className={statusBadge.className}>
                                          {statusBadge.label}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="text-xs">{statusBadge.tooltip}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Badge variant={statusBadge.variant} className={statusBadge.className}>
                                      {statusBadge.label}
                                    </Badge>
                                  )}
                                  
                                  <span>{formatDate(doc.created_at)}</span>
                                  {doc.chunk_count !== undefined && doc.chunk_count > 0 && (
                                    <span>{doc.chunk_count} chunks</span>
                                  )}
                                </div>
                                
                                {/* Processing progress bar */}
                                {(doc.processing_status === 'processing' || doc.processing_status === 'pending') && (
                                  <div className="mt-2">
                                    <div className="flex items-center gap-2 text-xs text-yellow-500">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Processando...</span>
                                      {doc.processing_progress !== null && (
                                        <span>{doc.processing_progress}%</span>
                                      )}
                                    </div>
                                    {doc.processing_progress !== null && (
                                      <Progress value={doc.processing_progress} className="h-1 mt-1" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Process/Reprocess Button */}
                              {canProcess && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleProcessDocument(doc.id)}
                                  disabled={isProcessing}
                                  className="gap-1"
                                >
                                  {doc.status === 'failed' ? (
                                    <>
                                      <RotateCcw className="w-4 h-4" />
                                      Reprocessar
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-4 h-4" />
                                      Processar
                                    </>
                                  )}
                                </Button>
                              )}
                              
                              {/* Delete Button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDocumentToDelete(doc);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isProcessing}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsTab />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsTab />
            </TabsContent>
          </Tabs>
        </main>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="glass-card">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover "{documentToDelete?.title}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};

export default Admin;
