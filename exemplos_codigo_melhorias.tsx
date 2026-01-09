// ==================================================
// EXEMPLOS DE CÓDIGO - MELHORIAS PARA LECIONA
// ==================================================

// ==================================================
// 1. SINCRONIZAÇÃO GOOGLE DRIVE - IMPLEMENTAÇÃO COMPLETA
// ==================================================

// ============ Arquivo: src/config/google.ts ============
export const GOOGLE_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  scope: 'https://www.googleapis.com/auth/drive.appdata',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
};

export const DRIVE_FILE_NAME = 'leciona_backup.json';

// ============ Arquivo: src/hooks/useGoogleDrive.ts ============
import { useState, useEffect, useCallback } from 'react';
import { GOOGLE_CONFIG, DRIVE_FILE_NAME } from '../config/google';
import { AppData } from '../types';

declare global {
  interface Window {
    gapi: any;
  }
}

export const useGoogleDrive = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Inicializar Google API
  useEffect(() => {
    const initGoogleAPI = () => {
      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_CONFIG.apiKey,
            clientId: GOOGLE_CONFIG.clientId,
            discoveryDocs: GOOGLE_CONFIG.discoveryDocs,
            scope: GOOGLE_CONFIG.scope
          });

          const authInstance = window.gapi.auth2.getAuthInstance();
          setIsAuthenticated(authInstance.isSignedIn.get());
          setIsInitialized(true);

          // Listener para mudanças no status de autenticação
          authInstance.isSignedIn.listen((isSignedIn: boolean) => {
            setIsAuthenticated(isSignedIn);
          });
        } catch (err) {
          console.error('Erro ao inicializar Google API:', err);
          setError('Falha ao conectar com o Google Drive');
        }
      });
    };

    if (window.gapi) {
      initGoogleAPI();
    } else {
      setError('Google API não está carregada');
    }
  }, []);

  // Fazer login
  const signIn = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      setError(null);
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signIn();
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setError(err.error || 'Falha ao fazer login no Google');
    }
  }, [isInitialized]);

  // Fazer logout
  const signOut = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      setError(null);
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      setIsAuthenticated(false);
      setLastSyncAt(null);
    } catch (err: any) {
      console.error('Erro ao fazer logout:', err);
      setError('Falha ao desconectar do Google');
    }
  }, [isInitialized]);

  // Upload de dados para o Drive
  const uploadData = useCallback(async (data: AppData): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Não autenticado. Faça login primeiro.');
      return false;
    }

    setIsSyncing(true);
    setError(null);

    try {
      // Buscar arquivo existente
      const response = await window.gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        q: `name = '${DRIVE_FILE_NAME}'`,
        fields: 'files(id)'
      });

      const existingFile = response.result.files?.[0];
      const metadata = {
        name: DRIVE_FILE_NAME,
        mimeType: 'application/json',
        parents: ['appDataFolder']
      };

      const content = JSON.stringify(data, null, 2);
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const closeDelim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        closeDelim;

      if (existingFile) {
        // Atualizar arquivo existente
        await window.gapi.client.request({
          path: `/upload/drive/v3/files/${existingFile.id}`,
          method: 'PATCH',
          params: { uploadType: 'multipart' },
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });
      } else {
        // Criar novo arquivo
        await window.gapi.client.request({
          path: '/upload/drive/v3/files',
          method: 'POST',
          params: { uploadType: 'multipart' },
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });
      }

      const now = new Date().toISOString();
      setLastSyncAt(now);
      return true;
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      setError('Falha ao enviar dados para o Google Drive');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated]);

  // Download de dados do Drive
  const downloadData = useCallback(async (): Promise<AppData | null> => {
    if (!isAuthenticated) {
      setError('Não autenticado. Faça login primeiro.');
      return null;
    }

    setIsSyncing(true);
    setError(null);

    try {
      // Buscar arquivo
      const response = await window.gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        q: `name = '${DRIVE_FILE_NAME}'`,
        fields: 'files(id)'
      });

      const file = response.result.files?.[0];
      if (!file) {
        setError('Nenhum backup encontrado no Google Drive');
        return null;
      }

      // Baixar conteúdo
      const fileData = await window.gapi.client.drive.files.get({
        fileId: file.id,
        alt: 'media'
      });

      const data = JSON.parse(fileData.body) as AppData;
      setLastSyncAt(new Date().toISOString());
      return data;
    } catch (err: any) {
      console.error('Erro ao fazer download:', err);
      setError('Falha ao baixar dados do Google Drive');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated]);

  // Verificar se existe backup
  const checkBackupExists = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      const response = await window.gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        q: `name = '${DRIVE_FILE_NAME}'`,
        fields: 'files(id,createdTime,modifiedTime)'
      });

      return response.result.files?.length > 0;
    } catch (err) {
      console.error('Erro ao verificar backup:', err);
      return false;
    }
  }, [isAuthenticated]);

  return {
    isInitialized,
    isAuthenticated,
    isSyncing,
    error,
    lastSyncAt,
    signIn,
    signOut,
    uploadData,
    downloadData,
    checkBackupExists
  };
};

