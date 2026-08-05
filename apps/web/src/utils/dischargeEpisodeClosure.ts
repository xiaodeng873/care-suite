export type DischargeReason = '死亡' | '回家' | '留醫' | '轉往其他機構';

export interface EpisodeClosurePayload {
  episodeId: string;
  episodeUpdate: any;
  events: any[];
}

export function isEpisodeUnclosed(episode: any): boolean {
  const events = episode?.episode_events || [];
  const hasVacationStart = events.some((e: any) => e.event_type === 'vacation_start');
  const hasVacationEnd = events.some((e: any) => e.event_type === 'vacation_end');
  const hasAdmissionOrTransfer = events.some(
    (e: any) => e.event_type === 'admission' || e.event_type === 'transfer'
  );
  const hasDischarge = events.some((e: any) => e.event_type === 'discharge');
  return (
    (hasVacationStart && !hasVacationEnd) ||
    (hasAdmissionOrTransfer && !hasDischarge)
  );
}

export function mapDischargeReason(reason: DischargeReason): {
  dischargeType: string | null;
  dischargeDestination: string | null;
  dateOfDeath: string | null;
  closingDate: string;
} {
  switch (reason) {
    case '死亡':
      return {
        dischargeType: 'deceased',
        dischargeDestination: null,
        dateOfDeath: null,
        closingDate: '',
      };
    case '回家':
      return {
        dischargeType: 'home',
        dischargeDestination: null,
        dateOfDeath: null,
        closingDate: '',
      };
    case '轉往其他機構':
      return {
        dischargeType: 'transfer_out',
        dischargeDestination: null,
        dateOfDeath: null,
        closingDate: '',
      };
    case '留醫':
    default:
      return {
        dischargeType: null,
        dischargeDestination: null,
        dateOfDeath: null,
        closingDate: '',
      };
  }
}

export function buildEpisodeClosurePayloads(
  patientId: number,
  dischargeReason: DischargeReason,
  dischargeDate: string,
  deathDate: string | null | undefined,
  transferFacilityName: string | null | undefined,
  hospitalEpisodes: any[]
): EpisodeClosurePayload[] {
  if (dischargeReason === '留醫') return [];

  const {
    dischargeType,
    dischargeDestination: mappedDestination,
    dateOfDeath: mappedDateOfDeath,
  } = mapDischargeReason(dischargeReason);

  const closingDate = dischargeReason === '死亡' ? (deathDate || dischargeDate) : dischargeDate;
  const dateOfDeath = dischargeReason === '死亡' ? (deathDate || dischargeDate) : null;
  const dischargeDestination =
    dischargeReason === '轉往其他機構' ? (transferFacilityName || '') : mappedDestination;

  const patientEpisodes = hospitalEpisodes.filter((ep: any) => ep.patient_id === patientId);
  const payloads: EpisodeClosurePayload[] = [];

  for (const episode of patientEpisodes) {
    const events = episode.episode_events || [];
    const hasVacationStart = events.some((e: any) => e.event_type === 'vacation_start');
    const hasVacationEnd = events.some((e: any) => e.event_type === 'vacation_end');
    const hasAdmissionOrTransfer = events.some(
      (e: any) => e.event_type === 'admission' || e.event_type === 'transfer'
    );
    const hasDischarge = events.some((e: any) => e.event_type === 'discharge');

    const newEvents: any[] = [];

    if (hasVacationStart && !hasVacationEnd) {
      newEvents.push({
        event_type: 'vacation_end',
        event_date: closingDate,
        event_time: null,
        hospital_name: episode.primary_hospital || '',
        hospital_ward: episode.primary_ward || '',
        hospital_bed_number: episode.primary_bed_number || '',
        remarks: '自動閉合：院友退住',
        event_order: (events.length + newEvents.length + 1) * 10,
        vacation_end_type: dischargeType,
        vacation_destination: dischargeDestination,
      });
    }

    if (hasAdmissionOrTransfer && !hasDischarge) {
      const sortedEvents = [...events].sort((a: any, b: any) => {
        const dateA = new Date(`${a.event_date} ${a.event_time || '00:00'}`).getTime();
        const dateB = new Date(`${b.event_date} ${b.event_time || '00:00'}`).getTime();
        return dateB - dateA;
      });
      const lastHospitalEvent = sortedEvents.find(
        (e: any) => e.event_type === 'admission' || e.event_type === 'transfer'
      );

      newEvents.push({
        event_type: 'discharge',
        event_date: closingDate,
        event_time: null,
        hospital_name: lastHospitalEvent?.hospital_name || episode.primary_hospital || '',
        hospital_ward: lastHospitalEvent?.hospital_ward || episode.primary_ward || '',
        hospital_bed_number: lastHospitalEvent?.hospital_bed_number || episode.primary_bed_number || '',
        remarks: '自動閉合：院友退住',
        event_order: (events.length + newEvents.length + 1) * 10,
      });
    }

    if (newEvents.length === 0) continue;

    const { episode_events, ...episodeData } = episode;

    payloads.push({
      episodeId: episode.id,
      events: [...events, ...newEvents],
      episodeUpdate: {
        ...episodeData,
        episode_end_date: closingDate,
        status: 'completed',
        discharge_type: hasAdmissionOrTransfer && !hasDischarge ? dischargeType : (episode.discharge_type || null),
        discharge_destination:
          hasAdmissionOrTransfer && !hasDischarge && dischargeType === 'transfer_out'
            ? dischargeDestination
            : (episode.discharge_destination || null),
        vacation_end_type: hasVacationStart && !hasVacationEnd ? dischargeType : (episode.vacation_end_type || null),
        date_of_death: dateOfDeath,
      },
    });
  }

  return payloads;
}
