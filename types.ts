
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  type: 'class' | 'break';
  label: string;
}

export interface Shift {
  id: string;
  name: string;
  slots: TimeSlot[];
}

export interface School {
  id: string;
  name: string;
  color: string;
  subjects: string[];
  classes: string[];
  shifts: Shift[];
}

export interface PrivateSchedule {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface Student {
  id: string;
  name: string;
  subject: string;
  color: string;
  startDate: string; // Data a partir da qual as aulas são contadas
  schedules: PrivateSchedule[];
}

export interface TeacherProfile {
  title?: 'Prof.' | 'Profª.';
  name: string;
  subjects: string[];
}

export interface ScheduleEntry {
  dayOfWeek: DayOfWeek;
  schoolId: string;
  shiftId: string;
  slotId: string;
  classId: string;
}

export interface LessonLog {
  id: string;
  date: string;
  schoolId: string;
  studentId?: string;
  classId: string;
  slotId: string;
  subject: string;
  homework: string;
  notes: string;
}

export type EventType = 'test' | 'work' | 'meeting' | 'festivity' | 'trip' | 'material' | 'other';

export interface SchoolEvent {
  id: string;
  date: string;
  schoolId: string;
  classId?: string; 
  affectedClassIds?: string[]; 
  slotId?: string;  
  type: EventType;
  title: string;
  description: string;
  blocksClasses: boolean; 
  blocksShift?: boolean; 
}

export interface Term {
  name: string;
  start: string;
  end: string;
}

export interface Recess {
  id: string;
  name: string;
  date: string;
}

export interface AcademicCalendar {
  id: string;
  schoolId: string;
  year: number;
  division: 'bimestres' | 'trimestres';
  terms: Term[];
  midYearBreak: { start: string; end: string };
  extraRecesses: Recess[];
  start: string;
  end: string;
}

export interface Reminder {
  id: string;
  date: string;
  alarmTime?: string;
  alarmTriggered?: boolean;
  category: 'occurrence' | 'observation' | 'topic' | 'general';
  title: string;
  content: string;
  schoolId?: string;
  classId?: string;
  studentId?: string;
}

export interface AppSettings {
  alertBeforeMinutes: number;
  alertAfterLesson: boolean;
  alertAfterShift: boolean;
  isPrivateTeacher: boolean;
  lastSyncAt?: string;
  googleSyncEnabled: boolean;
  showQuickStartGuide: boolean;
  themeColor: string;
  darkMode: boolean;
  showDailyQuote: boolean;
}

export interface AppData {
  profile: TeacherProfile;
  schools: School[];
  students: Student[];
  schedules: ScheduleEntry[];
  logs: LessonLog[];
  events: SchoolEvent[];
  calendars: AcademicCalendar[];
  reminders: Reminder[];
  settings: AppSettings;
}
