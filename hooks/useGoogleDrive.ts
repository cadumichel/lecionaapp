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