// ============ Componente: GoogleDriveSync.tsx ============
import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Download, Upload, CheckCircle2, XCircle, LogOut } from 'lucide-react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { AppData } from '../types';

interface GoogleDriveSyncProps {
  data: AppData;
  onDataRestore: (data: AppData) => void;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({ data, onDataRestore }) => {
  const {
    isInitialized,
    isAuthenticated,
    isSyncing,
    error,
    lastSyncAt,
    signIn,
    signOut,
    uploadData,
    downloadData,
    checkBackupExists
  } = useGoogleDrive();

  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  const handleUpload = async () => {
    const success = await uploadData(data);
    if (success) {
      alert('Dados sincronizados com sucesso!');
    }
  };

  const handleDownload = async () => {
    const cloudData = await downloadData();
    if (cloudData) {
      setShowConfirmRestore(true);
    }
  };

  const confirmRestore = async () => {
    const cloudData = await downloadData();
    if (cloudData) {
      onDataRestore(cloudData);
      setShowConfirmRestore(false);
      alert('Dados restaurados com sucesso!');
    }
  };

  if (!isInitialized) {
    return (
      <div className="p-4 bg-yellow-50 rounded-xl text-yellow-800 text-sm">
        Carregando Google Drive...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-xl">
              <Cloud className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-lg mb-1">Sincronização com Google Drive</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Faça backup automático de todos os seus dados na nuvem do Google.
                Seus dados estarão seguros e acessíveis de qualquer dispositivo.
              </p>
              <button
                onClick={signIn}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Cloud size={16} />
                Conectar ao Google Drive
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-800 rounded-xl">
              <CheckCircle2 className="text-green-600" size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg">Google Drive Conectado</h3>
              {lastSyncAt && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Última sincronização: {new Date(lastSyncAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <LogOut size={14} />
            Desconectar
          </button>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleUpload}
            disabled={isSyncing}
            className="p-4 bg-white dark:bg-slate-800 rounded-xl hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            <span className="font-bold text-sm">Enviar para Nuvem</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={isSyncing}
            className="p-4 bg-white dark:bg-slate-800 rounded-xl hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={18} />
            <span className="font-bold text-sm">Restaurar da Nuvem</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3">
          <XCircle className="text-red-600" size={20} />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Confirm Restore Dialog */}
      {showConfirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-black text-xl mb-3">Confirmar Restauração</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Esta ação irá substituir todos os seus dados locais pelos dados da nuvem.
              Deseja continuar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmRestore(false)}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================================================
// 2. RESPONSIVIDADE MOBILE - EXEMPLOS DE MELHORIAS
// ==================================================

// ============ Dashboard Otimizado ============
export const OptimizedDashboard = () => {
  return (
    <div className="space-y-3 md:space-y-6">
      {/* Cards com espaçamento adaptativo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        <div className="p-4 md:p-6 bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-sm">
          <h3 className="text-sm md:text-base font-black mb-2 md:mb-3">
            Próximas Aulas
          </h3>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
            Conteúdo...
          </p>
        </div>
      </div>

      {/* Lista de aulas compacta em mobile */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl p-4 md:p-6">
        <h3 className="text-base md:text-lg font-black mb-3 md:mb-4">Agenda do Dia</h3>
        <div className="space-y-2 md:space-y-3">
          {/* Item de aula */}
          <div className="flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-xs md:text-sm font-black text-blue-600">8A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs md:text-sm truncate">Matemática</p>
                <p className="text-[10px] md:text-xs text-slate-500 truncate">07:30 - 08:20</p>
              </div>
            </div>
            <button className="text-blue-600 text-xs md:text-sm font-bold shrink-0">
              Registrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================================================
// 3. ERROR BOUNDARY
// ==================================================

// ============ ErrorBoundary.tsx ============
import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Aqui você pode enviar para um serviço de logging
    // Ex: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              
              <h2 className="text-2xl font-black mb-2">Algo deu errado</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Ocorreu um erro inesperado. Você pode tentar recarregar a página
                ou entrar em contato com o suporte.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 w-full text-left">
                  <summary className="text-xs font-bold cursor-pointer mb-2">
                    Detalhes do erro (desenvolvimento)
                  </summary>
                  <pre className="text-[10px] bg-slate-100 dark:bg-slate-800 p-4 rounded-xl overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 w-full">
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  Recarregar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============ Uso no App.tsx ============
// import { ErrorBoundary } from './components/ErrorBoundary';
// 
// <ErrorBoundary>
//   <App />
// </ErrorBoundary>

// ==================================================
// 4. TOAST NOTIFICATIONS
// ==================================================

// ============ Instalação ============
// npm install react-hot-toast

// ============ Uso no App ============
import { Toaster, toast } from 'react-hot-toast';

// No componente principal
<Toaster
  position="top-right"
  toastOptions={{
    duration: 4000,
    style: {
      background: '#334155',
      color: '#fff',
      borderRadius: '12px',
      padding: '16px',
    },
    success: {
      iconTheme: {
        primary: '#10b981',
        secondary: '#fff',
      },
    },
    error: {
      iconTheme: {
        primary: '#ef4444',
        secondary: '#fff',
      },
    },
  }}
/>

// Exemplos de uso
toast.success('Dados salvos com sucesso!');
toast.error('Falha ao sincronizar com o Google Drive');
toast.loading('Sincronizando...');
toast.promise(
  uploadData(data),
  {
    loading: 'Enviando dados...',
    success: 'Dados enviados!',
    error: 'Erro ao enviar',
  }
);

// ==================================================
// 5. VALIDAÇÃO DE DADOS COM ZOD
// ==================================================

// ============ Instalação ============
// npm install zod

// ============ types.ts (com Zod) ============
import { z } from 'zod';

// Schemas
const TeacherProfileSchema = z.object({
  title: z.enum(['Prof.', 'Profª.']).optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
  subjects: z.array(z.string())
});

const SchoolSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  subjects: z.array(z.string()),
  classes: z.array(z.string()),
  shifts: z.array(z.any()) // Definir melhor
});

const AppDataSchema = z.object({
  profile: TeacherProfileSchema,
  schools: z.array(SchoolSchema),
  students: z.array(z.any()),
  schedules: z.array(z.any()),
  logs: z.array(z.any()),
  events: z.array(z.any()),
  calendars: z.array(z.any()),
  reminders: z.array(z.any()),
  settings: z.object({
    alertBeforeMinutes: z.number().min(0).max(60),
    alertAfterLesson: z.boolean(),
    alertAfterShift: z.boolean(),
    isPrivateTeacher: z.boolean(),
    googleSyncEnabled: z.boolean(),
    showQuickStartGuide: z.boolean(),
    themeColor: z.string().regex(/^#[0-9A-F]{6}$/i),
    darkMode: z.boolean(),
    showDailyQuote: z.boolean(),
    lastSyncAt: z.string().optional()
  })
});

// Exportar tipos inferidos
export type AppData = z.infer<typeof AppDataSchema>;
export type TeacherProfile = z.infer<typeof TeacherProfileSchema>;

// Função de validação
export const validateAppData = (data: unknown): AppData => {
  try {
    return AppDataSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Dados inválidos:', error.errors);
      throw new Error('Dados corrompidos ou inválidos');
    }
    throw error;
  }
};

// Uso no carregamento
const loadData = (): AppData => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return INITIAL_DATA;
  
  try {
    const parsed = JSON.parse(saved);
    return validateAppData(parsed);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    toast.error('Dados locais corrompidos. Usando dados padrão.');
    return INITIAL_DATA;
  }
};

// ==================================================
// 6. OTIMIZAÇÃO DE BUNDLE - tailwind.config.js
// ==================================================

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary-color)',
      },
      animation: {
        'in': 'fadeIn 0.3s ease-in',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

// ==================================================
// 7. SERVICE WORKER MELHORADO
// ==================================================

const CACHE_NAME = 'leciona-v1';
const DYNAMIC_CACHE = 'leciona-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first para APIs
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        
        return fetch(request)
          .then(response => {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, clone));
            return response;
          });
      })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncDataToServer());
  }
});

