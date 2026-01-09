
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, LessonLog, ScheduleEntry, TimeSlot, School, DayOfWeek, Student, Term } from '../types';
import { 
  History, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  CalendarDays, 
  Search, 
  Filter, 
  AlertTriangle, 
  Palmtree, 
  ArrowRight, 
  Coffee, 
  PlayCircle, 
  CalendarRange 
} from 'lucide-react';
import { DAYS_OF_WEEK_NAMES } from '../constants';
import { parseTimeToMinutes, getCurrentTimeInMinutes, getHolidayName, isHoliday } from '../utils';

interface LessonLoggerProps {
  data: AppData;
  onUpdateData: (newData: Partial<AppData>) => void;
  initialLessonData?: { schedule: ScheduleEntry; date: string } | null;
  onClearInitialLesson: () => void;
  defaultShowPendencies?: boolean;
  onClearShowPendencies?: () => void;
}

type ViewMode = 'day' | 'registered' | 'future';

const LessonLogger: React.FC<LessonLoggerProps> = ({ 
  data, 
  onUpdateData, 
  initialLessonData, 
  onClearInitialLesson,
  defaultShowPendencies,
  onClearShowPendencies
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentTime, setCurrentTime] = useState(getCurrentTimeInMinutes());
  
  const getYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState(getYYYYMMDD(new Date()));
  const [activeLesson, setActiveLesson] = useState<{ schedule: ScheduleEntry, institution: School | Student, slot: TimeSlot, date: string, type: 'school' | 'private' } | null>(null);
  const [logForm, setLogForm] = useState({ subject: '', homework: '', notes: '' });
  const [showPendencies, setShowPendencies] = useState(false);
  
  // Estados de Filtro
  const [filterInstId, setFilterInstId] = useState<string>('all');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterPeriodIdx, setFilterPeriodIdx] = useState<string>('all');

  // Atualiza o relógio a cada minuto para o destaque da aula atual
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getCurrentTimeInMinutes()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialLessonData) {
      handleOpenLog(initialLessonData.schedule, initialLessonData.date);
      onClearInitialLesson();
    }
  }, [initialLessonData]);

  useEffect(() => {
    if (defaultShowPendencies) {
      setShowPendencies(true);
      if (onClearShowPendencies) onClearShowPendencies();
    }
  }, [defaultShowPendencies]);

  const availableInstitutions = useMemo(() => {
    return [
      ...data.schools.map(s => ({ id: s.id, name: s.name, color: s.color, type: 'school' as const })),
      ...(data.settings.isPrivateTeacher ? data.students.map(st => ({ id: st.id, name: st.name, color: st.color, type: 'private' as const })) : [])
    ];
  }, [data.schools, data.students, data.settings.isPrivateTeacher]);

  const availableClasses = useMemo(() => {
    if (filterInstId === 'all') {
      return Array.from(new Set([...data.schools.flatMap(s => s.classes), ...data.students.map(st => st.name)]));
    }
    const school = data.schools.find(s => s.id === filterInstId);
    if (school) return school.classes;
    const student = data.students.find(st => st.id === filterInstId);
    if (student) return [student.name];
    return [];
  }, [data.schools, data.students, filterInstId]);

  const periodOptions = useMemo(() => {
    if (filterInstId === 'all') return [];
    const calendar = data.calendars.find(c => c.schoolId === filterInstId);
    if (!calendar) return [];
    return calendar.terms.map((t, idx) => ({ label: t.name, value: idx.toString() }));
  }, [data.calendars, filterInstId]);

  const isLessonBlocked = (dateStr: string, schoolId: string, shiftId?: string, classId?: string) => {
    const calendar = data.calendars.find(c => c.schoolId === schoolId);
    if (calendar) {
      if (calendar.midYearBreak.start && dateStr >= calendar.midYearBreak.start && dateStr <= calendar.midYearBreak.end) return true;
      if (calendar.extraRecesses?.some(r => r.date === dateStr)) return true;
    }

    const events = data.events.filter(e => e.schoolId === schoolId && e.date.startsWith(dateStr) && e.blocksClasses);
    for (const event of events) {
      if (!event.slotId && !event.classId) return true;
      if (event.slotId && event.slotId === shiftId) return true;
      if (event.classId && event.classId === classId) return true;
    }
    return false;
  };

  const pendingLessons = useMemo(() => {
    const pendencies: any[] = [];
    const now = new Date();
    const todayStr = getYYYYMMDD(now);
    
    // Look back 300 days (covers the full academic year)
    for (let i = 0; i < 300; i++) {
      const checkDate = new Date();
      checkDate.setDate(now.getDate() - i);
      const dateStr = getYYYYMMDD(checkDate);
      const dayOfWeek = checkDate.getDay() as DayOfWeek;

      // STRICT CHECK: Don't allow future dates in pending list
      if (dateStr > todayStr) continue;
      if (isHoliday(checkDate)) continue;

      data.schedules.filter(s => Number(s.dayOfWeek) === dayOfWeek && s.classId !== 'window').forEach(s => {
        if (isLessonBlocked(dateStr, s.schoolId, s.shiftId, s.classId)) return;
        
        const calendar = data.calendars.find(c => c.schoolId === s.schoolId);
        // CRITICAL CHECK: Ignore if date is before start of academic year
        if (calendar) {
          if (calendar.start && dateStr < calendar.start) return;
          if (calendar.end && dateStr > calendar.end) return;
        }

        const school = data.schools.find(sc => sc.id === s.schoolId);
        if (!school) return;
        const slot = school.shifts.find(sh => sh.id === s.shiftId)?.slots.find(sl => sl.id === s.slotId);
        if (!slot || slot.type === 'break') return;

        // Strict logic: it's a pendency if it's strictly in the past OR it's today and the lesson end time has passed.
        let isPast = false;
        if (dateStr < todayStr) {
          isPast = true;
        } else if (dateStr === todayStr) {
          isPast = currentTime >= parseTimeToMinutes(slot.endTime);
        }
        
        if (isPast && !data.logs.some(l => l.date.startsWith(dateStr) && l.slotId === s.slotId && l.schoolId === s.schoolId)) {
          pendencies.push({ schedule: s, date: dateStr, institution: school, slot, type: 'school' });
        }
      });

      if (data.settings.isPrivateTeacher) {
        data.students.forEach(st => {
          if (dateStr < st.startDate) return;
          if (isLessonBlocked(dateStr, st.id)) return;

          st.schedules.filter(ps => Number(ps.dayOfWeek) === dayOfWeek).forEach(ps => {
            let isPast = false;
            if (dateStr < todayStr) {
              isPast = true;
            } else if (dateStr === todayStr) {
              isPast = currentTime >= parseTimeToMinutes(ps.endTime);
            }

            if (isPast && !data.logs.some(l => l.date.startsWith(dateStr) && l.slotId === ps.id && l.studentId === st.id)) {
              pendencies.push({ 
                schedule: { dayOfWeek, schoolId: st.id, shiftId: 'private', slotId: ps.id, classId: st.name }, 
                date: dateStr, institution: st, slot: { id: ps.id, label: 'Aula Particular', startTime: ps.startTime, endTime: ps.endTime }, type: 'private' 
              });
            }
          });
        });
      }
    }
    return pendencies.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.schedules, data.logs, data.schools, data.students, data.events, data.calendars, currentTime]);

  const stats = useMemo(() => {
    let totalPastPlanned = 0, loggedPast = 0, totalGeneralPlanned = 0, loggedFuture = 0;
    const now = new Date();
    const todayStr = getYYYYMMDD(now);

    const activeTerm = filterInstId !== 'all' && filterPeriodIdx !== 'all' 
      ? data.calendars.find(c => c.schoolId === filterInstId)?.terms[Number(filterPeriodIdx)] 
      : null;

    for (let i = -180; i < 180; i++) {
      const checkDate = new Date();
      checkDate.setDate(now.getDate() + i);
      const dateStr = getYYYYMMDD(checkDate);
      const dayOfWeek = checkDate.getDay() as DayOfWeek;

      if (isHoliday(checkDate)) continue;
      if (activeTerm && (dateStr < activeTerm.start || dateStr > activeTerm.end)) continue;

      data.schedules.filter(s => Number(s.dayOfWeek) === dayOfWeek && s.classId !== 'window').forEach(s => {
        if (filterInstId !== 'all' && s.schoolId !== filterInstId) return;
        if (filterClassId !== 'all' && s.classId !== filterClassId) return;
        if (isLessonBlocked(dateStr, s.schoolId, s.shiftId, s.classId)) return;
        
        const school = data.schools.find(sc => sc.id === s.schoolId);
        const slot = school?.shifts.find(sh => sh.id === s.shiftId)?.slots.find(sl => sl.id === s.slotId);
        if (!slot) return;

        const calendar = data.calendars.find(c => c.schoolId === s.schoolId);
        // STRICT CHECK FOR STATS TOO
        if (calendar) {
          if (calendar.start && dateStr < calendar.start) return;
          if (calendar.end && dateStr > calendar.end) return;
        }

        totalGeneralPlanned++;
        const hasLog = data.logs.some(l => l.date.startsWith(dateStr) && l.slotId === s.slotId && l.schoolId === s.schoolId);
        const isPast = (dateStr < todayStr) || (dateStr === todayStr && currentTime >= parseTimeToMinutes(slot.endTime));

        if (isPast) { totalPastPlanned++; if (hasLog) loggedPast++; } else if (hasLog) loggedFuture++;
      });

      if (data.settings.isPrivateTeacher) {
        data.students.forEach(st => {
          if (filterInstId !== 'all' && st.id !== filterInstId) return;
          if (filterClassId !== 'all' && st.name !== filterClassId) return;
          if (dateStr < st.startDate) return;
          if (isLessonBlocked(dateStr, st.id)) return;

          st.schedules.filter(ps => Number(ps.dayOfWeek) === dayOfWeek).forEach(ps => {
            totalGeneralPlanned++;
            const hasLog = data.logs.some(l => l.date.startsWith(dateStr) && l.slotId === ps.id && l.studentId === st.id);
            const isPast = (dateStr < todayStr) || (dateStr === todayStr && currentTime >= parseTimeToMinutes(ps.endTime));

            if (isPast) { totalPastPlanned++; if (hasLog) loggedPast++; } else if (hasLog) loggedFuture++;
          });
        });
      }
    }
    return { totalPastPlanned, loggedPast, totalGeneralPlanned, loggedFuture };
  }, [data.schedules, data.logs, filterInstId, filterClassId, filterPeriodIdx, data.calendars, data.students, data.events, currentTime]);

  const lastLessonInfo = useMemo(() => {
    if (!activeLesson) return null;
    const classId = activeLesson.type === 'school' ? activeLesson.schedule.classId : activeLesson.institution.name;
    const instId = activeLesson.institution.id;
    const currentFullTime = `${activeLesson.date}T${activeLesson.slot.startTime}:00`;

    return data.logs
      .filter(l => 
        l.classId === classId && 
        (l.schoolId === instId || l.studentId === instId) &&
        new Date(l.date).getTime() < new Date(currentFullTime).getTime()
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [activeLesson, data.logs]);

  const renderMiniCalendar = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const days = [];
    
    const activeTerm = filterInstId !== 'all' && filterPeriodIdx !== 'all' 
      ? data.calendars.find(c => c.schoolId === filterInstId)?.terms[Number(filterPeriodIdx)] 
      : null;

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= lastDay; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = dObj.getDay() as DayOfWeek;
      const holidayName = getHolidayName(dObj);
      
      const isBlocked = filterInstId !== 'all' ? isLessonBlocked(dateStr, filterInstId) : false;
      const isWithinFilteredTerm = !activeTerm || (dateStr >= activeTerm.start && dateStr <= activeTerm.end);

      const hasFilteredSchedule = isWithinFilteredTerm && (
        data.schedules.some(s => Number(s.dayOfWeek) === dayOfWeek && s.classId !== 'window' && (filterInstId === 'all' || s.schoolId === filterInstId) && (filterClassId === 'all' || s.classId === filterClassId) && !isLessonBlocked(dateStr, s.schoolId, s.shiftId, s.classId)) || 
        (data.settings.isPrivateTeacher && data.students.some(st => (filterInstId === 'all' || st.id === filterInstId) && (filterClassId === 'all' || st.name === filterClassId) && dateStr >= st.startDate && st.schedules.some(ps => Number(ps.dayOfWeek) === dayOfWeek) && !isLessonBlocked(dateStr, st.id)))
      ) && !isBlocked && !holidayName;

      days.push({ day: i, dateStr, isBlocked, holidayName, hasFilteredSchedule });
    }

    return (
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[28px] border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95">
        <h4 className="font-black uppercase text-[9px] mb-4 text-center">{baseDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h4>
        <div className="grid grid-cols-7 gap-1">
          {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="text-center text-[7px] font-black text-slate-300">{d}</div>)}
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            let bg = 'bg-slate-50 dark:bg-slate-800/50';
            if (d.holidayName || d.isBlocked) bg = 'bg-pink-100 dark:bg-pink-900/30';
            else if (d.hasFilteredSchedule) bg = 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-100';
            if (selectedDate === d.dateStr) bg = 'bg-primary scale-110 z-10';

            return (
              <button key={i} onClick={() => { setSelectedDate(d.dateStr); setViewMode('day'); }} className={`aspect-square rounded-lg flex items-center justify-center relative transition-all ${bg}`}>
                <span className={`text-[9px] font-black ${selectedDate === d.dateStr ? 'text-white' : d.holidayName ? 'text-pink-600' : 'text-slate-500'}`}>{d.day}</span>
                {d.hasFilteredSchedule && selectedDate !== d.dateStr && <div className="absolute top-1 right-1 w-1 h-1 bg-blue-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleOpenLog = (schedule: ScheduleEntry, date: string) => {
    const dObj = new Date(date + 'T00:00:00');
    // Allow opening logs for future dates (Planning Mode) unless blocked
    if (isHoliday(dObj) || isLessonBlocked(date, schedule.schoolId, schedule.shiftId, schedule.classId)) return;
    const inst = data.schools.find(s => s.id === schedule.schoolId) || data.students.find(st => st.id === schedule.schoolId);
    if (!inst) return;
    let slot: TimeSlot | undefined;
    if ('shifts' in inst) slot = inst.shifts.find(sh => sh.id === schedule.shiftId)?.slots.find(sl => sl.id === schedule.slotId);
    else { const ps = (inst as Student).schedules.find(s => s.id === schedule.slotId); if (ps) slot = { id: ps.id, startTime: ps.startTime, endTime: ps.endTime, label: 'Aula Particular', type: 'class' }; }
    if (slot) {
      const ex = data.logs.find(l => l.date.startsWith(date) && (l.schoolId === schedule.schoolId || l.studentId === schedule.schoolId) && l.slotId === schedule.slotId);
      setActiveLesson({ schedule, institution: inst, slot, date, type: 'shifts' in inst ? 'school' : 'private' });
      setLogForm({ subject: ex?.subject || '', homework: ex?.homework || '', notes: ex?.notes || '' });
    }
  };

  const integratedPanoramicColumns = useMemo(() => {
    const dObj = new Date(selectedDate + 'T00:00:00');
    const day = dObj.getDay() as DayOfWeek;
    const isToday = selectedDate === getYYYYMMDD(new Date());
    
    // Structure: Group by Shift Name (Matutino/Vespertino/Noturno), then list all relevant items chronologically
    const groupedShifts: Record<string, Array<{ 
      schedule?: ScheduleEntry; 
      inst: any; 
      slot: TimeSlot; 
      log: any; 
      label: string; 
      isWindow?: boolean; 
      isFree?: boolean; 
      startTimeMin: number;
      endTimeMin: number;
      isActive: boolean;
    }>> = {};

    data.schools.forEach(school => {
      school.shifts.forEach(shift => {
        shift.slots.forEach(slot => {
          const schedule = data.schedules.find(s => 
            Number(s.dayOfWeek) === day && 
            s.schoolId === school.id && 
            s.shiftId === shift.id && 
            s.slotId === slot.id
          );

          if (!schedule) return; 

          const log = data.logs.find(l => l.date.startsWith(selectedDate) && l.schoolId === school.id && l.slotId === slot.id);
          
          let displayLabel = slot.label;
          let isWindow = false;
          let isFree = false;

          if (schedule.classId === 'window') {
            displayLabel = 'Janela';
            isWindow = true;
          } else {
            displayLabel = schedule.classId;
          }

          const startMin = parseTimeToMinutes(slot.startTime);
          const endMin = parseTimeToMinutes(slot.endTime);
          const isActive = isToday && currentTime >= startMin && currentTime < endMin;

          if (!groupedShifts[shift.name]) groupedShifts[shift.name] = [];
          groupedShifts[shift.name].push({
            schedule,
            inst: school,
            slot,
            log,
            label: displayLabel,
            isWindow,
            isFree,
            startTimeMin: startMin,
            endTimeMin: endMin,
            isActive
          });
        });
      });
    });

    if (data.settings.isPrivateTeacher) {
      data.students.forEach(st => {
        if (selectedDate < st.startDate) return;
        if (isLessonBlocked(selectedDate, st.id)) return;

        st.schedules.filter(ps => Number(ps.dayOfWeek) === day).forEach(ps => {
          const slot = { id: ps.id, startTime: ps.startTime, endTime: ps.endTime, label: 'Aula Particular', type: 'class' as const };
          const log = data.logs.find(l => l.date.startsWith(selectedDate) && l.studentId === st.id && l.slotId === ps.id);
          
          // Determine shift based on time for private students
          const startMin = parseTimeToMinutes(ps.startTime);
          const endMin = parseTimeToMinutes(ps.endTime);
          let shiftName = 'Particular';
          if (startMin < 720) shiftName = 'Matutino';
          else if (startMin < 1080) shiftName = 'Vespertino';
          else shiftName = 'Noturno';

          const isActive = isToday && currentTime >= startMin && currentTime < endMin;

          if (!groupedShifts[shiftName]) groupedShifts[shiftName] = [];
          groupedShifts[shiftName].push({ 
            schedule: { dayOfWeek: day, schoolId: st.id, shiftId: 'private', slotId: ps.id, classId: st.name }, 
            inst: st, 
            slot, 
            log,
            label: st.name,
            startTimeMin: startMin,
            endTimeMin: endMin,
            isActive
          });
        });
      });
    }

    // Sort items within each shift by start time
    Object.keys(groupedShifts).forEach(key => {
      groupedShifts[key].sort((a, b) => a.startTimeMin - b.startTimeMin);
    });

    // Custom sort order for shift keys
    const sortedKeys = Object.keys(groupedShifts).sort((a, b) => {
      const order: Record<string, number> = { 'Matutino': 1, 'Vespertino': 2, 'Noturno': 3, 'Particular': 4 };
      return (order[a] || 99) - (order[b] || 99);
    });

    return { groupedShifts, sortedKeys };
  }, [data.schools, data.schedules, data.students, data.logs, selectedDate, currentTime]);

  const isFutureDate = selectedDate > getYYYYMMDD(new Date());

  if (activeLesson) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-10 bg-white dark:bg-slate-900 rounded-[48px] shadow-xl border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-4">
        <button onClick={() => setActiveLesson(null)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-8"><ArrowLeft size={16}/> Voltar</button>
        <div className="flex items-center gap-6 mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg" style={{ backgroundColor: activeLesson.institution.color }}>{activeLesson.institution.name[0]}</div>
          <div>
            <h3 className="text-2xl font-black uppercase">{activeLesson.type === 'school' ? activeLesson.schedule.classId : activeLesson.institution.name}</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{activeLesson.institution.name} • {new Date(activeLesson.date + 'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'long'})}</p>
          </div>
        </div>

        {lastLessonInfo && (
          <div className="mb-8 p-6 rounded-[32px] border border-primary/20 bg-primary-light" style={{ backgroundColor: 'var(--primary-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Retrospectiva da última aula</span>
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic mb-2">"{lastLessonInfo.subject}"</p>
            <div className="flex gap-4">
               {lastLessonInfo.homework && <div className="text-[9px] font-black text-slate-400 uppercase">Tarefa: {lastLessonInfo.homework}</div>}
               <div className="text-[9px] font-black text-slate-400 uppercase">Em: {new Date(lastLessonInfo.date).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Conteúdo da Aula {isFutureDate && <span className="text-primary">(Planejamento)</span>}</label>
            <textarea value={logForm.subject} onChange={e => setLogForm({...logForm, subject: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-3xl p-6 font-bold dark:text-white focus:ring-2 focus:ring-primary outline-none" placeholder={isFutureDate ? "Planeje o conteúdo desta aula..." : "O que foi trabalhado hoje?"} rows={4} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Tarefa de Casa</label>
              <input value={logForm.homework} onChange={e => setLogForm({...logForm, homework: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-white focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: Exercícios pág. 42" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Notas Extras</label>
              <input value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold dark:text-white focus:ring-2 focus:ring-primary outline-none" placeholder="Observações..." />
            </div>
          </div>
          <button onClick={() => {
            // Se já existe um log para esta aula, atualiza. Senão, cria novo.
            // Para não duplicar, removemos o antigo primeiro.
            const newLog: LessonLog = { 
               id: crypto.randomUUID(), 
               date: new Date(activeLesson.date + 'T00:00:00').toISOString(), 
               schoolId: activeLesson.type === 'school' ? activeLesson.institution.id : '', 
               studentId: activeLesson.type === 'private' ? activeLesson.institution.id : '', 
               classId: activeLesson.type === 'school' ? activeLesson.schedule.classId : activeLesson.institution.name, 
               slotId: activeLesson.slot.id, 
               ...logForm 
            };
            const fl = data.logs.filter(l => !(l.date.startsWith(activeLesson.date) && (l.schoolId === activeLesson.institution.id || l.studentId === activeLesson.institution.id) && l.slotId === activeLesson.slot.id));
            onUpdateData({ logs: [...fl, newLog] }); setActiveLesson(null);
          }} className="w-full py-5 bg-primary text-white rounded-[32px] font-black uppercase text-xs tracking-widest shadow-xl mt-4">Salvar Registro</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {pendingLessons.length > 0 && (
        <button onClick={() => setShowPendencies(!showPendencies)} className={`w-full flex items-center justify-between p-5 rounded-[28px] border-2 transition-all shadow-md hover:shadow-lg ${showPendencies ? 'bg-red-600 text-white border-red-700' : 'bg-white dark:bg-slate-900 border-red-100 dark:border-red-900/30'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${showPendencies ? 'bg-white/20' : 'bg-red-50 dark:bg-red-900/40 text-red-600'}`}>
              <AlertTriangle size={24}/>
            </div>
            <div className="text-left">
              <span className={`text-[10px] font-black uppercase block mb-1 ${showPendencies ? 'text-white/80' : 'text-slate-400'}`}>Atenção Necessária</span>
              <p className={`text-sm font-black uppercase ${showPendencies ? 'text-white' : 'text-red-600'}`}>Você tem {pendingLessons.length} registros pendentes.</p>
            </div>
          </div>
          <ChevronRight className={`transition-transform ${showPendencies ? 'rotate-90' : 'text-slate-300'}`} />
        </button>
      )}
      
      {showPendencies && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
           {pendingLessons.map((item, idx) => (
             <button key={idx} onClick={() => handleOpenLog(item.schedule, item.date)} className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 border-2 border-red-50 dark:border-red-900/10 rounded-[32px] text-left hover:border-red-200 transition-colors group">
                <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center bg-red-50 text-red-600 shrink-0 group-hover:bg-red-100 transition-colors">
                  <span className="text-[8px] font-black">{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  <AlertCircle size={16} />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-black uppercase truncate text-slate-800 dark:text-white">{item.schedule.classId}</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{item.institution.name}</p>
                  <p className="text-[8px] text-red-500 font-bold uppercase mt-1">Pendente</p>
                </div>
             </button>
           ))}
        </div>
      )}

      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm w-full overflow-hidden">
        {[{ id: 'day', label: 'Diário', icon: History }, { id: 'registered', label: 'Histórico', icon: CheckCircle2 }, { id: 'future', label: 'Planejamento', icon: CalendarDays }].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${viewMode === tab.id ? 'bg-primary text-white shadow-lg' : 'text-slate-400'}`}><tab.icon size={14} /> {tab.label}</button>
        ))}
      </div>

      {viewMode !== 'day' && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
             <select value={filterInstId} onChange={e => { setFilterInstId(e.target.value); setFilterClassId('all'); setFilterPeriodIdx('all'); }} className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-[10px] font-black uppercase dark:text-white outline-none cursor-pointer">
               <option value="all">Todas Instituições</option>
               {availableInstitutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
             </select>
             <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-[10px] font-black uppercase dark:text-white outline-none cursor-pointer">
               <option value="all">Todas as Turmas</option>
               {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select value={filterPeriodIdx} onChange={e => setFilterPeriodIdx(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-[10px] font-black uppercase dark:text-white outline-none cursor-pointer">
               <option value="all">Todos Períodos</option>
               {periodOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
             </select>
           </div>
           <div className="flex justify-center gap-8 pt-4 border-t border-slate-50 dark:border-slate-800">
              <div className="text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Aulas Programadas</p>
                <p className="text-xl font-black text-slate-800 dark:text-white">{stats.totalPastPlanned}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Registradas</p>
                <p className="text-xl font-black text-primary">{stats.loggedPast}</p>
              </div>
           </div>
        </div>
      )}

      <div className="space-y-6">
        {viewMode === 'day' && (
          <div className="overflow-x-auto pb-4 custom-scrollbar">
            {isFutureDate && (
              <div className="mb-6 p-4 rounded-[32px] bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-800 flex flex-col items-center justify-center text-center animate-pulse">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-full mb-2 shadow-sm text-purple-600 dark:text-purple-300">
                   <CalendarRange size={24} />
                </div>
                <h3 className="text-lg font-black uppercase text-purple-700 dark:text-purple-300 tracking-tight">Modo de Planejamento Futuro</h3>
                <p className="text-xs font-bold uppercase text-purple-500/80 mt-1">Você está visualizando o dia {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
            )}
            <div className="flex gap-4 min-w-max md:min-w-full">
              {integratedPanoramicColumns.sortedKeys.length > 0 ? integratedPanoramicColumns.sortedKeys.map(key => (
                <div key={key} className="flex-1 min-w-[260px] space-y-3">
                  <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <Clock size={14} className="text-primary" />
                    <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{key}</h3>
                    <span className="ml-auto text-[8px] font-black bg-white dark:bg-slate-700 text-slate-400 px-2 py-0.5 rounded-lg">
                      {integratedPanoramicColumns.groupedShifts[key].length} Aulas
                    </span>
                  </div>
                  
                  {/* Adicionado p-1 para evitar corte na borda ao escalar */}
                  <div className="space-y-2 p-1">
                    {integratedPanoramicColumns.groupedShifts[key].map((item, idx) => (
                      <button 
                        key={idx} 
                        disabled={item.slot.type === 'break' || item.isFree || item.isWindow}
                        onClick={() => item.schedule && handleOpenLog(item.schedule, selectedDate)} 
                        className={`w-full flex items-center gap-3 p-3 rounded-[24px] border-2 transition-all text-left group ${item.slot.type === 'break' ? 'bg-slate-50 dark:bg-slate-800/20 border-transparent opacity-40' : item.isFree ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60 grayscale' : item.isActive ? 'bg-primary/5 border-primary shadow-lg scale-[1.02] z-10' : item.isWindow ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 shadow-sm' : item.log ? (isFutureDate ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 border-dashed' : 'bg-white dark:bg-slate-900 border-green-100 dark:border-green-900/20') : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 hover:border-blue-100'}`}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shrink-0" style={{ backgroundColor: item.inst.color }}>
                          {item.inst.name[0]}
                        </div>
                        <div className="overflow-hidden flex-1">
                          <div className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <h4 className={`font-black uppercase text-xs truncate leading-tight ${item.isActive ? 'text-primary' : item.isWindow ? 'text-amber-800 dark:text-amber-200' : 'text-slate-800 dark:text-white'}`}>{item.label}</h4>
                                {item.isActive && <span className="flex items-center gap-1 bg-primary text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider"><PlayCircle size={8} fill="currentColor"/> Agora</span>}
                             </div>
                             <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase shrink-0">{item.slot.startTime}</span>
                          </div>
                          
                          {/* Resumo da aula planejada (Visível no card) */}
                          {isFutureDate && item.log && (
                             <div className="mt-1.5 mb-1 px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800">
                                <p className="text-[8px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-tight truncate">Planejado: "{item.log.subject}"</p>
                             </div>
                          )}

                          <div className="flex justify-between items-center mt-1">
                             <div className="flex items-center gap-2">
                               <span className="text-[8px] font-bold text-slate-400 truncate max-w-[80px]">{item.inst.name}</span>
                               <span className="text-[7px] font-black text-slate-300 bg-slate-50 dark:bg-slate-800 px-1.5 rounded uppercase">{idx + 1}ª Aula</span>
                             </div>
                             <div className={`flex items-center gap-1 text-[7px] font-black uppercase ${item.slot.type === 'break' ? 'text-slate-400' : item.isFree ? 'text-slate-400' : item.isWindow ? 'text-amber-600' : item.log ? (isFutureDate ? 'text-purple-500' : 'text-green-500') : 'text-blue-500'}`}>
                                {item.log ? <CheckCircle2 size={10}/> : null} 
                                {item.slot.type === 'break' ? 'Intervalo' : item.isFree ? 'Livre' : item.isWindow ? 'Janela' : item.log ? (isFutureDate ? 'Planejado' : 'OK') : 'Pendente'}
                             </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-20 w-full text-center opacity-40">
                  <Palmtree className="mx-auto mb-2" size={32} />
                  <p className="text-[10px] font-black uppercase">Nenhuma aula cadastrada hoje.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'future' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(() => {
              const activeTerm = filterInstId !== 'all' && filterPeriodIdx !== 'all' 
                ? data.calendars.find(c => c.schoolId === filterInstId)?.terms[Number(filterPeriodIdx)] 
                : null;

              const now = new Date();
              const monthsToShow: Date[] = [];
              
              if (activeTerm && activeTerm.start && activeTerm.end) {
                const startDate = new Date(activeTerm.start + 'T00:00:00');
                const endDate = new Date(activeTerm.end + 'T00:00:00');
                let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                while (cursor <= endDate) {
                  monthsToShow.push(new Date(cursor));
                  cursor.setMonth(cursor.getMonth() + 1);
                }
              } else {
                for(let i=0; i<12; i++) { 
                  monthsToShow.push(new Date(now.getFullYear(), now.getMonth()+i, 1)); 
                }
              }
              return monthsToShow.map((m, idx) => <div key={idx}>{renderMiniCalendar(m)}</div>);
            })()}
          </div>
        )}

        {viewMode === 'registered' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(() => {
              const combined: any[] = [];
              const now = new Date();
              const todayStr = getYYYYMMDD(now);
              const currentMins = getCurrentTimeInMinutes();

              // Increased history lookback to 300 days
              for (let i = 0; i < 300; i++) {
                const checkDate = new Date(); 
                checkDate.setDate(now.getDate() - i); 
                const dateStr = getYYYYMMDD(checkDate); 
                const dayOfWeek = checkDate.getDay() as DayOfWeek;
                
                // STRICT CHECK: Don't show future dates in history
                if (dateStr > todayStr) continue;
                if (isHoliday(checkDate)) continue;

                data.schedules.forEach(s => {
                  if (Number(s.dayOfWeek) !== dayOfWeek || s.classId === 'window') return;
                  if (filterInstId !== 'all' && s.schoolId !== filterInstId) return;
                  if (filterClassId !== 'all' && s.classId !== filterClassId) return;
                  
                  const school = data.schools.find(sc => sc.id === s.schoolId);
                  
                  if (isLessonBlocked(dateStr, s.schoolId, s.shiftId, s.classId)) return;

                  const slot = school?.shifts.find(sh => sh.id === s.shiftId)?.slots.find(sl => sl.id === s.slotId);
                  if (!slot) return;

                  // CHECK CALENDAR VALIDITY
                  const calendar = data.calendars.find(c => c.schoolId === s.schoolId);
                  if (calendar) {
                    // Ignore lessons before start of academic year
                    if (calendar.start && dateStr < calendar.start) return;
                    if (calendar.end && dateStr > calendar.end) return;
                  }

                  // Lógica de "Passado": Data menor que hoje, ou hoje com hora menor que fim da aula
                  let isPast = false;
                  if (dateStr < todayStr) isPast = true;
                  else if (dateStr === todayStr) isPast = currentMins >= parseTimeToMinutes(slot.endTime);

                  // Se não for passado, não mostra no histórico
                  if (!isPast) return;

                  const log = data.logs.find(l => l.date.startsWith(dateStr) && l.slotId === s.slotId && l.schoolId === s.schoolId);
                  combined.push({ schedule: s, log, date: dateStr, institution: school, slot });
                });

                if (data.settings.isPrivateTeacher) {
                  data.students.forEach(st => {
                    if (filterInstId !== 'all' && st.id !== filterInstId) return;
                    if (filterClassId !== 'all' && st.name !== filterClassId) return;
                    if (dateStr < st.startDate) return;
                    if (isLessonBlocked(dateStr, st.id)) return;
                    
                    st.schedules.filter(ps => Number(ps.dayOfWeek) === dayOfWeek).forEach(ps => {
                      let isPast = false;
                      if (dateStr < todayStr) isPast = true;
                      else if (dateStr === todayStr) isPast = currentMins >= parseTimeToMinutes(ps.endTime);

                      if (!isPast) return;

                      const log = data.logs.find(l => l.date.startsWith(dateStr) && l.slotId === ps.id && l.studentId === st.id);
                      combined.push({ 
                        schedule: { dayOfWeek, schoolId: st.id, shiftId: 'private', slotId: ps.id, classId: st.name }, 
                        log, 
                        date: dateStr, 
                        institution: st,
                        slot: { id: ps.id, startTime: ps.startTime, endTime: ps.endTime, label: 'Particular', type: 'class' }
                      });
                    });
                  });
                }
              }
              
              const sorted = combined.sort((a,b) => b.date.localeCompare(a.date));

              if (sorted.length === 0) {
                return (
                  <div className="col-span-full py-20 text-center opacity-40">
                    <History className="mx-auto mb-2" size={32} />
                    <p className="text-[10px] font-black uppercase">Nenhum histórico encontrado para este período.</p>
                  </div>
                );
              }

              return sorted.map((item, idx) => (
                <button key={idx} onClick={() => handleOpenLog(item.schedule as any, item.date)} className={`bg-white dark:bg-slate-900 p-6 rounded-[32px] border-2 transition-all text-left flex items-center gap-5 hover:shadow-lg ${item.log ? 'border-green-100 dark:border-green-900/20' : 'border-red-50 dark:border-red-900/10'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-b-2 shrink-0 ${item.log ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/40' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/40'}`}>
                    <span className="text-[8px] font-black uppercase">{DAYS_OF_WEEK_NAMES[new Date(item.date + 'T00:00:00').getDay() as DayOfWeek].slice(0, 3)}</span>
                    <span className="text-xs font-black">{new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                  <div className="overflow-hidden flex-1">
                    <h4 className="text-sm font-black uppercase truncate text-slate-800 dark:text-white">{item.schedule.classId}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{item.institution?.name}</p>
                    <div className={`mt-2 p-2 rounded-xl text-[10px] font-bold italic truncate ${item.log ? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-red-50/50 dark:bg-red-900/20 text-red-400 dark:text-red-300'}`}>
                      {item.log ? `"${item.log.subject}"` : "⚠ Registro Pendente"}
                    </div>
                  </div>
                </button>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonLogger;
