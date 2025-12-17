import { supabase } from "../lib/supabase";
import type { PatrolRound } from "@shared";

export async function createPatrolRound() {
  const payload: PatrolRound = {
    patient_id: 123,
    patrol_date: "2025-12-17",
    patrol_time: "07:15:00",
    scheduled_time: "07:00",
    recorder: "WebUser"
  };

  const { data, error } = await supabase
    .from("patrol_rounds")
    .insert(payload)
    .select();

  if (error) console.error("新增失敗：", error);
  else console.log("新增成功：", data);
}