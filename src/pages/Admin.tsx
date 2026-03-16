import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Trash2, RefreshCw, Lock, AlertCircle, BarChart3, ClipboardList, Loader2, Play, RotateCcw, FileWarning, Activity, MessageSquareWarning, Settings2, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { extractPdfTextClient, extractTxtContent, isPdfFile, isTxtFile, isDocxFile, splitTextIntoBatches, calculatePayloadMetrics } from '@/utils/extractPdfText';
import { validateTextQuality, type TextQualityResult } from '@/utils/textQualityValidator';
import { loadPdfDocument, renderPagesAsImages, getPageBatches } from '@/utils/renderPdfPages';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import {
  getAdminRequestHeaders,
  getSupabaseFunctionBaseUrl,
  isCurrentUserAdmin,
} from '@/components/admin/adminSession';
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
  updated_at: string;
  chunk_count?: number;
  status?: string;
  error_reason?: string | null;
  processing_status?: string | null;
  processing_progress?: number | null;
  tags?: string[] | null;
  version_label?: string | null;
  effective_date?: string | null;
  supersedes_document_id?: string | null;
}

const AnalyticsTab = lazy(() =>
  import('@/components/admin/AnalyticsTab').then((module) => ({
    default: module.AnalyticsTab,
  }))
);

const ReportsTab = lazy(() =>
  import('@/components/admin/ReportsTab').then((module) => ({
    default: module.ReportsTab,
  }))
);

const ProcessingStatsTab = lazy(() =>
  import('@/components/admin/ProcessingStatsTab').then((module) => ({
    default: module.ProcessingStatsTab,
  }))
);

const ChatMetricsDashboard = lazy(() =>
  import('@/components/admin/ChatMetricsDashboard').then((module) => ({
    default: module.ChatMetricsDashboard,
  }))
);

const FeedbackTab = lazy(() =>
  import('@/components/admin/FeedbackTab').then((module) => ({
    default: module.FeedbackTab,
  }))
);

const DocumentEditorModal = lazy(() =>
  import('@/components/admin/DocumentEditorModal').then((module) => ({
    default: module.DocumentEditorModal,
  }))
);

const DocumentFilters = lazy(() =>
  import('@/components/admin/DocumentFilters').then((module) => ({
    default: module.DocumentFilters,
  }))
);

const TextQualityDialog = lazy(() =>
  import('@/components/admin/TextQualityDialog').then((module) => ({
    default: module.TextQualityDialog,
  }))
);

// Conditional debug logging (only in development)
const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === "string") return msg;
  }
  return "Erro desconhecido";
}



// Get status badge variant and label
function getStatusBadge(status?: string, errorReason?: string | null) {
  switch (status) {
    case 'uploaded':
      return { variant: 'secondary' as const, label: 'Aguardando', className: 'bg-yellow-500/20 text-yellow-400' };
    case 'ingesting':
      return { variant: 'secondary' as const, label: 'Ingerindo...', className: 'bg-blue-500/20 text-blue-400' };
    case 'processing':
      return { variant: 'secondary' as const, label: 'Processando...', className: 'bg-blue-500/20 text-blue-400' };
    case 'ready':
      return { variant: 'secondary' as const, label: 'Pronto', className: 'bg-green-500/20 text-green-400' };
    case 'chunks_ok_embed_pending':
      return { variant: 'secondary' as const, label: 'Embeddings Pendentes', className: 'bg-orange-500/20 text-orange-400', tooltip: 'Texto processado, embeddings falharam por limite de API' };
    case 'failed':
      return { variant: 'destructive' as const, label: 'Falhou', className: 'bg-destructive/20 text-destructive', tooltip: errorReason };
    default:
      return { variant: 'secondary' as const, label: 'Desconhecido', className: 'bg-muted text-muted-foreground' };
  }
}

// Check if a document is stuck (processing for more than 5 minutes with no progress)
function isDocumentStuck(doc: Document): boolean {
  if (!['processing', 'ingesting', 'chunks_ok_embed_pending'].includes(doc.status || '')) {
    return false;
  }

  // Consider stuck if processing for more than 5 minutes
  const updatedAt = new Date(doc.updated_at || doc.created_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);

  return diffMinutes > 5;
}

