import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Trash2, RefreshCw, Lock, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

interface Document {
  id: string;
  title: string;
  category: string;
  file_path: string;
  created_at: string;
  chunk_count?: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  // Check session storage for existing auth
  useEffect(() => {
    const storedKey = sessionStorage.getItem('clara_admin_key');
    if (storedKey) {
      setAdminKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch documents when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated]);

  const handleAuthenticate = async () => {
    if (!adminKey.trim()) {
      toast({
        title: 'Chave obrigatória',
        description: 'Digite a chave de administrador.',
        variant: 'destructive',
      });
      return;
    }

    setIsAuthenticating(true);
    
    try {
      // Validate admin key using dedicated auth endpoint
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        headers: {
          'x-admin-key': adminKey,
        },
      });

      if (error) {
        console.error('[Admin] Auth error:', error);
        throw new Error('Erro de conexão');
      }

      if (!data?.valid) {
        throw new Error(data?.error || 'Chave inválida');
      }

      // Store in session storage
      sessionStorage.setItem('clara_admin_key', adminKey);
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
      const { data, error } = await supabase.functions.invoke('documents', {
        method: 'GET',
        headers: {
          'x-admin-key': adminKey,
        },
      });

      if (error) throw error;
      setDocuments(data.documents || []);
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

  const handleFileUpload = async (files: FileList | null) => {
    console.log('[Admin] handleFileUpload called with files:', files?.length);
    
    if (!files || files.length === 0) {
      console.log('[Admin] No files provided');
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
    
    const validFiles = Array.from(files).filter(file => {
      console.log(`[Admin] Checking file: ${file.name}, type: ${file.type}, size: ${Math.round(file.size / 1024 / 1024)}MB`);
      
      const isValidType = allowedTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf') || file.name.endsWith('.docx');
      const isValidSize = file.size <= MAX_FILE_SIZE;
      
      console.log(`[Admin] File ${file.name}: validType=${isValidType}, validSize=${isValidSize}`);
      
      if (!isValidType) {
        console.log(`[Admin] Invalid type for ${file.name}`);
        toast({
          title: `Arquivo ignorado: ${file.name}`,
          description: 'Use apenas PDF, DOCX ou TXT.',
          variant: 'destructive',
        });
        return false;
      }
      
      if (!isValidSize) {
        console.log(`[Admin] File too large: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
        toast({
          title: `Arquivo muito grande: ${file.name}`,
          description: `Limite: 50MB. Seu arquivo: ${Math.round(file.size / 1024 / 1024)}MB.`,
          variant: 'destructive',
        });
        return false;
      }
      
      return true;
    });

    console.log('[Admin] Valid files count:', validFiles.length);

    if (validFiles.length === 0) {
      console.log('[Admin] No valid files to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    const totalFiles = validFiles.length;
    let completedFiles = 0;
    let hasErrors = false;

    for (const file of validFiles) {
      try {
        // STEP 1: Upload file securely via admin-upload Edge Function
        console.log(`[Admin] Uploading ${file.name} via admin-upload...`);
        setUploadProgress(Math.round(((completedFiles + 0.2) / totalFiles) * 100));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
        formData.append('category', 'manual');

        const uploadResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-upload`,
          {
            method: 'POST',
            headers: {
              'x-admin-key': adminKey,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          console.error('[Admin] Upload error:', errorData);
          throw new Error(errorData.error || 'Erro ao fazer upload');
        }

        const uploadResult = await uploadResponse.json();
        console.log(`[Admin] Upload complete: ${uploadResult.filePath}`);
        setUploadProgress(Math.round(((completedFiles + 0.5) / totalFiles) * 100));

        // STEP 2: Process document via documents Edge Function
        console.log(`[Admin] Processing document...`);
        const processResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documents`,
          {
            method: 'POST',
            headers: {
              'x-admin-key': adminKey,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filePath: uploadResult.filePath,
              title: uploadResult.title,
              category: uploadResult.category,
              fileType: uploadResult.fileType,
              originalName: uploadResult.originalName,
            }),
          }
        );

        setUploadProgress(Math.round(((completedFiles + 0.8) / totalFiles) * 100));

        if (!processResponse.ok) {
          const errorData = await processResponse.json();
          console.error('[Admin] Processing error:', errorData);
          // Clean up the uploaded file if processing failed
          try {
            await supabase.storage.from('knowledge-base').remove([uploadResult.filePath]);
          } catch (cleanupError) {
            console.error('[Admin] Cleanup error:', cleanupError);
          }
          throw new Error(errorData.error || 'Erro ao processar documento');
        }

        const processResult = await processResponse.json();
        console.log(`[Admin] Processing complete:`, processResult);

        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));

        toast({
          title: 'Upload concluído',
          description: `"${file.name}" processado (${completedFiles}/${totalFiles}).`,
        });

      } catch (error: any) {
        hasErrors = true;
        console.error('[Admin] Upload error:', error);
        toast({
          title: `Erro: ${file.name}`,
          description: error.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    }

    // Refresh documents list
    await fetchDocuments();

    if (!hasErrors && totalFiles > 1) {
      toast({
        title: 'Todos os uploads concluídos',
        description: `${totalFiles} documentos processados com sucesso.`,
      });
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      const { error } = await supabase.functions.invoke(`documents`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKey,
        },
        body: { id: documentToDelete.id },
      });

      if (error) throw error;

      toast({
        title: 'Documento removido',
        description: `"${documentToDelete.title}" foi removido da base de conhecimento.`,
      });

      setDocuments(docs => docs.filter(d => d.id !== documentToDelete.id));
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
  }, [adminKey]);

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
            <Input
              type="password"
              placeholder="Chave de administrador"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
              className="bg-background/50 border-border"
            />
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

      <main className="container mx-auto px-4 py-8 space-y-8">
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
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.title}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <Badge variant="secondary" className={getCategoryColor(doc.category)}>
                            {doc.category}
                          </Badge>
                          <span>{formatDate(doc.created_at)}</span>
                          {doc.chunk_count !== undefined && (
                            <span>{doc.chunk_count} chunks</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDocumentToDelete(doc);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
  );
};

export default Admin;
