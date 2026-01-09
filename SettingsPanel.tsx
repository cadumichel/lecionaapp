
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, AcademicCalendar, Term, Recess } from '../types';
import { 
  Download, User, Briefcase, Calendar as CalendarIcon, ShieldCheck, 
  RefreshCw, LogOut, BookOpen, FileCheck, Palette, Moon, Sun, 
  ChevronDown, AlertTriangle, Lightbulb, Quote, School as SchoolIcon, 
  CalendarClock, GraduationCap, Wand2, Palmtree, CalendarRange, Trash2,
  CheckCircle2, Edit3, Settings
} from 'lucide-react';
import { downloadCSV, downloadICS } from '../utils';
import { QuickStartGuide } from '../App';
import SchoolManagement from './SchoolManagement';
import ScheduleManagement from './ScheduleManagement';
import { GoogleDriveSync } from './GoogleDriveSync';

interface SettingsPanelProps {
  data: AppData;
  onUpdateData: (newData: Partial<AppData>) => void;
  onSyncNow: () => void;
}

const THEME_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#064e3b' },
  { name: 'Verde Claro', value: '#84cc16' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Vinho', value: '#881337' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Preto', value: '#0f172a' },
  { name: 'Amarelo', value: '#facc15' },
];

const SettingsPanel: React.FC<SettingsPanelProps> = ({ data, onUpdateData, onSyncNow }) => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'schools' | 'calendar' | 'schedules'>('general');
  const [filterInstId, setFilterInstId] = useState<string>('all');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estados para Gestão de Calendário (Movido de AgendaManagement)
  const [activeSchoolIdForCal, setActiveSchoolIdForCal] = useState<string>(data.schools[0]?.id || '');
  const schoolCalendar = useMemo(() => data.calendars.find(c => c.schoolId === activeSchoolIdForCal), [data.calendars, activeSchoolIdForCal]);
  const [calForm, setCalForm] = useState<Partial<AcademicCalendar>>({
    division: 'bimestres',
    year: new Date().getFullYear(),
    start: `${new Date().getFullYear()}-02-01`,
    end: `${new Date().getFullYear()}-12-01`,
    terms: [],
    midYearBreak: { start: `${new Date().getFullYear()}-07-01`, end: `${new Date().getFullYear()}-07-31` },
    extraRecesses: []
  });

  const availableInstitutions = useMemo(() => {
    return [
      ...data.schools.map(s => ({ id: s.id, name: s.name })),
      ...data.students.map(st => ({ id: st.id, name: st.name + " (Particular)" }))
    ];
  }, [data.schools, data.students]);

  const availableClasses = useMemo(() => {
    if (filterInstId === 'all') {
      return Array.from(new Set([
        ...data.schools.flatMap(s => s.classes),
        ...data.students.map(st => st.name)
      ]));
    }
    const school = data.schools.find(s => s.id === filterInstId);
    if (school) return school.classes;
    const student = data.students.find(st => st.id === filterInstId);
    if (student) return [student.name];
    return [];
  }, [data.schools, data.students, filterInstId]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onSyncNow();
    setIsSyncing(false);
  };

  const handleExport = (type: 'logs' | 'calendar' | 'assessments') => {
    if (type === 'logs') {
      const logs = data.logs.filter(l => {
        const instId = l.schoolId || l.studentId;
        return (filterInstId === 'all' || instId === filterInstId) && (filterClassId === 'all' || l.classId === filterClassId);
      });
      if (logs.length === 0) return alert('Sem registros para exportar.');
      downloadCSV(logs.map(l => ({
        Data: new Date(l.date).toLocaleDateString('pt-BR'),
        Instituicao: availableInstitutions.find(i => i.id === (l.schoolId || l.studentId))?.name || 'N/A',
        Turma: l.classId,
        Conteudo: l.subject,
        Tarefa: l.homework,
        Notas: l.notes
      })), `diario_aulas_${new Date().toISOString().split('T')[0]}`);
    } else if (type === 'assessments') {
      const assessments = data.events.filter(e => ['test', 'work'].includes(e.type) && (filterInstId === 'all' || e.schoolId === filterInstId));
      downloadCSV(assessments.map(e => ({
        Data: new Date(e.date).toLocaleDateString('pt-BR'),
        Escola: data.schools.find(s => s.id === e.schoolId)?.name || 'N/A',
        Tipo: e.type, Titulo: e.title
      })), `avaliacoes_${new Date().toISOString().split('T')[0]}`);
    } else {
      const evs = data.events.filter(e => (filterInstId === 'all' || e.schoolId === filterInstId));
      downloadICS(evs.map(e => ({ title: e.title, start: e.date, end: e.date, description: e.description })), 'agenda_leciona');
    }
  };

  // Funções de Calendário
  const handleCreateTermsSuggestion = () => {
    if (!calForm.start || !calForm.end) return;
    const division = calForm.division || 'bimestres';
    const s = new Date(calForm.start + 'T00:00:00');
    const e = new Date(calForm.end + 'T00:00:00');
    const totalDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
    const count = division === 'bimestres' ? 4 : 3;
    const daysPerTerm = totalDays / count;
    const terms: Term[] = [];
    for (let i = 0; i < count; i++) {
      const termStart = new Date(s.getTime() + (i * daysPerTerm * 24 * 60 * 60 * 1000));
      const termEnd = new Date(termStart.getTime() + ((daysPerTerm - 1) * 24 * 60 * 60 * 1000));
      terms.push({ 
        name: `${i + 1}º ${division === 'bimestres' ? 'Bimestre' : 'Trimestre'}`, 
        start: termStart.toISOString().split('T')[0], 
        end: termEnd.toISOString().split('T')[0] 
      });
    }
    setCalForm({ ...calForm, terms });
  };

  const addExtraRecess = () => {
    const newRecess: Recess = {
      id: crypto.randomUUID(),
      name: '',
      date: new Date().toISOString().split('T')[0]
    };
    setCalForm({ ...calForm, extraRecesses: [...(calForm.extraRecesses || []), newRecess] });
  };

  const handleSaveCalendar = () => {
    if (!calForm.start || !calForm.end || !activeSchoolIdForCal) return;
    
    // Ensure we create a completely new object reference for the calendar
    const newCal: AcademicCalendar = {
      id: schoolCalendar?.id || crypto.randomUUID(),
      schoolId: activeSchoolIdForCal,
      year: calForm.year || new Date().getFullYear(),
      division: calForm.division as any,
      start: calForm.start,
      end: calForm.end,
      terms: calForm.terms || [],
      midYearBreak: calForm.midYearBreak || { start: '', end: '' },
      extraRecesses: calForm.extraRecesses || []
    };

    // Remove existing calendar for this school if it exists, then add the new one
    const otherCals = data.calendars.filter(c => c.schoolId !== activeSchoolIdForCal);
    onUpdateData({ calendars: [...otherCals, newCal] });
    
    // Feedback de Sucesso
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Garante que o formulário seja populado corretamente ao trocar de aba, mesmo para a primeira escola
  useEffect(() => {
    if (activeSubTab === 'calendar') {
      // Se não houver escola selecionada mas existirem escolas, seleciona a primeira automaticamente
      if (!activeSchoolIdForCal && data.schools.length > 0) {
        setActiveSchoolIdForCal(data.schools[0].id);
      }
    }
  }, [activeSubTab, data.schools, activeSchoolIdForCal]);

  // Carregar dados ao selecionar escola na aba calendario
  useEffect(() => {
    if (activeSubTab === 'calendar') {
      const targetSchoolId = activeSchoolIdForCal || (data.schools.length > 0 ? data.schools[0].id : '');
      const existingCalendar = data.calendars.find(c => c.schoolId === targetSchoolId);

      if (existingCalendar) {
        setCalForm(existingCalendar);
      } else {
        // Reset form if no calendar exists
        const currentYear = new Date().getFullYear();
        setCalForm({
          division: 'bimestres',
          year: currentYear,
          start: `${currentYear}-02-01`,
          end: `${currentYear}-12-01`,
          terms: [],
          midYearBreak: { start: `${currentYear}-07-01`, end: `${currentYear}-07-31` },
          extraRecesses: []
        });
      }
    }
  }, [activeSubTab, activeSchoolIdForCal, data.calendars, data.schools]);

  const tabs = [
    { id: 'general', label: 'Geral', icon: User },
    { id: 'schools', label: 'Escolas', icon: SchoolIcon },
    { id: 'calendar', label: 'Ano Letivo', icon: GraduationCap },
    { id: 'schedules', label: 'Horários', icon: CalendarClock },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {data.settings.showQuickStartGuide && (
        <QuickStartGuide onDismiss={() => onUpdateData({ settings: { ...data.settings, showQuickStartGuide: false }})} onNavigate={() => {}} />
      )}

      {/* Navegação Interna de Ajustes */}
      <div className="flex p-1 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-x-auto custom-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
              activeSubTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'general' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <section className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3 mb-8"><User className="text-primary" /> Perfil Docente</h3>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-32 shrink-0">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tratamento</label>
                    <div className="relative">
                      <select value={data.profile.title || 'Prof.'} onChange={e => onUpdateData({ profile: { ...data.profile, title: e.target.value as any }})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 font-bold appearance-none cursor-pointer dark:text-white"><option value="Prof.">Prof.</option><option value="Profª.">Profª.</option></select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Seu Nome</label>
                    <input type="text" value={data.profile.name} onChange={e => onUpdateData({ profile: { ...data.profile, name: e.target.value }})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold dark:text-white" placeholder="Nome do docente" />
                  </div>
                </div>
                <label className={`flex items-center justify-between p-5 rounded-3xl border transition-all cursor-pointer ${data.settings.isPrivateTeacher ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'}`}>
                   <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.settings.isPrivateTeacher ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}><Briefcase size={20} /></div><div><span className="text-sm font-black uppercase tracking-tight dark:text-white">Professor Particular</span><p className="text-[10px] text-slate-400 font-bold uppercase">Ativa a gestão de alunos individuais.</p></div></div>
                   <input type="checkbox" checked={data.settings.isPrivateTeacher} onChange={e => onUpdateData({ settings: { ...data.settings, isPrivateTeacher: e.target.checked }})} className="w-6 h-6 rounded-lg text-primary" />
                </label>
              </div>
          </section>

          <section className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3 mb-8"><AlertTriangle className="text-amber-500" /> Alertas de Registro</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className={`flex flex-col gap-2 p-5 rounded-3xl border transition-all cursor-pointer ${data.settings.alertAfterLesson ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/40 opacity-60'}`}>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase dark:text-white">Ao final da Aula</span><input type="checkbox" checked={data.settings.alertAfterLesson} onChange={e => onUpdateData({ settings: { ...data.settings, alertAfterLesson: e.target.checked }})} className="w-5 h-5 rounded text-amber-500" /></div>
                 <div className="flex items-center gap-2 mt-2"><span className="text-[9px] font-black text-slate-400">Avisar</span><select value={data.settings.alertBeforeMinutes} onChange={e => onUpdateData({ settings: { ...data.settings, alertBeforeMinutes: parseInt(e.target.value) }})} className="bg-white dark:bg-slate-700 border-none text-[10px] font-black text-amber-600 px-2 py-1 rounded-lg outline-none"><option value="0">Na hora</option><option value="5">5 min antes</option><option value="10">10 min antes</option></select></div>
              </label>
              <label className={`flex flex-col gap-2 p-5 rounded-3xl border transition-all cursor-pointer ${data.settings.alertAfterShift ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/40 opacity-60'}`}>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase dark:text-white">Resumo do Turno</span><input type="checkbox" checked={data.settings.alertAfterShift} onChange={e => onUpdateData({ settings: { ...data.settings, alertAfterShift: e.target.checked }})} className="w-5 h-5 rounded text-amber-500" /></div>
                 <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Notificar pendências ao fim do período.</p>
              </label>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl md:rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
             <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-3">
               <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                 <ShieldCheck className="text-primary" /> Backup em Nuvem
               </h3>
             </div>
             <GoogleDriveSync 
               data={data} 
               onDataRestore={(newData) => onUpdateData(newData)}
               onSyncSuccess={() => console.log('Sincronização realizada com sucesso')}
               onSyncError={(error) => console.error('Erro na sincronização:', error)}
             />
          </section>

          <section className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3 mb-8"><Palette className="text-primary" /> Personalização</h3>
              <div className="space-y-8">
                <div className="flex flex-col gap-4">
                  <label className={`flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer ${data.settings.showDailyQuote ? 'bg-primary/5 border-primary/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.settings.showDailyQuote ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}><Quote size={20} /></div>
                      <div>
                        <span className="text-sm font-black uppercase tracking-tight dark:text-white">Frase Diária no Dashboard</span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Exibe o pensamento do dia na tela inicial.</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={data.settings.showDailyQuote} onChange={e => onUpdateData({ settings: { ...data.settings, showDailyQuote: e.target.checked }})} className="w-6 h-6 rounded-lg text-primary" />
                  </label>

                  <div className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-slate-700 shadow-sm ${data.settings.darkMode ? 'text-primary' : 'text-slate-400'}`}>{data.settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}</div><div><span className="text-sm font-black uppercase tracking-tight dark:text-white">Modo Escuro</span><p className="text-[10px] text-slate-400 font-bold uppercase">Visual mais confortável para a noite.</p></div></div>
                    <button onClick={() => onUpdateData({ settings: { ...data.settings, darkMode: !data.settings.darkMode }})} className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${data.settings.darkMode ? 'bg-primary' : 'bg-slate-300'}`}><div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform transform ${data.settings.darkMode ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                  </div>
                </div>

                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Cor Predominante</label><div className="flex flex-wrap gap-4">{THEME_COLORS.map(color => (<button key={color.value} onClick={() => onUpdateData({ settings: { ...data.settings, themeColor: color.value }})} className={`group relative flex flex-col items-center gap-2`}><div className={`w-12 h-12 rounded-full border-4 transition-all shadow-sm ${data.settings.themeColor === color.value ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: color.value }}/><span className={`text-[8px] font-black uppercase tracking-tighter ${data.settings.themeColor === color.value ? 'text-primary' : 'text-slate-400'}`}>{color.name}</span></button>))}</div></div>
              </div>
          </section>

          <section className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-sm border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3 mb-6"><Download className="text-primary" /> Exportar Dados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <select value={filterInstId} onChange={e => { setFilterInstId(e.target.value); setFilterClassId('all'); }} className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none appearance-none cursor-pointer dark:text-white"><option value="all">Todas Instituições</option>{availableInstitutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-[10px] font-black uppercase outline-none appearance-none cursor-pointer dark:text-white"><option value="all">Todas as Turmas</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={() => handleExport('logs')} className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary transition-all group"><BookOpen className="text-primary group-hover:scale-110" /><span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">Diários (CSV)</span></button>
                <button onClick={() => handleExport('assessments')} className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary transition-all group"><FileCheck className="text-primary group-hover:scale-110" /><span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">Provas (CSV)</span></button>
                <button onClick={() => handleExport('calendar')} className="flex flex-col items-center gap-3 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary transition-all group"><CalendarIcon className="text-primary group-hover:scale-110" /><span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">Agenda (ICS)</span></button>
              </div>
          </section>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[32px] border-2 border-dashed border-blue-200 dark:border-blue-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-left">
               <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-blue-600"><Lightbulb size={24}/></div>
               <div>
                 <span className="text-xs font-black uppercase text-blue-800 dark:text-blue-300 block mb-0.5">Deseja rever as instruções?</span>
                 <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Reative o Guia de Boas-vindas a qualquer momento.</p>
               </div>
            </div>
            <button 
              onClick={() => onUpdateData({ settings: { ...data.settings, showQuickStartGuide: true }})}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100 hover:brightness-110 transition-all whitespace-nowrap"
            >
              Reativar Guia
            </button>
          </div>

          <div className="text-center space-y-2 opacity-30 pb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] dark:text-white">Versão 2.9.0 • Leciona</p>
            <p className="text-[9px] font-bold uppercase tracking-widest dark:text-white">Design & Desenvolvimento: Cadu Michel</p>
          </div>
        </div>
      )}

      {activeSubTab === 'schools' && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <SchoolManagement data={data} onUpdateData={onUpdateData} />
        </div>
      )}

      {activeSubTab === 'schedules' && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <ScheduleManagement data={data} onUpdateData={onUpdateData} />
        </div>
      )}

      {activeSubTab === 'calendar' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          {/* Caixa de Seleção Harmonizada */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-[24px] flex flex-col md:flex-row items-center gap-6 shadow-sm relative overflow-hidden">
             <div className="absolute left-0 top-0 bottom-0 w-2 bg-indigo-500"></div>
             
             <div className="flex items-center gap-4 flex-1 w-full pl-2">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                   <Settings size={20} />
                </div>
                <div className="flex-1">
                   <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Editando Ano Letivo de:</label>
                   <div className="relative">
                      <select 
                        value={activeSchoolIdForCal} 
                        onChange={e => setActiveSchoolIdForCal(e.target.value)} 
                        className="w-full bg-transparent border-none p-0 font-black text-lg text-slate-800 dark:text-white outline-none cursor-pointer appearance-none truncate pr-6"
                      >
                        {data.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                   </div>
                </div>
             </div>

             <button 
                onClick={handleSaveCalendar} 
                className={`w-full md:w-auto h-[48px] px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 ${saveSuccess ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
             >
                {saveSuccess ? <CheckCircle2 size={16} /> : <FileCheck size={16} />}
                {saveSuccess ? 'Salvo!' : 'Salvar Alterações'}
             </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-8">
              <div className="grid md:grid-cols-3 gap-4">
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Ano</label><input type="number" value={calForm.year} onChange={e => setCalForm({...calForm, year: parseInt(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl px-5 py-3 font-bold dark:text-white" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Início das Aulas</label><input type="date" value={calForm.start} onChange={e => setCalForm({...calForm, start: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl px-5 py-3 font-bold dark:text-white" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Término do Ano</label><input type="date" value={calForm.end} onChange={e => setCalForm({...calForm, end: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl px-5 py-3 font-bold dark:text-white" /></div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl flex flex-col md:flex-row md:items-end gap-6">
                 <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Divisão Letiva</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-slate-700 rounded-2xl">
                       <button onClick={() => setCalForm({...calForm, division: 'bimestres'})} className={`py-3 rounded-xl font-black uppercase text-[10px] transition-all ${calForm.division === 'bimestres' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>Bimestres</button>
                       <button onClick={() => setCalForm({...calForm, division: 'trimestres'})} className={`py-3 rounded-xl font-black uppercase text-[10px] transition-all ${calForm.division === 'trimestres' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>Trimestres</button>
                    </div>
                 </div>
                 <button onClick={handleCreateTermsSuggestion} className="h-[52px] px-8 bg-blue-100 text-blue-600 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all"><Wand2 size={16} /> Gerar Períodos</button>
              </div>

              <div className="grid gap-3">
                {calForm.terms?.map((term, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl">
                     <input type="text" value={term.name} onChange={e => { const newTerms = [...calForm.terms!]; newTerms[idx].name = e.target.value; setCalForm({...calForm, terms: newTerms}); }} className="w-full md:w-40 bg-white dark:bg-slate-700 rounded-xl px-4 py-2 font-black text-[10px] uppercase text-blue-600" />
                     <div className="flex gap-2 w-full">
                        <input type="date" value={term.start} onChange={e => { const nt = [...calForm.terms!]; nt[idx].start = e.target.value; setCalForm({...calForm, terms: nt}); }} className="flex-1 bg-white dark:bg-slate-700 rounded-xl px-4 py-2 text-xs font-bold" />
                        <input type="date" value={term.end} onChange={e => { const nt = [...calForm.terms!]; nt[idx].end = e.target.value; setCalForm({...calForm, terms: nt}); }} className="flex-1 bg-white dark:bg-slate-700 rounded-xl px-4 py-2 text-xs font-bold" />
                     </div>
                  </div>
                ))}
              </div>

              <div className="bg-pink-50 dark:bg-pink-900/10 p-6 rounded-3xl border border-pink-100">
                 <h4 className="text-[10px] font-black text-pink-600 uppercase mb-4 flex items-center gap-2"><Palmtree size={14}/> Recesso de Julho</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[8px] font-black uppercase mb-1 ml-1">Início</label><input type="date" value={calForm.midYearBreak?.start} onChange={e => setCalForm({...calForm, midYearBreak: { ...calForm.midYearBreak!, start: e.target.value }})} className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white" /></div>
                    <div><label className="block text-[8px] font-black uppercase mb-1 ml-1">Fim</label><input type="date" value={calForm.midYearBreak?.end} onChange={e => setCalForm({...calForm, midYearBreak: { ...calForm.midYearBreak!, end: e.target.value }})} className="w-full bg-white dark:bg-slate-800 rounded-xl px-4 py-2 text-xs font-bold dark:text-white" /></div>
                 </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl">
                 <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><CalendarRange size={14}/> Recessos Eventuais</h4>
                    <button onClick={addExtraRecess} className="text-[10px] font-black text-blue-600 uppercase">+ Add Dia</button>
                 </div>
                 <div className="space-y-3">
                    {(calForm.extraRecesses || []).map(r => (
                      <div key={r.id} className="flex gap-3 items-center">
                         <input type="text" placeholder="Nome" value={r.name} onChange={e => { const u = calForm.extraRecesses?.map(x => x.id === r.id ? {...x, name: e.target.value} : x); setCalForm({...calForm, extraRecesses: u}); }} className="flex-1 bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-xs font-bold" />
                         <input type="date" value={r.date} onChange={e => { const u = calForm.extraRecesses?.map(x => x.id === r.id ? {...x, date: e.target.value} : x); setCalForm({...calForm, extraRecesses: u}); }} className="bg-white dark:bg-slate-700 rounded-xl px-3 py-2 text-xs font-bold" />
                         <button onClick={() => setCalForm({...calForm, extraRecesses: calForm.extraRecesses?.filter(x => x.id !== r.id)})} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    ))}
                 </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
