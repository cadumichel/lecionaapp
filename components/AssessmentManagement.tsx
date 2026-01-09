
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, SchoolEvent, EventType, TimeSlot, DayOfWeek, LessonLog } from '../types';
import { FileCheck, Calendar, Trash2, AlertTriangle, Plus, X, Layers, Clock, ArrowRight, ChevronRight, School as SchoolIcon } from 'lucide-react';
import { isWeekend, isHoliday, getHolidayName } from '../utils';

interface AssessmentManagementProps {
  data: AppData;
  onUpdateData: (newData: Partial<AppData>) => void;
}

const AssessmentManagement: React.FC<AssessmentManagementProps> = ({ data, onUpdateData }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<SchoolEvent>>({
    type: 'test',
    title: '',
    date: new Date().toISOString().split('T')[0],
    schoolId: data.schools[0]?.id || '',
    classId: '',
    slotId: '',
    description: ''
  });

  const [dateWarning, setDateWarning] = useState('');
  const [isInvalidDate, setIsInvalidDate] = useState(false);

  const activeSchool = useMemo(() => data.schools.find(s => s.id === newEvent.schoolId), [data.schools, newEvent.schoolId]);
  
  const isWithinAnyRecess = (dateStr: string, schoolId: string) => {
    const calendar = data.calendars.find(c => c.schoolId === schoolId);
    if (!calendar) return false;
    if (calendar.midYearBreak.start && dateStr >= calendar.midYearBreak.start && dateStr <= calendar.midYearBreak.end) return true;
    if (calendar.extraRecesses?.some(r => r.date === dateStr)) return true;
    return false;
  };

  const handleDateChange = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    let warning = '';
    let invalid = false;

    // Ajuste 3: Aviso e bloqueio de feriados e recesso
    if (isHoliday(date)) { warning = `Feriado: ${getHolidayName(date)}.`; invalid = true; }
    else if (isWithinAnyRecess(dateStr, newEvent.schoolId!)) { warning = 'Data em período de recesso.'; invalid = true; }
    
    // Verificação adicional de eventos bloqueantes (ex: Evento Escolar que cancela aulas)
    const blockingEvent = data.events.find(e => 
      e.schoolId === newEvent.schoolId && 
      e.date.startsWith(dateStr) && 
      e.blocksClasses &&
      (
        !e.classId || e.classId === newEvent.classId // Bloqueia tudo ou especificamente esta turma
      )
    );

    if (blockingEvent) {
      warning = `Conflito: Evento "${blockingEvent.title}" cancela aulas neste dia.`;
      invalid = true;
    }
    
    setIsInvalidDate(invalid);
    setDateWarning(warning);
    setNewEvent({ ...newEvent, date: dateStr, slotId: '' });
  };

  const handleSaveEvent = () => {
    if (!newEvent.title || !newEvent.classId || !newEvent.slotId || isInvalidDate) return;
    
    const eventId = crypto.randomUUID();
    const event: SchoolEvent = {
      id: eventId,
      title: newEvent.title!,
      date: new Date(newEvent.date + 'T00:00:00').toISOString(),
      schoolId: newEvent.schoolId!,
      classId: newEvent.classId!,
      slotId: newEvent.slotId,
      type: newEvent.type as 'test' | 'work',
      description: newEvent.description || '',
      blocksClasses: false
    };

    // Ajuste 2: Preencher automaticamente o conteúdo da aula (Log)
    const newLog: LessonLog = {
      id: crypto.randomUUID(),
      date: event.date,
      schoolId: event.schoolId,
      classId: event.classId!,
      slotId: event.slotId!,
      subject: `Avaliação: ${event.title}`,
      homework: '',
      notes: event.description || ''
    };

    // Remove log existente se houver para sobrescrever (ou manter a lógica de atualização)
    const filteredLogs = data.logs.filter(l => 
      !(l.date.startsWith(newEvent.date!) && l.schoolId === event.schoolId && l.slotId === event.slotId)
    );

    onUpdateData({ 
      events: [...data.events, event],
      logs: [...filteredLogs, newLog] 
    });

    setIsAdding(false);
    setNewEvent({ ...newEvent, title: '', classId: '', slotId: '', description: '' });
  };

  const restrictedAvailableSlots = useMemo(() => {
    if (!activeSchool || !newEvent.date || !newEvent.classId || isInvalidDate) return [];
    const dateObj = new Date(newEvent.date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const validEntries = data.schedules.filter(s => 
      Number(s.dayOfWeek) === dayOfWeek && 
      s.schoolId === newEvent.schoolId && 
      s.classId === newEvent.classId
    );
    
    const slots: TimeSlot[] = [];
    validEntries.forEach(entry => {
      const shift = activeSchool.shifts.find(sh => sh.id === entry.shiftId);
      const slot = shift?.slots.find(sl => sl.id === entry.slotId);
      if (slot) slots.push(slot);
    });
    return slots;
  }, [activeSchool, newEvent.date, newEvent.classId, data.schedules, isInvalidDate]);

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
             <FileCheck className="text-blue-600" /> Avaliações
          </h3>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Planeje provas, trabalhos e atividades avaliativas.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:brightness-110 transition-all flex items-center gap-2">
           <Plus size={18} /> Nova Avaliação
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black uppercase">Agendar Avaliação</h3><button onClick={() => setIsAdding(false)} className="text-slate-300 hover:text-slate-600"><X /></button></div>
             
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => setNewEvent({...newEvent, type: 'test'})} className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${newEvent.type === 'test' ? 'bg-red-50 border-red-500 text-red-600 shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>Prova</button>
                   <button onClick={() => setNewEvent({...newEvent, type: 'work'})} className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 transition-all ${newEvent.type === 'work' ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-lg' : 'bg-slate-50 border-transparent text-slate-400'}`}>Trabalho</button>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Assunto / Título</label>
                  <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 font-bold dark:text-white" placeholder="Ex: Prova Mensal de História" />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Escola</label>
                     <select value={newEvent.schoolId} onChange={e => setNewEvent({...newEvent, schoolId: e.target.value, classId: '', slotId: ''})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 font-bold dark:text-white">
                        {data.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Turma</label>
                     <select value={newEvent.classId} onChange={e => {
                        setNewEvent({...newEvent, classId: e.target.value, slotId: ''});
                        // Recalcula validação de data ao trocar turma para checar bloqueios específicos
                        if(newEvent.date) handleDateChange(newEvent.date);
                     }} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 font-bold dark:text-white">
                        <option value="">Selecione...</option>
                        {activeSchool?.classes.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Data</label>
                     <input type="date" value={newEvent.date} onChange={e => handleDateChange(e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 font-bold dark:text-white ${isInvalidDate ? 'ring-2 ring-pink-500' : ''}`} />
                     {dateWarning && <p className="text-[9px] text-pink-600 font-black uppercase mt-1 ml-1">{dateWarning}</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Horário (Slot)</label>
                     <select disabled={!newEvent.classId || isInvalidDate} value={newEvent.slotId} onChange={e => setNewEvent({...newEvent, slotId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 font-bold dark:text-white disabled:opacity-50">
                        <option value="">{restrictedAvailableSlots.length > 0 ? 'Escolha o horário...' : 'Nenhum horário disponível'}</option>
                        {restrictedAvailableSlots.map(s => <option key={s.id} value={s.id}>{s.label} ({s.startTime})</option>)}
                     </select>
                   </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Descrição / Observações</label>
                   <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} rows={3} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3 font-bold dark:text-white" placeholder="Capítulos, observações para os alunos..." />
                </div>
             </div>

             <div className="mt-8 flex gap-4">
                <button onClick={() => setIsAdding(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Cancelar</button>
                <button 
                  onClick={handleSaveEvent} 
                  disabled={!newEvent.title || !newEvent.slotId || isInvalidDate} 
                  className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${(!newEvent.title || !newEvent.slotId || isInvalidDate) ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white shadow-xl shadow-blue-100'}`}
                >
                  Salvar Avaliação
                </button>
             </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.events.filter(e => e.type === 'test' || e.type === 'work').sort((a,b) => a.date.localeCompare(b.date)).map(event => {
          const school = data.schools.find(s => s.id === event.schoolId);
          return (
            <div key={event.id} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm relative group hover:shadow-xl transition-all duration-300">
               <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${event.type === 'test' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                     <FileCheck size={22} />
                  </div>
                  <button onClick={() => onUpdateData({ events: data.events.filter(e => e.id !== event.id) })} className="text-slate-200 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
               </div>
               <div className="flex-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase truncate mb-1">{event.title}</h4>
                  <div className="flex items-center gap-2 mb-3">
                     <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase ${event.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {event.type === 'test' ? 'Prova' : 'Trabalho'}
                     </span>
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Turma {event.classId}</span>
                  </div>
                  <div className="space-y-1.5">
                     <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <Calendar size={12} className="text-slate-300" />
                        <span>{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                     </div>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <SchoolIcon size={12} className="text-slate-300" />
                        <span className="truncate">{school?.name}</span>
                     </div>
                  </div>
               </div>
               <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center text-[9px] font-black uppercase text-blue-600">
                  <span>Agendado</span>
                  <ChevronRight size={14} />
               </div>
            </div>
          );
        })}
        {data.events.filter(e => e.type === 'test' || e.type === 'work').length === 0 && (
          <div className="col-span-full py-20 bg-white dark:bg-slate-900 rounded-[48px] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center gap-4 text-center">
             <FileCheck size={48} className="text-slate-100 dark:text-slate-800" />
             <div>
               <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Nenhuma avaliação agendada</p>
               <p className="text-slate-300 text-[10px] uppercase mt-1">Sua grade de avaliações está livre.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentManagement;
