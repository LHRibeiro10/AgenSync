export function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutes(time, amount) {
  return minutesToTime(timeToMinutes(time) + amount);
}

export function buildTimeRows(startsAt, endsAt, slotMinutes) {
  const rows = [];
  const start = timeToMinutes(startsAt);
  const end = timeToMinutes(endsAt);

  for (let minute = start; minute < end; minute += slotMinutes) {
    rows.push({
      value: minute,
      label: minutesToTime(minute)
    });
  }

  return rows;
}

export function getTimedBlockStyle(block, schedule) {
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);
  const gridStart = timeToMinutes(schedule.startsAt);
  const duration = Math.max(end - start, schedule.slotMinutes);
  const top = ((start - gridStart) / schedule.slotMinutes) * schedule.slotHeight;
  const height = (duration / schedule.slotMinutes) * schedule.slotHeight;

  return {
    top: `${top}px`,
    height: `${height}px`
  };
}

export function appointmentsForDate(appointments, date) {
  return appointments
    .filter((appointment) => appointment.date === date)
    .sort((first, second) => first.startTime.localeCompare(second.startTime));
}
