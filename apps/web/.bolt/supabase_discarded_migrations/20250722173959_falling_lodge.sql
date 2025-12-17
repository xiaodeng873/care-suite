@@ .. @@
 /*
   # Create patient health tasks table
 
   1. New Tables
     - `patient_health_tasks`
       - `id` (uuid, primary key)
       - `patient_id` (integer, foreign key to 院友主表)
       - `health_record_type` (health_task_type enum)
       - `frequency_unit` (frequency_unit enum)
       - `frequency_value` (integer)
       - `specific_times` (jsonb array)
       - `specific_days_of_week` (jsonb array)
       - `specific_days_of_month` (jsonb array)
       - `last_completed_at` (timestamptz, nullable)
       - `next_due_at` (timestamptz)
-      - `notes` (text, nullable)
+      - `notes` (monitoring_task_notes enum, nullable)
       - `created_at` (timestamptz)
       - `updated_at` (timestamptz)
   2. Security
     - Enable RLS on `patient_health_tasks` table
     - Add policies for authenticated users to manage tasks
   3. Changes
     - Added indexes for performance optimization
     - Added triggers for automatic timestamp updates
+    - Added monitoring_task_notes enum for standardized notes
 */
 
 -- Create health task type enum
 CREATE TYPE health_task_type AS ENUM (
   '生命表徵',
   '血糖控制', 
   '體重控制',
   '約束物品同意書',
   '年度體檢'
 );
 
 -- Create frequency unit enum
 CREATE TYPE frequency_unit AS ENUM (
   'daily',
   'weekly', 
   'monthly'
 );
 
+-- Create monitoring task notes enum
+CREATE TYPE monitoring_task_notes AS ENUM (
+  '服藥前',
+  '注射前',
+  '定期',
+  '特別關顧',
+  '社康'
+);
+
 -- Create patient health tasks table
 CREATE TABLE IF NOT EXISTS patient_health_tasks (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   patient_id integer NOT NULL,
   health_record_type health_task_type NOT NULL,
   frequency_unit frequency_unit NOT NULL,
   frequency_value integer NOT NULL DEFAULT 1,
   specific_times jsonb DEFAULT '[]'::jsonb,
   specific_days_of_week jsonb DEFAULT '[]'::jsonb,
   specific_days_of_month jsonb DEFAULT '[]'::jsonb,
   last_completed_at timestamptz,
   next_due_at timestamptz NOT NULL,
-  notes text,
+  notes monitoring_task_notes,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now()
 );