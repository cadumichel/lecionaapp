
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { 
  LayoutDashboard, 
  School as SchoolIcon, 
  CalendarClock, 
  BookOpen, 
  FileCheck, 
  Settings,
  CalendarDays,
  Users,
  Lightbulb,
  Cloud,
  X,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sliders,
  RefreshCw
} from 'lucide-react';
import { AppData, ScheduleEntry, DayOfWeek } from './types';
import { parseTimeToMinutes, getCurrentTimeInMinutes } from './utils';
import { useResponsive } from './hooks/useResponsive';

// Lazy loading de componentes pesados
const Dashboard = lazy(() => import('./components/Dashboard'));
const LessonLogger = lazy(() => import('./components/LessonLogger'));
const AssessmentManagement = lazy(() => import('./components/AssessmentManagement'));
const AgendaManagement = lazy(() => import('./components/AgendaManagement'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const StudentManagement = lazy(() => import('./components/StudentManagement'));
const ReminderManagement = lazy(() => import('./components/ReminderManagement'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-12">
    <RefreshCw className="animate-spin text-primary" size={32} />
  </div>
);

const STORAGE_KEY = 'leciona_data_v1';
const DRIVE_FILE_NAME = 'leciona_backup.json';

const INITIAL_DATA: AppData = {
  profile: { name: '', subjects: [] },
  schools: [],
  students: [],
  schedules: [],
  logs: [],
  events: [],
  calendars: [],
  reminders: [],
  settings: {
    alertBeforeMinutes: 5,
    alertAfterLesson: true,
    alertAfterShift: true,
    isPrivateTeacher: false,
    googleSyncEnabled: false,
    showQuickStartGuide: true,
    themeColor: '#2563eb', 
    darkMode: false,
    showDailyQuote: true
  }
};

export const QuickStartGuide: React.FC<{ onDismiss: () => void; onNavigate: (tab: string) => void }> = ({ onDismiss, onNavigate }) => (
  <div className="bg-primary text-white p-8 rounded-[40px] shadow-2xl shadow-primary/20 mb-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
      <Lightbulb size={120} />
    </div>
    <button onClick={onDismiss} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors z-20">
      <X size={20} />
    </button>
    <div className="relative z-10">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Manual de Boas-vindas</span>
      <h2 className="text-3xl font-black mt-2 mb-8 tracking-tight">Comece a usar o Leciona</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { step: "1", title: "Configuração Inicial", icon: Sliders, desc: "Vá em 'Ajustes' para cadastrar suas Escolas, Calendário Letivo e Turmas." },
          { step: "2", title: "Grade Horária", icon: CalendarClock, desc: "Ainda em 'Ajustes', monte sua grade semanal distribuindo suas turmas." },
          { step: "3", title: "Diário de Classe", icon: BookOpen, desc: "Use o menu 'Diário' para registrar conteúdos e tarefas do dia a dia." },
          { step: "4", title: "Nuvem", icon: ShieldCheck, desc: "Ative a sincronização com o Google Drive na aba 'Geral' dos Ajustes." }
        ].map(item => (
          <div key={item.step} onClick={() => onNavigate('settings')} className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/10 flex flex-col items-start transition-all hover:bg-white/20 cursor-pointer">
            <div className="w-10 h-10 bg-white text-primary rounded-2xl flex items-center justify-center font-black text-sm mb-4 shadow-lg">
              <item.icon size={20} />
            </div>
            <h4 className="font-black text-sm uppercase mb-2 flex items-center gap-2">
              <span className="opacity-40">{item.step}.</span> {item.title}
            </h4>
            <p className="text-[11px] opacity-80 font-medium leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
        <CheckCircle2 size={14} /> Dica: Centralizamos tudo no menu Ajustes para limpar sua visão diária!
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [preSelectedLesson, setPreSelectedLesson] = useState<{ schedule: ScheduleEntry; date: string } | null>(null);
  const [autoShowPendencies, setAutoShowPendencies] = useState(false);
  
  const lastNotifiedSlot = useRef<string>('');
  const { isMobile } = useResponsive();

  // Solicitar permissão de notificação
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    if (data.settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const root = document.documentElement;
    root.style.setProperty('--primary-color', data.settings.themeColor);
    root.style.setProperty('--primary-light', data.settings.themeColor + '15');
    root.style.setProperty('--primary-medium', data.settings.themeColor + '40');
  }, [data]);

  const syncToDrive = useCallback(async (currentData: AppData) => {
    if (!currentData.settings.googleSyncEnabled) return;
    // @ts-ignore
    if (!window.gapi || !window.gapi.client) return;
    setIsSyncing(true);
    try {
      // @ts-ignore
      const response = await window.gapi.client.drive.files.list({ spaces: 'appDataFolder', q: `name = '${DRIVE_FILE_NAME}'`, fields: 'files(id)' });
      const file = response.result.files[0];
      const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json', parents: ['appDataFolder'] };
      const content = JSON.stringify(currentData);
      const boundary = '-------314159265358979323846';
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
      if (file) {
        // @ts-ignore
        await window.gapi.client.request({ path: `/upload/drive/v3/files/${file.id}`, method: 'PATCH', params: { uploadType: 'multipart' }, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: body });
      } else {
        // @ts-ignore
        await window.gapi.client.request({ path: '/upload/drive/v3/files', method: 'POST', params: { uploadType: 'multipart' }, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: body });
      }
      setData(prev => ({ ...prev, settings: { ...prev.settings, lastSyncAt: new Date().toISOString() } }));
    } catch (error) { console.error('Erro na sincronização:', error); } finally { setIsSyncing(false); }
  }, []);

  const updateData = (newData: Partial<AppData>) => {
    setData(prev => {
      const updated = { ...prev, ...newData };
      if (updated.settings.googleSyncEnabled) { setTimeout(() => syncToDrive(updated), 3000); }
      return updated;
    });
  };

  const handleNavigateToPendencies = () => {
    setAutoShowPendencies(true);
    setActiveTab('lessons');
  };

  useEffect(() => {
    const checkContentAlerts = () => {
      if (!data.settings.alertAfterLesson && !data.settings.alertAfterShift) return;
      const nowMins = getCurrentTimeInMinutes();
      const today = new Date().getDay() as DayOfWeek;
      const todayStr = new Date().toISOString().split('T')[0];
      data.schedules.forEach(s => {
        if (Number(s.dayOfWeek) !== today || s.classId === 'window') return;
        const school = data.schools.find(sc => sc.id === s.schoolId);
        const shift = school?.shifts.find(sh => sh.id === s.shiftId);
        const slot = shift?.slots.find(sl => sl.id === s.slotId);
        if (!slot) return;
        const endMins = parseTimeToMinutes(slot.endTime);
        const triggerMins = endMins - data.settings.alertBeforeMinutes;
        if (data.settings.alertAfterLesson && nowMins >= triggerMins && nowMins < endMins + 5) {
          const slotKey = `${todayStr}-${s.slotId}`;
          if (lastNotifiedSlot.current !== slotKey) {
            const hasLog = data.logs.some(l => l.date.startsWith(todayStr) && l.slotId === s.slotId);
            if (!hasLog) {
              lastNotifiedSlot.current = slotKey;
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Leciona: Registro de Aula", { body: `A aula de ${s.classId} (${school?.name}) está terminando. Registre o conteúdo!`, });
              }
            }
          }
        }
      });
    };
    const interval = setInterval(checkContentAlerts, 60000);
    return () => clearInterval(interval);
  }, [data]);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'lessons', label: 'Diário de Classe', icon: BookOpen },
    { id: 'assessments', label: 'Provas', icon: FileCheck },
    { id: 'reminders', label: 'Lembretes', icon: Lightbulb },
    ...(data.settings.isPrivateTeacher ? [{ id: 'students', label: 'Alunos', icon: Users }] : []),
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className={`flex flex-col md:flex-row min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-slate-950`}>
      <style>{`
        :root {
          --primary-color: ${data.settings.themeColor};
          --primary-light: ${data.settings.themeColor}15;
          --primary-medium: ${data.settings.themeColor}40;
        }
        .text-primary { color: var(--primary-color); }
        .bg-primary { background-color: var(--primary-color); }
        .border-primary { border-color: var(--primary-color); }
        .bg-primary-light { background-color: var(--primary-light); }
        .ring-primary { --tw-ring-color: var(--primary-color); }
      `}</style>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50 flex justify-around p-2 overflow-x-auto custom-scrollbar">
        {navItems.map(item => (
          <button key={item.id} onClick={() => { setActiveTab(item.id); if (item.id !== 'lessons') setPreSelectedLesson(null); }} className={`flex flex-col items-center p-2 min-w-[60px] transition-colors ${activeTab === item.id ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
            <item.icon size={20} />
            <span className="text-[10px] mt-1 font-bold">{item.label}</span>
          </button>
        ))}
      </nav>

      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-800 min-h-screen sticky top-0 transition-colors">
        <div className="p-6">
          <h1 className="text-2xl font-black text-primary flex items-center gap-2 tracking-tight">
            <BookOpen className="text-primary" /> Leciona
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); if (item.id !== 'lessons') setPreSelectedLesson(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-primary-light text-primary font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <item.icon size={20} />
              <span className="text-[11px] font-bold tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t dark:border-slate-800">
           <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-400 transition-colors">
             <div className="flex items-center gap-2 overflow-hidden">
               <div className={`w-2 h-2 rounded-full shrink-0 ${data.settings.googleSyncEnabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
               <span className="truncate font-black tracking-tighter">{data.profile.name || 'Docente'}</span>
             </div>
             {isSyncing && <Cloud className="animate-bounce text-primary" size={14} />}
           </div>
        </div>
      </aside>

      <main className="flex-1 pb-24 md:pb-0">
        <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40 transition-colors">
          <h2 className="text-xl font-black text-slate-800 dark:text-white">{navItems.find(i => i.id === activeTab)?.label}</h2>
          {data.settings.googleSyncEnabled && (
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {isSyncing ? 'Sincronizando...' : `Nuvem: ${data.settings.lastSyncAt ? new Date(data.settings.lastSyncAt).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '--:--'}`}
            </div>
          )}
        </header>

        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Suspense fallback={<LoadingSpinner />}>
            {activeTab === 'dashboard' && (
              <>
                {data.settings.showQuickStartGuide && (
                  <QuickStartGuide onDismiss={() => updateData({ settings: { ...data.settings, showQuickStartGuide: false }})} onNavigate={setActiveTab} />
                )}
                <Dashboard 
                  data={data} 
                  onUpdateData={updateData} 
                  onNavigateToLesson={(s, d) => { setPreSelectedLesson({ schedule: s, date: d }); setActiveTab('lessons'); }} 
                  onNavigateToReminders={() => setActiveTab('reminders')}
                  onNavigateToPendencies={handleNavigateToPendencies}
                />
              </>
            )}
            {activeTab === 'students' && <StudentManagement data={data} onUpdateData={updateData} />}
            {activeTab === 'agenda' && <AgendaManagement data={data} onUpdateData={updateData} />}
            {activeTab === 'reminders' && <ReminderManagement data={data} onUpdateData={updateData} />}
            {activeTab === 'lessons' && (
              <LessonLogger 
                data={data} 
                onUpdateData={updateData} 
                initialLessonData={preSelectedLesson} 
                onClearInitialLesson={() => setPreSelectedLesson(null)} 
                defaultShowPendencies={autoShowPendencies}
                onClearShowPendencies={() => setAutoShowPendencies(false)}
              />
            )}
            {activeTab === 'assessments' && <AssessmentManagement data={data} onUpdateData={updateData} />}
            {activeTab === 'settings' && <SettingsPanel data={data} onUpdateData={updateData} onSyncNow={() => syncToDrive(data)} />}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default App;
