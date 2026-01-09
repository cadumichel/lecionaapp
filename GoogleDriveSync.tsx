import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Download, Upload, CheckCircle2, XCircle, LogOut, AlertTriangle } from 'lucide-react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { AppData } from '../types';

interface GoogleDriveSyncProps {
  data: AppData;
  onDataRestore: (data: AppData) => void;
  onSyncSuccess?: () => void;
  onSyncError?: (error: string) => void;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({ 
  data, 
  onDataRestore,
  onSyncSuccess,
  onSyncError 
}) => {
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
  const [hasBackup, setHasBackup] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      checkBackupExists().then(setHasBackup);
    }
  }, [isAuthenticated, checkBackupExists]);

  useEffect(() => {
    if (error && onSyncError) {
      onSyncError(error);
    }
  }, [error, onSyncError]);

  const handleUpload = async () => {
    const success = await uploadData(data);
    if (success) {
      setHasBackup(true);
      if (onSyncSuccess) onSyncSuccess();
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
      if (onSyncSuccess) onSyncSuccess();
    }
  };

  if (!isInitialized) {
    return (
      <div className="p-4 md:p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl md:rounded-2xl text-yellow-800 dark:text-yellow-200 text-xs md:text-sm flex items-center gap-3">
        <RefreshCw className="animate-spin shrink-0" size={16} />
        <span className="font-bold">Carregando Google Drive...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-3 md:space-y-4">
        <div className="p-4 md:p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl md:rounded-3xl">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="p-2 md:p-3 bg-blue-100 dark:bg-blue-800 rounded-xl shrink-0">
              <Cloud className="text-blue-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-base md:text-lg mb-1">Sincronização com Google Drive</h3>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-4">
                Faça backup automático de todos os seus dados na nuvem do Google.
                Seus dados estarão seguros e acessíveis de qualquer dispositivo.
              </p>
              <button
                onClick={signIn}
                className="w-full md:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-blue-600 text-white rounded-xl font-bold text-xs md:text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Cloud size={16} />
                Conectar ao Google Drive
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3">
            <XCircle className="text-red-600 shrink-0" size={18} />
            <p className="text-xs md:text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Status Card */}
      <div className="p-4 md:p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl md:rounded-3xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="p-2 md:p-3 bg-green-100 dark:bg-green-800 rounded-xl shrink-0">
              <CheckCircle2 className="text-green-600" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-sm md:text-lg truncate">Google Drive Conectado</h3>
              {lastSyncAt && (
                <p className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 truncate">
                  Última sinc: {new Date(lastSyncAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-xs md:text-sm text-red-600 hover:text-red-700 flex items-center gap-1 shrink-0 ml-2"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <button
            onClick={handleUpload}
            disabled={isSyncing}
            className="p-3 md:p-4 bg-white dark:bg-slate-800 rounded-xl hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col md:flex-row items-center justify-center gap-2"
          >
            {isSyncing ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            <span className="font-bold text-[10px] md:text-sm">Enviar</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={isSyncing || !hasBackup}
            className="p-3 md:p-4 bg-white dark:bg-slate-800 rounded-xl hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col md:flex-row items-center justify-center gap-2"
          >
            <Download size={18} />
            <span className="font-bold text-[10px] md:text-sm">Restaurar</span>
          </button>
        </div>

        {!hasBackup && (
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-start gap-2">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={16} />
            <p className="text-[10px] md:text-xs text-yellow-700 dark:text-yellow-400">
              Nenhum backup encontrado. Envie seus dados para a nuvem primeiro.
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 md:p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3">
          <XCircle className="text-red-600 shrink-0" size={18} />
          <p className="text-xs md:text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Confirm Restore Dialog */}
      {showConfirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl p-6 max-w-md w-full">
            <h3 className="font-black text-lg md:text-xl mb-3 dark:text-white">Confirmar Restauração</h3>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-6">
              Esta ação irá substituir todos os seus dados locais pelos dados da nuvem.
              Todos os dados não sincronizados serão perdidos. Deseja continuar?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmRestore(false)}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors dark:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
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
