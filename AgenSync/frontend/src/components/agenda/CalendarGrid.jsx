import EventCard from "./EventCard.jsx";
import TimeColumn from "./TimeColumn.jsx";
import WeekHeader from "./WeekHeader.jsx";
import { appointmentsForDate, getTimedBlockStyle, minutesToTime, timeToMinutes } from "./agendaTime.js";

const COMPACT_EVENT_GAP = 4;
const COMPACT_EVENT_MIN_HEIGHT = 16;
const COMPACT_EVENT_MAX_HEIGHT = 34;

function compactClusterLayout(cluster, schedule) {
  const clusterStart = Math.min(...cluster.map((appointment) => timeToMinutes(appointment.startTime)));
  const clusterEnd = Math.max(...cluster.map((appointment) => timeToMinutes(appointment.endTime)));
  const clusterStyle = getTimedBlockStyle(
    {
      startTime: minutesToTime(clusterStart),
      endTime: minutesToTime(clusterEnd)
    },
    schedule
  );
  const clusterTop = Number.parseFloat(clusterStyle.top) || 0;
  const clusterHeight = Number.parseFloat(clusterStyle.height) || schedule.slotHeight;
  const totalGap = COMPACT_EVENT_GAP * Math.max(cluster.length - 1, 0);
  const availableRowHeight = (clusterHeight - totalGap) / Math.max(cluster.length, 1);
  const rowHeight = Math.max(
    COMPACT_EVENT_MIN_HEIGHT,
    Math.min(COMPACT_EVENT_MAX_HEIGHT, availableRowHeight)
  );

  return cluster.map((appointment, index) => ({
    appointment,
    compact: true,
    style: {
      top: `${clusterTop + index * (rowHeight + COMPACT_EVENT_GAP)}px`,
      height: `${rowHeight}px`,
      left: "0.75rem",
      right: "0.75rem"
    }
  }));
}

function layoutAppointments(appointments, schedule) {
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = 0;

  appointments.forEach((appointment) => {
    const start = timeToMinutes(appointment.startTime);
    const end = timeToMinutes(appointment.endTime);

    if (currentCluster.length && start >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = 0;
    }

    currentCluster.push(appointment);
    clusterEnd = Math.max(clusterEnd, end);
  });

  if (currentCluster.length) clusters.push(currentCluster);

  return clusters.flatMap((cluster) => {
    if (cluster.length > 1) {
      return compactClusterLayout(cluster, schedule);
    }

    const columnEnds = [];
    const positioned = cluster.map((appointment) => {
      const start = timeToMinutes(appointment.startTime);
      const end = timeToMinutes(appointment.endTime);
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);

      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[column] = end;
      }

      return { appointment, column };
    });

    const columnCount = Math.max(columnEnds.length, 1);

    return positioned.map(({ appointment, column }) => {
      const style = getTimedBlockStyle(appointment, schedule);

      if (columnCount > 1) {
        style.left = `calc(${(column * 100) / columnCount}% + 0.75rem)`;
        style.right = "auto";
        style.width = `calc(${100 / columnCount}% - 1rem)`;
      }

      return { appointment, style, compact: false };
    });
  });
}

function DayColumn({ day, appointments, breaks, rows, schedule, onSlotClick, onEventClick }) {
  const dayAppointments = appointmentsForDate(appointments, day.date);
  const positionedAppointments = layoutAppointments(dayAppointments, schedule);
  const dayBreaks = breaks.filter((item) => item.date === day.date);
  const totalHeight = rows.length * schedule.slotHeight;
  const startsAt = timeToMinutes(day.workingHours?.startTime);
  const endsAt = timeToMinutes(day.workingHours?.endTime);

  return (
    <section className="relative border-r border-line bg-white last:border-r-0" style={{ height: `${totalHeight}px` }}>
      <div className="absolute inset-x-0 top-0 z-0">
        {rows.map((row) => {
          const isWorkingSlot = !day.isClosed && row.value >= startsAt && row.value < endsAt;

          return isWorkingSlot ? (
            <button
              key={row.value}
              type="button"
              onClick={() => onSlotClick(day.date, row.label)}
              className="block w-full border-b border-slate-100 bg-white text-left transition hover:bg-blue-50/40"
              style={{ height: `${schedule.slotHeight}px` }}
              aria-label={`Criar agendamento em ${day.longLabel} às ${row.label}`}
            />
          ) : (
            <div key={row.value} className="border-b border-slate-100 bg-slate-50/45" style={{ height: `${schedule.slotHeight}px` }} />
          );
        })}
      </div>

      {day.isClosed ? (
        <div className="absolute inset-3 z-10 flex items-start justify-center rounded-2xl border border-line bg-slate-100/90 px-4 py-5 text-[11px] font-black uppercase text-slate-500">
          Fechado
        </div>
      ) : null}

      {dayBreaks.map((item) => (
        <div
          key={`${item.date}-${item.startTime}`}
          className="absolute left-3 right-3 z-10 rounded-2xl bg-slate-100 px-3 py-3 text-xs font-bold text-slate-600"
          style={getTimedBlockStyle(item, schedule)}
        >
          {item.label}
        </div>
      ))}

      {positionedAppointments.map(({ appointment, style, compact }) => (
        <EventCard
          key={appointment.id}
          appointment={appointment}
          style={style}
          compact={compact}
          onClick={onEventClick}
        />
      ))}
    </section>
  );
}

export default function CalendarGrid({
  days,
  appointments,
  breaks,
  rows,
  schedule,
  selectedDate,
  onSelectDate,
  onSlotClick,
  onEventClick
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[1120px]">
          <WeekHeader days={days} selectedDate={selectedDate} onSelectDate={onSelectDate} />

          <div className="grid grid-cols-[84px_repeat(7,minmax(142px,1fr))]">
            <TimeColumn rows={rows} slotHeight={schedule.slotHeight} />
            {days.map((day) => (
              <DayColumn
                key={day.date}
                day={day}
                appointments={appointments}
                breaks={breaks}
                rows={rows}
                schedule={schedule}
                onSlotClick={onSlotClick}
                onEventClick={onEventClick}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