function AdminSectionFallback() {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, signOut } = useAuth();

  const [adminStatus, setAdminStatus] = useState<'signed_out' | 'checking' | 'forbidden' | 'granted'>('checking');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionPhase, setExtractionPhase] = useState<'idle' | 'extracting' | 'uploading' | 'processing' | 'batching'>('idle');
  const [payloadMetrics, setPayloadMetrics] = useState<{ charCount: number; estimatedMB: number; warning: string | null } | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  // OCR Dialog state
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  // Text Quality Dialog state
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [qualityResult, setQualityResult] = useState<TextQualityResult | null>(null);
  const [qualityFile, setQualityFile] = useState<File | null>(null);
  const [qualityExtractionResult, setQualityExtractionResult] = useState<{
    fullText: string;
    metadata: Record<string, unknown>;
  } | null>(null);

  // Track documents being processed
  const [processingDocs, setProcessingDocs] = useState<Set<string>>(new Set());

  // Document editor modal state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<Document | null>(null);

  // Document filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const pollingIntervalRef = useRef<number | null>(null);

  // Computed: available tags from all documents
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach(doc => {
      doc.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [documents]);

  // Computed: filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Filter by search query
      if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Filter by tags
      if (selectedTags.length > 0) {
        const docTags = doc.tags || [];
        if (!selectedTags.some(tag => docTags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }, [documents, searchQuery, selectedTags]);

  const isAuthenticated = adminStatus === 'granted';

  const authFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    const headers = await getAdminRequestHeaders(init.headers);
    return fetch(input, {
      ...init,
      headers,
    });
  }, []);

  const handleAuthExpired = useCallback(() => {
    setDocuments([]);
    setProcessingDocs(new Set());
    setAdminStatus('signed_out');
    void signOut().catch((error) => {
      console.error('[Admin] Sign-out after auth expiry failed:', error);
    });
    toast({
      title: 'Sessão expirada',
      description: 'Entre novamente com sua conta Google para acessar o admin.',
      variant: 'destructive',
    });
  }, [signOut, toast]);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(`${getSupabaseFunctionBaseUrl()}/documents`, {
        method: 'GET',
      });

      const payload = await response.json().catch(() => ({ error: 'Resposta inválida do servidor' }));

      if (!response.ok) {
        const msg = getErrorMessage((payload as Record<string, unknown>).error);
        if (response.status === 401 || response.status === 403) {
          handleAuthExpired();
          return;
        }
        throw new Error(msg);
      }

      const docs = Array.isArray((payload as Record<string, unknown>).documents)
        ? ((payload as Record<string, unknown>).documents as Document[])
        : [];
      setDocuments(docs);

      // Track documents that are still processing
      const stillProcessing = new Set<string>();
      docs.forEach((doc: Document) => {
        if (doc.status === 'processing' || doc.processing_status === 'pending' || doc.processing_status === 'processing') {
          stillProcessing.add(doc.id);
        }
      });
      setProcessingDocs(stillProcessing);

    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar documentos',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, handleAuthExpired, toast]);

  useEffect(() => {
    let isMounted = true;

    const checkAdminAccess = async () => {
      if (authLoading) return;

      if (!user) {
        if (isMounted) {
          setAdminStatus('signed_out');
        }
        return;
      }

      if (isMounted) {
        setAdminStatus('checking');
      }

      try {
        const hasAccess = await isCurrentUserAdmin();
        if (!isMounted) return;
        setAdminStatus(hasAccess ? 'granted' : 'forbidden');
      } catch (error) {
        console.error('[Admin] Admin role check failed:', error);
        if (!isMounted) return;
        setAdminStatus('forbidden');
        toast({
          title: 'Não foi possível validar o acesso',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    };

    checkAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [authLoading, toast, user]);

  // Fetch documents when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [fetchDocuments, isAuthenticated]);

  // Realtime subscription for document status updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('document-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          debugLog('[Admin] Realtime update received:', payload.new);

          // Update the specific document in state
          setDocuments(prev => prev.map(doc =>
            doc.id === payload.new.id
              ? {
                ...doc,
                status: payload.new.status as string,
                error_reason: payload.new.error_reason as string | null,
                chunk_count: payload.new.chunk_count as number | undefined,
                updated_at: payload.new.updated_at as string
              }
              : doc
          ));

          // If document finished processing, remove from processingDocs
          if (payload.new.status === 'ready' || payload.new.status === 'failed') {
            setProcessingDocs(prev => {
              const next = new Set(prev);
              next.delete(payload.new.id as string);
              return next;
            });

            // Show toast notification
            if (payload.new.status === 'ready') {
              toast({
                title: 'Documento processado',
                description: `"${payload.new.title}" está pronto para consulta.`,
              });
            } else if (payload.new.status === 'failed') {
              toast({
                title: 'Processamento falhou',
                description: payload.new.error_reason || 'Erro desconhecido',
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe((status) => {
        debugLog('[Admin] Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, toast]);

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
      try {
        const response = await authFetch(
          `${getSupabaseFunctionBaseUrl()}/documents/process-job`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          },
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
  }, [authFetch, fetchDocuments, isAuthenticated, processingDocs.size, toast]);

  // Process or reprocess a document
  const handleProcessDocument = async (documentId: string) => {
    setProcessingDocs(prev => new Set(prev).add(documentId));

    toast({
      title: 'Iniciando processamento...',
      description: 'O documento será processado em background.',
    });

    try {
      const response = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/documents/process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ document_id: documentId }),
        },
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

    } catch (error: unknown) {
      console.error('[Admin] Process error:', error);

      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });

      toast({
        title: 'Erro ao processar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });

      await fetchDocuments();
    }
  };

  // Retry processing for stuck documents (uses ingest-finish to reprocess from existing text)
  const handleRetryProcessing = async (documentId: string, documentTitle: string) => {
    setProcessingDocs(prev => new Set(prev).add(documentId));

    toast({
      title: 'Reprocessando...',
      description: `Retomando processamento de "${documentTitle}"`,
    });

    try {
      const response = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/documents/ingest-finish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId }),
        },
      );

      const result = await response.json();
      debugLog('[Admin] Retry result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao reprocessar documento');
      }

      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });

      toast({
        title: 'Reprocessamento concluído',
        description: result.warning || `"${documentTitle}" processado com sucesso!`,
      });

      await fetchDocuments();

    } catch (error: unknown) {
      console.error('[Admin] Retry error:', error);

      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });

      toast({
        title: 'Erro ao reprocessar',
        description: getErrorMessage(error),
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
      const isPDF = isPdfFile(file);
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
    setExtractionPhase('idle');
    setPayloadMetrics(null);

    const totalFiles = validFiles.length;
    let completedFiles = 0;
    let hasErrors = false;

    for (const file of validFiles) {
      try {
        let fullText: string = '';
        let metadata: { originalFilename: string; totalPages: number; extractedAt: string; extractionMethod: string } | null = null;

        // ============================================
        // STEP 1: CLIENT-SIDE TEXT EXTRACTION
        // ============================================
        if (isPdfFile(file)) {
          setExtractionPhase('extracting');
          debugLog(`[Admin] Extracting PDF text client-side: ${file.name}`);

          try {
            const result = await extractPdfTextClient(file, (progress) => {
              setUploadProgress(Math.round(((completedFiles + (progress / 100) * 0.4) / totalFiles) * 100));
            });

            debugLog(`[Admin] PDF extraction result: ${result.totalPages} pages, ${result.avgCharsPerPage.toFixed(0)} avg chars/page, needsOcr: ${result.needsOcr}, isHybrid: ${result.isHybrid}`);
            debugLog(`[Admin] Metrics: ${result.metrics.totalChars} chars, ${result.metrics.estimatedMB}MB, ${result.metrics.emptyPages} empty, ${result.metrics.validTextPages} valid`);
            debugLog(`[Admin] Pages needing OCR: [${result.pagesNeedingOcr.slice(0, 10).join(', ')}${result.pagesNeedingOcr.length > 10 ? '...' : ''}] (${result.pagesNeedingOcr.length} total)`);

            // Calculate and display payload metrics
            const metrics = calculatePayloadMetrics(result.fullText);
            setPayloadMetrics(metrics);

            if (metrics.warning) {
              toast({
                title: 'Aviso de tamanho',
                description: metrics.warning,
                variant: metrics.estimatedMB > 10 ? 'destructive' : 'default',
              });
            }

            if (result.needsOcr) {
              // PDF is scanned/image-based, show OCR dialog
              setOcrFile(file);
              setShowOcrDialog(true);
              setIsUploading(false);
              setUploadProgress(0);
              setExtractionPhase('idle');
              setPayloadMetrics(null);
              return; // Stop here, wait for user decision
            }

            // NEW: Validate text quality to detect gibberish/encoding issues
            const qualityValidation = validateTextQuality(result.fullText, {
              expectedLanguage: 'pt-BR',
              minConfidence: 0.6
            });

            debugLog(`[Admin] Quality validation:`, {
              isValid: qualityValidation.isValid,
              confidence: qualityValidation.confidence,
              recommendation: qualityValidation.recommendation,
              issues: qualityValidation.issues
            });

            if (!qualityValidation.isValid) {
              // Text quality is poor - show quality dialog
              const extractionMetadata = {
                originalFilename: file.name,
                totalPages: result.totalPages,
                extractedAt: new Date().toISOString(),
                extractionMethod: 'pdfjs-client'
              };

              setQualityResult(qualityValidation);
              setQualityFile(file);
              setQualityExtractionResult({ fullText: result.fullText, metadata: extractionMetadata });
              setShowQualityDialog(true);
              setIsUploading(false);
              setUploadProgress(0);
              setExtractionPhase('idle');
              setPayloadMetrics(null);
              return; // Stop here, wait for user decision
            }

            fullText = result.fullText;
            metadata = {
              originalFilename: file.name,
              totalPages: result.totalPages,
              extractedAt: new Date().toISOString(),
              extractionMethod: 'pdfjs-client'
            };
          } catch (extractError) {
            console.error('[Admin] PDF extraction error:', extractError);
            throw new Error(`Erro ao extrair texto do PDF: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
          }
        } else if (isTxtFile(file)) {
          setExtractionPhase('extracting');
          debugLog(`[Admin] Reading TXT file: ${file.name}`);
          fullText = await extractTxtContent(file);
          metadata = {
            originalFilename: file.name,
            totalPages: 1,
            extractedAt: new Date().toISOString(),
            extractionMethod: 'txt-client'
          };
        } else if (isDocxFile(file)) {
          // DOCX still needs backend processing (mammoth)
          setExtractionPhase('uploading');
          debugLog(`[Admin] DOCX file - using backend extraction: ${file.name}`);

          // Use old flow for DOCX
          const signedUrlResponse = await authFetch(
            `${getSupabaseFunctionBaseUrl()}/admin_get_upload_url`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filename: file.name,
                contentType: file.type || 'application/octet-stream'
              }),
            },
          );

          if (!signedUrlResponse.ok) {
            const errorData = await signedUrlResponse.json();
            throw new Error(`[${signedUrlResponse.status}] ${errorData.error || 'Falha ao obter URL de upload'}`);
          }

          const signedUrlData = await signedUrlResponse.json();

          // Upload file
          await uploadFileWithRetry(file, signedUrlData.signedUrl);
          setUploadProgress(Math.round(((completedFiles + 0.6) / totalFiles) * 100));

          setExtractionPhase('processing');

          // Process via backend (old flow)
          const processResponse = await authFetch(
            `${getSupabaseFunctionBaseUrl()}/documents`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                filePath: signedUrlData.path,
                title: file.name.replace(/\.[^/.]+$/, ''),
                category: 'manual',
                fileType: file.type || signedUrlData.contentType,
                originalName: file.name,
              }),
            },
          );

          if (!processResponse.ok) {
            const errorData = await processResponse.json().catch(() => ({ error: 'Falha ao processar documento.' }));
            throw new Error(`[${processResponse.status}] ${errorData.error || 'Erro ao processar documento'}`);
          }

          const processResult = await processResponse.json();
          debugLog(`[Admin] DOCX processing result:`, processResult);

          completedFiles++;
          setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

          toast({
            title: 'Upload concluído',
            description: `"${file.name}" processado com sucesso.${processResult?.warning ? `\n\nAviso: ${processResult.warning}` : ''}`,
          });

          continue; // Skip to next file
        } else {
          throw new Error('Tipo de arquivo não suportado');
        }

        // ============================================
        // STEP 2: UPLOAD PDF TO STORAGE (optional backup)
        // ============================================
        setExtractionPhase('uploading');
        debugLog(`[Admin] Uploading file to storage: ${file.name}`);
        setUploadProgress(Math.round(((completedFiles + 0.5) / totalFiles) * 100));

        const signedUrlResponse = await authFetch(
          `${getSupabaseFunctionBaseUrl()}/admin_get_upload_url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || 'application/octet-stream'
            }),
          },
        );

        if (!signedUrlResponse.ok) {
          const errorData = await signedUrlResponse.json();
          throw new Error(`[${signedUrlResponse.status}] ${errorData.error || 'Falha ao obter URL de upload'}`);
        }

        const signedUrlData = await signedUrlResponse.json();
        debugLog(`[Admin] Got signed URL for path: ${signedUrlData.path}`);

        await uploadFileWithRetry(file, signedUrlData.signedUrl);
        setUploadProgress(Math.round(((completedFiles + 0.7) / totalFiles) * 100));

        // ============================================
        // STEP 3: SEND EXTRACTED TEXT TO BACKEND
        // Use batch ingestion for large texts (> 1MB)
        // ============================================
        setExtractionPhase('processing');
        const textBytes = new TextEncoder().encode(fullText).length;
        const textMB = textBytes / (1024 * 1024);
        debugLog(`[Admin] Text payload: ${fullText.length} chars, ${textMB.toFixed(2)}MB`);

        const BATCH_THRESHOLD_MB = 1; // Use batching above 1MB

        if (textMB > BATCH_THRESHOLD_MB) {
          // Large text - use batch ingestion
          setExtractionPhase('batching');
          debugLog(`[Admin] Using batch ingestion for large text (${textMB.toFixed(2)}MB)`);

          const batches = splitTextIntoBatches(fullText, 400_000); // ~400KB per batch
          debugLog(`[Admin] Split into ${batches.length} batches`);

          // Step 1: Start ingestion
          const startResponse = await authFetch(
            `${getSupabaseFunctionBaseUrl()}/documents/ingest-start`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: file.name.replace(/\.[^/.]+$/, ''),
                category: 'manual',
                filePath: signedUrlData.path,
                metadata
              }),
            },
          );

          if (!startResponse.ok) {
            const errorData = await startResponse.json().catch(() => ({ error: 'Falha ao iniciar ingestão' }));
            throw new Error(errorData.error);
          }

          const startResult = await startResponse.json();
          const documentId = startResult.documentId;
          debugLog(`[Admin] Ingestion started, documentId: ${documentId}`);

          // Step 2: Send batches
          for (let i = 0; i < batches.length; i++) {
            const batchProgress = 0.7 + (i / batches.length) * 0.2; // 70% to 90%
            setUploadProgress(Math.round(((completedFiles + batchProgress) / totalFiles) * 100));

            const batchResponse = await authFetch(
              `${getSupabaseFunctionBaseUrl()}/documents/ingest-batch`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  documentId,
                  batchText: batches[i],
                  batchIndex: i + 1,
                  totalBatches: batches.length
                }),
              },
            );

            if (!batchResponse.ok) {
              const errorData = await batchResponse.json().catch(() => ({ error: 'Falha ao enviar batch' }));
              throw new Error(`Batch ${i + 1}/${batches.length}: ${errorData.error}`);
            }

            debugLog(`[Admin] Batch ${i + 1}/${batches.length} sent`);
          }

          // Step 3: Finish ingestion
          setUploadProgress(Math.round(((completedFiles + 0.95) / totalFiles) * 100));

          const finishResponse = await authFetch(
            `${getSupabaseFunctionBaseUrl()}/documents/ingest-finish`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ documentId }),
            },
          );

          if (!finishResponse.ok) {
            if (finishResponse.status === 401) {
              handleAuthExpired();
            }
            const errorData = await finishResponse.json().catch(() => ({ error: 'Falha ao finalizar ingestão' }));
            throw new Error(errorData.error);
          }

          const ingestResult = await finishResponse.json();
          debugLog(`[Admin] Batch ingestion completed:`, ingestResult);

          completedFiles++;
          setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

          toast({
            title: 'Upload concluído',
            description: `"${file.name}" processado em ${batches.length} partes.${ingestResult?.warning ? `\n\nAviso: ${ingestResult.warning}` : ''}`,
          });

        } else {
          // Small text - use single request (original flow)
          debugLog(`[Admin] Sending pre-extracted text to backend: ${fullText.length} chars`);

          const ingestResponse = await authFetch(
            `${getSupabaseFunctionBaseUrl()}/documents/ingest-text`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: file.name.replace(/\.[^/.]+$/, ''),
                category: 'manual',
                fullText,
                filePath: signedUrlData.path,
                metadata
              }),
            },
          );

          setUploadProgress(Math.round(((completedFiles + 0.95) / totalFiles) * 100));

          if (!ingestResponse.ok) {
            if (ingestResponse.status === 401) {
              handleAuthExpired();
            }

            const errorData = await ingestResponse.json().catch(() => ({ error: 'Falha ao processar documento.' }));

            if (errorData.debug) {
              console.error('[Admin] Ingestion failed with debug:', errorData.debug);
            }

            // Cleanup uploaded file
            try {
              await supabase.storage.from('knowledge-base').remove([signedUrlData.path]);
            } catch {
              // Best-effort cleanup after an ingestion failure.
            }

            throw new Error(`[${ingestResponse.status}] ${errorData.error || 'Erro ao processar documento'}`);
          }

          const ingestResult = await ingestResponse.json();
          debugLog(`[Admin] Ingestion result:`, ingestResult);

          completedFiles++;
          setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

          toast({
            title: 'Upload concluído',
            description: `"${file.name}" processado com sucesso.${ingestResult?.warning ? `\n\nAviso: ${ingestResult.warning}` : ''}`,
          });
        }

      } catch (error: unknown) {
        hasErrors = true;
        console.error('[Admin] Upload/processing error:', error);
        toast({
          title: `Erro: ${file.name}`,
          description: getErrorMessage(error) || 'Erro desconhecido',
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
    setExtractionPhase('idle');
    setPayloadMetrics(null);
  };

  // Helper function for file upload with retry
  const uploadFileWithRetry = async (fileToUpload: File, signedUrl: string): Promise<void> => {
    const uploadFile = async (file: File, url: string): Promise<Response> => {
      const isMobile = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
      const maxMb = isMobile ? 10 : 50;

      if (file.size > maxMb * 1024 * 1024) {
        throw new Error(`Arquivo muito grande para este dispositivo (máx ${maxMb}MB).`);
      }

      const timeoutMs = isMobile ? 120000 : 60000;
      const isPdf = isPdfFile(file);
      const contentType = file.type || (isPdf ? "application/pdf" : "application/octet-stream");
      const body = isPdf ? await file.arrayBuffer() : file;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const uploadRes = await fetch(url, {
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
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (typeof err === "object" && err !== null && "name" in err) {
          const name = (err as Record<string, unknown>).name;
          if (name === "AbortError") {
            throw new Error("Upload excedeu o tempo limite.");
          }
        }
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Upload excedeu o tempo limite.");
        }
        throw err instanceof Error ? err : new Error(getErrorMessage(err));
      }
    };

    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await uploadFile(fileToUpload, signedUrl);
        return;
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

  // Handle OCR processing for scanned PDFs
  const handleOcrUpload = async () => {
    if (!ocrFile) return;

    setShowOcrDialog(false);
    setOcrProcessing(true);
    setIsUploading(true);
    setExtractionPhase('extracting');
    setUploadProgress(5);

    try {
      // Load PDF and render pages as images
      const pdf = await loadPdfDocument(ocrFile);
      const batches = getPageBatches(pdf.numPages, 5);

      let allExtractedText = '';
      let processedPages = 0;

      for (const batch of batches) {
        // Render pages as images
        const images = await renderPagesAsImages(pdf, batch.start, batch.end, (progress) => {
          const overallProgress = ((processedPages + (progress / 100) * (batch.end - batch.start + 1)) / pdf.numPages) * 50;
          setUploadProgress(Math.round(5 + overallProgress));
        });

        // Send to OCR endpoint
        const pageImages = images.map(img => ({ pageNum: img.pageNum, dataUrl: img.dataUrl }));

        const ocrResponse = await authFetch(
          `${getSupabaseFunctionBaseUrl()}/documents/ocr-batch`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pageImages }),
          },
        );

        if (!ocrResponse.ok) {
          const errorData = await ocrResponse.json().catch(() => ({ error: 'Falha no OCR' }));
          throw new Error(errorData.error || 'Falha no OCR');
        }

        const ocrResult = await ocrResponse.json();
        allExtractedText += (allExtractedText ? '\n\n' : '') + ocrResult.extractedText;
        processedPages += batch.end - batch.start + 1;

        const overallProgress = 5 + (processedPages / pdf.numPages) * 50;
        setUploadProgress(Math.round(overallProgress));
      }

      // Now upload the original file
      setExtractionPhase('uploading');
      setUploadProgress(60);

      const signedUrlResponse = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/admin_get_upload_url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: ocrFile.name,
            contentType: ocrFile.type || 'application/pdf'
          }),
        },
      );

      if (!signedUrlResponse.ok) {
        throw new Error('Falha ao obter URL de upload');
      }

      const signedUrlData = await signedUrlResponse.json();
      await uploadFileWithRetry(ocrFile, signedUrlData.signedUrl);
      setUploadProgress(75);

      // Send OCR'd text to backend
      setExtractionPhase('processing');

      const ingestResponse = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/documents/ingest-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: ocrFile.name.replace(/\.[^/.]+$/, ''),
            category: 'manual',
            fullText: allExtractedText,
            filePath: signedUrlData.path,
            metadata: {
              originalFilename: ocrFile.name,
              totalPages: pdf.numPages,
              extractedAt: new Date().toISOString(),
              extractionMethod: 'ocr-client'
            }
          }),
        },
      );

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json().catch(() => ({ error: 'Falha ao processar' }));
        throw new Error(errorData.error || 'Falha ao processar documento');
      }

      const ingestResult = await ingestResponse.json();

      toast({
        title: 'OCR concluído',
        description: `"${ocrFile.name}" processado com OCR.${ingestResult?.warning ? `\n\nAviso: ${ingestResult.warning}` : ''}`,
      });

      await fetchDocuments();

    } catch (error: unknown) {
      console.error('[Admin] OCR processing error:', error);
      toast({
        title: 'Erro no OCR',
        description: getErrorMessage(error) || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setOcrFile(null);
      setOcrProcessing(false);
      setIsUploading(false);
      setUploadProgress(0);
      setExtractionPhase('idle');
      setPayloadMetrics(null);
    }
  };

  // Handle user choosing to proceed with extracted text despite quality warnings
  const handleUseExtractedText = async () => {
    if (!qualityFile || !qualityExtractionResult) return;

    setShowQualityDialog(false);
    setIsUploading(true);
    setExtractionPhase('uploading');
    setUploadProgress(50);

    try {
      const file = qualityFile;
      const { fullText, metadata } = qualityExtractionResult;

      // Upload file to storage
      const signedUrlResponse = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/admin_get_upload_url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/pdf'
          }),
        },
      );

      if (!signedUrlResponse.ok) {
        throw new Error('Falha ao obter URL de upload');
      }

      const signedUrlData = await signedUrlResponse.json();
      await uploadFileWithRetry(file, signedUrlData.signedUrl);
      setUploadProgress(70);

      // Send to backend with quality metadata
      setExtractionPhase('processing');

      const enrichedMetadata = {
        ...metadata,
        qualityScore: qualityResult?.confidence,
        qualityIssues: qualityResult?.issues,
        userOverride: true // User chose to use text despite warnings
      };

      const ingestResponse = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/documents/ingest-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: 'manual',
            fullText,
            filePath: signedUrlData.path,
            metadata: enrichedMetadata
          }),
        },
      );

      setUploadProgress(95);

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json().catch(() => ({ error: 'Falha ao processar' }));
        throw new Error(errorData.error || 'Falha ao processar documento');
      }

      const ingestResult = await ingestResponse.json();

      toast({
        title: 'Upload concluído',
        description: `"${file.name}" processado (texto pode conter erros).${ingestResult?.warning ? `\n\nAviso: ${ingestResult.warning}` : ''}`,
      });

      await fetchDocuments();

    } catch (error: unknown) {
      console.error('[Admin] Use extracted text error:', error);
      toast({
        title: 'Erro ao processar',
        description: getErrorMessage(error) || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setQualityFile(null);
      setQualityResult(null);
      setQualityExtractionResult(null);
      setIsUploading(false);
      setUploadProgress(0);
      setExtractionPhase('idle');
      setPayloadMetrics(null);
    }
  };

  // Handle user choosing OCR for quality issues
  const handleQualityOcr = async () => {
    if (!qualityFile) return;

    // Transfer to OCR flow
    setOcrFile(qualityFile);
    setShowQualityDialog(false);
    setQualityFile(null);
    setQualityResult(null);
    setQualityExtractionResult(null);

    // Trigger OCR
    setShowOcrDialog(false); // Skip the dialog, go directly to processing

    setOcrProcessing(true);
    setIsUploading(true);
    setExtractionPhase('extracting');
    setUploadProgress(5);

    try {
      const file = qualityFile!;

      // Load PDF and render pages as images
      const pdf = await loadPdfDocument(file);
      const batches = getPageBatches(pdf.numPages, 5);

      let allExtractedText = '';
      let processedPages = 0;

      for (const batch of batches) {
        const images = await renderPagesAsImages(pdf, batch.start, batch.end, (progress) => {
          const overallProgress = ((processedPages + (progress / 100) * (batch.end - batch.start + 1)) / pdf.numPages) * 50;
          setUploadProgress(Math.round(5 + overallProgress));
        });

        const pageImages = images.map(img => ({ pageNum: img.pageNum, dataUrl: img.dataUrl }));

        const ocrResponse = await authFetch(
          `${getSupabaseFunctionBaseUrl()}/documents/ocr-batch`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pageImages }),
          },
        );

        if (!ocrResponse.ok) {
          const errorData = await ocrResponse.json().catch(() => ({ error: 'Falha no OCR' }));
          throw new Error(errorData.error || 'Falha no OCR');
        }

        const ocrResult = await ocrResponse.json();
        allExtractedText += (allExtractedText ? '\n\n' : '') + ocrResult.extractedText;
        processedPages += batch.end - batch.start + 1;

        const overallProgress = 5 + (processedPages / pdf.numPages) * 50;
        setUploadProgress(Math.round(overallProgress));
      }

      // Upload original file
      setExtractionPhase('uploading');
      setUploadProgress(60);

      const signedUrlResponse = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/admin_get_upload_url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/pdf'
          }),
        },
      );

      if (!signedUrlResponse.ok) {
        throw new Error('Falha ao obter URL de upload');
      }

      const signedUrlData = await signedUrlResponse.json();
      await uploadFileWithRetry(file, signedUrlData.signedUrl);
      setUploadProgress(75);

      // Send OCR'd text to backend
      setExtractionPhase('processing');

      const ingestResponse = await authFetch(
        `${getSupabaseFunctionBaseUrl()}/documents/ingest-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: 'manual',
            fullText: allExtractedText,
            filePath: signedUrlData.path,
            metadata: {
              originalFilename: file.name,
              totalPages: pdf.numPages,
              extractedAt: new Date().toISOString(),
              extractionMethod: 'ocr-quality-fallback',
              originalQualityScore: qualityResult?.confidence,
              originalQualityIssues: qualityResult?.issues
            }
          }),
        },
      );

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json().catch(() => ({ error: 'Falha ao processar' }));
        throw new Error(errorData.error || 'Falha ao processar documento');
      }

      const ingestResult = await ingestResponse.json();

      toast({
        title: 'OCR concluído',
        description: `"${file.name}" processado com OCR (fallback de qualidade).${ingestResult?.warning ? `\n\nAviso: ${ingestResult.warning}` : ''}`,
      });

      await fetchDocuments();

    } catch (error: unknown) {
      console.error('[Admin] Quality OCR error:', error);
      toast({
        title: 'Erro no OCR',
        description: getErrorMessage(error) || 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setOcrFile(null);
      setOcrProcessing(false);
      setIsUploading(false);
      setUploadProgress(0);
      setExtractionPhase('idle');
      setPayloadMetrics(null);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      const response = await authFetch(`${getSupabaseFunctionBaseUrl()}/documents`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: documentToDelete.id }),
      });

      const payload = await response.json().catch(() => ({ error: 'Resposta inválida do servidor' }));

      if (!response.ok) {
        const msg = getErrorMessage((payload as Record<string, unknown>).error);
        if (response.status === 401 || response.status === 403) {
          handleAuthExpired();
          return;
        }
        throw new Error(msg);
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
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover',
        description: getErrorMessage(error),
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

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

  if (authLoading || adminStatus === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="space-y-1">
              <p className="text-lg font-medium text-foreground">Validando acesso administrativo</p>
              <p className="text-sm text-muted-foreground">
                Estou confirmando sua sessão e suas permissões.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (adminStatus === 'signed_out') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Área Administrativa</CardTitle>
            <CardDescription>
              Entre com sua conta Google para acessar o gerenciamento de documentos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GoogleLoginButton className="w-full" redirectPath="/admin" label="Entrar com Google" />
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

  if (adminStatus === 'forbidden') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="glass-card max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Acesso restrito</CardTitle>
            <CardDescription>
              Sua conta está autenticada, mas ainda não possui permissão administrativa para esta área.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.email && (
              <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                Conta atual: <span className="text-foreground">{user.email}</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => void signOut()}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair desta conta
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
                <p className="text-xs text-muted-foreground">
                  Gerenciamento de documentos{user?.email ? ` • ${user.email}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDocuments}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void signOut()}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="documents" className="space-y-6">
            <TabsList className="grid w-full max-w-3xl grid-cols-6">
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Documentos</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex items-center gap-2">
                <MessageSquareWarning className="w-4 h-4" />
                <span className="hidden sm:inline">Feedback</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Relatórios</span>
              </TabsTrigger>
              <TabsTrigger value="observability" className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Observab.</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Métricas</span>
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
                        <p className="text-muted-foreground">
                          {extractionPhase === 'extracting' && 'Extraindo texto do documento...'}
                          {extractionPhase === 'uploading' && 'Enviando arquivo...'}
                          {extractionPhase === 'processing' && 'Processando chunks e embeddings...'}
                          {extractionPhase === 'batching' && 'Enviando em lotes (documento grande)...'}
                          {extractionPhase === 'idle' && 'Preparando...'}
                        </p>
                        <div className="w-full max-w-xs mx-auto">
                          <Progress value={uploadProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1 text-center">{uploadProgress}%</p>
                        </div>
                        {payloadMetrics && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>{payloadMetrics.charCount.toLocaleString()} caracteres • {payloadMetrics.estimatedMB}MB</p>
                            {payloadMetrics.warning && (
                              <p className="text-amber-500">{payloadMetrics.warning}</p>
                            )}
                          </div>
                        )}
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
                  {/* Document Filters */}
                  <Suspense fallback={<div className="h-10" />}>
                    <DocumentFilters
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      selectedTags={selectedTags}
                      onTagsChange={setSelectedTags}
                      availableTags={availableTags}
                    />
                  </Suspense>

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
                  ) : filteredDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum documento corresponde aos filtros.</p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedTags([]);
                        }}
                        className="mt-2"
                      >
                        Limpar filtros
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredDocuments.map((doc) => {
                        const statusBadge = getStatusBadge(doc.status, doc.error_reason);
                        const isProcessing = processingDocs.has(doc.id);
                        const canProcess = doc.status === 'uploaded' || doc.status === 'failed';
                        const isStuck = isDocumentStuck(doc);
                        const canRetry = isStuck || doc.status === 'chunks_ok_embed_pending';
                        const supersedesDoc = doc.supersedes_document_id
                          ? documents.find(d => d.id === doc.supersedes_document_id)
                          : null;

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
                                  {statusBadge.tooltip || isStuck ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant={statusBadge.variant} className={isStuck ? 'bg-amber-500/20 text-amber-500' : statusBadge.className}>
                                          {isStuck ? '⚠️ Travado' : statusBadge.label}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="text-xs">
                                          {isStuck
                                            ? 'Documento parou de processar. Use o botão Retry para retomar.'
                                            : statusBadge.tooltip}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Badge variant={statusBadge.variant} className={statusBadge.className}>
                                      {statusBadge.label}
                                    </Badge>
                                  )}

                                  {/* Version label */}
                                  {doc.version_label && (
                                    <Badge variant="outline" className="text-xs">
                                      {doc.version_label}
                                    </Badge>
                                  )}

                                  <span>{formatDate(doc.created_at)}</span>
                                  {doc.chunk_count !== undefined && doc.chunk_count > 0 && (
                                    <span>{doc.chunk_count} chunks</span>
                                  )}
                                </div>

                                {/* Tags display */}
                                {doc.tags && doc.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {doc.tags.map(tag => (
                                      <Badge key={tag} variant="secondary" className="text-xs py-0">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {/* Supersedes info */}
                                {supersedesDoc && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Substitui: {supersedesDoc.title}
                                  </p>
                                )}

                                {/* Processing progress bar */}
                                {(doc.processing_status === 'processing' || doc.processing_status === 'pending') && (
                                  <div className="mt-2">
                                    <div className="flex items-center gap-2 text-xs text-amber-500">
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
                              {/* Edit Metadata Button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setDocumentToEdit(doc);
                                      setEditorModalOpen(true);
                                    }}
                                    className="text-muted-foreground hover:text-foreground"
                                    disabled={isProcessing}
                                  >
                                    <Settings2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar metadados</p>
                                </TooltipContent>
                              </Tooltip>

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

                              {/* Retry Button for stuck/pending documents */}
                              {canRetry && !canProcess && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRetryProcessing(doc.id, doc.title)}
                                      disabled={isProcessing && !isStuck}
                                      className="gap-1 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                      Retry
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">
                                      {doc.status === 'chunks_ok_embed_pending'
                                        ? 'Reprocessar embeddings que falharam'
                                        : 'Documento travado - tentar reprocessar chunks a partir do texto já extraído'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
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
              <Suspense fallback={<AdminSectionFallback />}>
                <AnalyticsTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="feedback">
              <Suspense fallback={<AdminSectionFallback />}>
                <FeedbackTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="reports">
              <Suspense fallback={<AdminSectionFallback />}>
                <ReportsTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="observability">
              <Suspense fallback={<AdminSectionFallback />}>
                <ProcessingStatsTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="metrics">
              <Suspense fallback={<AdminSectionFallback />}>
                <ChatMetricsDashboard />
              </Suspense>
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

        {/* OCR Dialog for Scanned PDFs */}
        <AlertDialog open={showOcrDialog} onOpenChange={(open) => {
          if (!open && !ocrProcessing) {
            setShowOcrDialog(false);
            setOcrFile(null);
          }
        }}>
          <AlertDialogContent className="glass-card">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <FileWarning className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <AlertDialogTitle>PDF Escaneado Detectado</AlertDialogTitle>
                </div>
              </div>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Este PDF parece ser uma imagem escaneada com pouco texto selecionável
                  ({ocrFile?.name}).
                </p>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium text-foreground mb-1">
                    💡 Recomendação
                  </p>
                  <p className="text-sm">
                    Para melhores resultados, use seu scanner ou software de PDF para gerar
                    uma versão com OCR (camada de texto). Isso é mais rápido e preciso.
                  </p>
                </div>
                <p className="text-sm">
                  Alternativamente, você pode processar via IA (mais lento, pode ter erros).
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowOcrDialog(false);
                  setOcrFile(null);
                }}
                disabled={ocrProcessing}
              >
                Cancelar Upload
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleOcrUpload}
                disabled={ocrProcessing}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {ocrProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Processar via IA'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Text Quality Dialog */}
        {showQualityDialog ? (
          <Suspense fallback={null}>
            <TextQualityDialog
              open={showQualityDialog}
              onOpenChange={(open) => {
                if (!open && !ocrProcessing) {
                  setShowQualityDialog(false);
                  setQualityFile(null);
                  setQualityResult(null);
                  setQualityExtractionResult(null);
                }
              }}
              qualityResult={qualityResult}
              fileName={qualityFile?.name || ''}
              onUseText={handleUseExtractedText}
              onUseOcr={handleQualityOcr}
              onCancel={() => {
                setShowQualityDialog(false);
                setQualityFile(null);
                setQualityResult(null);
                setQualityExtractionResult(null);
              }}
              isProcessing={ocrProcessing}
            />
          </Suspense>
        ) : null}

        {/* Document Editor Modal */}
        {editorModalOpen && documentToEdit ? (
          <Suspense fallback={null}>
            <DocumentEditorModal
              document={documentToEdit}
              open={editorModalOpen}
              onOpenChange={setEditorModalOpen}
              onSaved={() => {
                fetchDocuments();
                setDocumentToEdit(null);
              }}
              allDocuments={documents.map(d => ({
                id: d.id,
                title: d.title,
                supersedes_document_id: d.supersedes_document_id
              }))}
            />
          </Suspense>
        ) : null}
      </div>
    </TooltipProvider>
  );
};

export default Admin;
