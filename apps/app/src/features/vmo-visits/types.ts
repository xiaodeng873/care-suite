export interface DoctorVisitSchedule {
  id: string;
  visit_date: string;
  doctor_name?: string;
  specialty?: string;
  available_slots: number;
  booked_slots: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}
