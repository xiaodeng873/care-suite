# Care Suite

A long-term care facility management system for nursing homes, supporting daily care workflows, health records, and clinical assessments for residents.

## Language

**Facility（院舍）**:
A care home organisation that subscribes to Care Suite. Each Facility has its own Residents, Staff, and data. Multiple Facilities share one Care Suite deployment.
_Avoid_: Client, customer, organisation, tenant

**Resident（院友）**:
A person living in the care facility who receives ongoing nursing care.
_Avoid_: Patient, client

**Care Record（照護記錄）**:
A nursing entry documenting a completed care activity for a Resident. Each record has a type (e.g. patrol round, diaper change, position change, restraint observation).
_Avoid_: Nursing note, activity log

**Care Plan（照護計劃）**:
A pre-defined plan specifying the care a Resident should receive. It prescribes intent; Care Records document execution.
_Avoid_: Care schedule, care template

**Wound（傷口）**:
A clinical case opened when a skin injury is identified on a Resident. It has a lifecycle: opened → assessed periodically → closed (healed or discharged).
_Avoid_: Injury, lesion

**Wound Assessment（傷口評估）**:
A periodic clinical observation recorded against an open Wound, tracking its progression over time.
_Avoid_: Wound record, wound note

**Prescription（處方）**:
A medication order issued by a doctor for a Resident, specifying drug, dosage, and frequency.
_Avoid_: Medication, drug order

**Medication Administration（給藥）**:
The act of a nurse dispensing a drug to a Resident in accordance with a Prescription.
_Avoid_: Dispensing, drug giving

**VMO（訪診醫生）**:
A Visiting Medical Officer — an external doctor who visits the facility on a scheduled basis. Not a full-time staff member.
_Avoid_: Doctor, physician, resident doctor

**VMO Visit（訪診）**:
A scheduled or completed visit by a VMO to the facility. The system tracks both the upcoming schedule and what was done during the visit.
_Avoid_: Appointment, consultation

**Incident Report（事故報告）**:
A record of an unexpected adverse event involving a Resident (e.g. fall, injury, elopement). Single-submission; no approval or follow-up workflow.
_Avoid_: Accident report, incident form

**Admission（入住）**:
The event of a Resident first entering the care facility. Marks the start of the Resident's lifecycle in the system.
_Avoid_: Check-in, enrollment

**Hospital Admission（外出住院）**:
The event of a Resident being transferred to a hospital while remaining an active Resident of the facility. The Resident has not left the facility permanently.
_Avoid_: Transfer out, hospital transfer

**Hospital Discharge（醫院出院返院）**:
The event of a Resident returning to the care facility after a Hospital Admission. Not to be confused with Discharge.
_Avoid_: Return, readmission

**Discharge（離院）**:
The event of a Resident permanently leaving the care facility (e.g. voluntary discharge, death, transfer to another facility).
_Avoid_: Check-out, exit

## Roles

**Developer（開發者）**:
The highest-privilege system role. Has access to all features including code-level changes. Not a facility staff role.
_Avoid_: Super admin, root

**Admin（管理員）**:
A facility operator who can create and delete user accounts and assign permissions to Staff. Cannot modify code.
_Avoid_: Manager, supervisor

**Staff（員工）**:
A care facility employee whose feature access is individually configured by an Admin.
_Avoid_: Nurse, user, worker

**Follow-up（覆診跟進）**:
A pending outpatient appointment or medical follow-up task tied to a specific Resident. Created and tracked by Staff until the appointment is completed.
_Avoid_: Task, to-do, reminder

**Intake & Output Record（出入量記錄）**:
A real-time entry documenting a single fluid intake or output event for a Resident. Intake and Output are two fields within the same form, recorded at the time of each feeding or excretion.
_Avoid_: I&O chart, fluid balance record

## Facility Structure

**Station（護理站）**:
A named zone or ward within the care facility, staffed by a designated nursing team. A facility is divided into multiple Stations.
_Avoid_: Ward, floor, unit, section

**Bed（床位）**:
A physical bed assigned to a Resident within a Station. Identifies the Resident's location in the facility.
_Avoid_: Room, slot, space

## Health Records

**Diagnosis（診斷）**:
A long-term medical condition recorded for a Resident (e.g. diabetes, hypertension). Represents an ongoing state, not a one-time event.
_Avoid_: Illness, condition, disease

**Vaccination（疫苗接種）**:
A one-time record of a vaccine administered to a Resident.
_Avoid_: Immunisation, jab

**Health Checkup（健康檢查）**:
A periodic (typically annual) comprehensive health assessment conducted for a Resident.
_Avoid_: Health assessment, annual review, health check

## Relationships

- A **Resident** has one active **Care Plan** and many **Care Records**
- A **Care Plan** prescribes what should happen; a **Care Record** records what did happen
- A **Wound** belongs to one **Resident** and accumulates many **Wound Assessments** until it is closed
- A **Prescription** is issued by a doctor for a **Resident**; a **Medication Administration** records each time a nurse fulfils it
- A **VMO** has many scheduled **VMO Visits**; each visit records both the schedule and the clinical actions taken
- A **Resident** lifecycle: **Admission** → (optionally **Hospital Admission** ↔ **Hospital Discharge**) → **Discharge**
- **Hospital Discharge** means returning *to* the facility from hospital, not leaving it
- A **Resident** is assigned to one **Bed**, which belongs to one **Station**

## Example dialogue

> **Dev:** "When a **Resident** goes to hospital, do we create a new **Admission** for them when they come back?"
> **Domain expert:** "No — they never had a **Discharge**. We record a **Hospital Admission** when they leave and a **Hospital Discharge** when they return. Their original **Admission** is still active."

> **Dev:** "Should I call this a 'nursing note'?"
> **Domain expert:** "No — use **Care Record**. A Care Record has a type. A patrol round, a diaper change — they're all Care Records."

> **Dev:** "The doctor updated the patient's medication."
> **Domain expert:** "Say **Resident**, not patient. And the doctor issued a new **Prescription** — the nurse will record a **Medication Administration** each time she gives the drug."

## Flagged ambiguities

- "Patient" was used in the database (`patients` table) and some UI labels — resolved: the canonical term is **Resident**. The table name is a legacy artefact.
- "Hospital Discharge" could be mistaken for the Resident leaving the facility permanently — resolved: **Hospital Discharge** = returning *to* the facility; **Discharge** = leaving permanently.
- "Follow-up" was used loosely to mean any task — resolved: **Follow-up** refers specifically to outpatient medical appointments (覆診), not general tasks.
## Relationships

- A **Resident** has one active **Care Plan** and many **Care Records**
- A **Care Plan** prescribes what should happen; a **Care Record** records what did happen
- A **Wound** belongs to one **Resident** and accumulates many **Wound Assessments** until it is closed
- A **Prescription** is issued by a doctor for a **Resident**; a **Medication Administration** records each time a nurse fulfils it
- A **VMO** has many scheduled **VMO Visits**; each visit records both the schedule and the clinical actions taken
- A **Resident** lifecycle: **Admission** → (optionally **Hospital Admission** ↔ **Hospital Discharge**) → **Discharge**
- **Hospital Discharge** means returning *to* the facility from hospital, not leaving it
- A **Resident** is assigned to one **Bed**, which belongs to one **Station**