async function syncDataToServer() {
  // Implementar lógica de sincronização
  console.log('Sincronizando dados em background...');
}

// ==================================================
// 8. ARQUIVO .env.local (EXEMPLO)
// ==================================================

// Criar arquivo .env.local na raiz do projeto:
/*
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=sua-api-key-aqui
*/

// Para obter as credenciais:
// 1. Acesse https://console.cloud.google.com/
// 2. Crie um novo projeto ou selecione existente
// 3. Ative a API do Google Drive
// 4. Crie credenciais OAuth 2.0
// 5. Configure o consentimento OAuth
// 6. Adicione os domínios autorizados

// ==================================================
// 9. LAZY LOADING DE COMPONENTES
// ==================================================

// ============ App.tsx com Lazy Loading ============
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const LessonLogger = lazy(() => import('./components/LessonLogger'));
const AssessmentManagement = lazy(() => import('./components/AssessmentManagement'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-12">
    <RefreshCw className="animate-spin text-blue-600" size={32} />
  </div>
);

// No render
<Suspense fallback={<LoadingSpinner />}>
  {activeTab === 'dashboard' && <Dashboard />}
  {activeTab === 'lessons' && <LessonLogger />}
  {activeTab === 'assessments' && <AssessmentManagement />}
  {activeTab === 'settings' && <SettingsPanel />}
</Suspense>

// ==================================================
// 10. HOOK CUSTOMIZADO PARA RESPONSIVIDADE
// ==================================================

import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: windowSize.width < 768,
    isTablet: windowSize.width >= 768 && windowSize.width < 1024,
    isDesktop: windowSize.width >= 1024,
    width: windowSize.width,
    height: windowSize.height
  };
};

// Uso:
const { isMobile, isDesktop } = useResponsive();

return (
  <div className={isMobile ? "p-4" : "p-8"}>
    {isMobile ? <MobileLayout /> : <DesktopLayout />}
  </div>
);
