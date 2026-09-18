import type { CSSProperties } from 'react';
import { differenceInCalendarDays, isSameDay, startOfDay } from 'date-fns';
import type { CalendarEvent, EventColor } from './types';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function getEventColorStyle(color?: string): CSSProperties | undefined {
  if (!color || !HEX_COLOR_PATTERN.test(color)) return undefined;

  return {
    backgroundColor: `${color}26`,
    color,
    boxShadow: `inset 0 0 0 1px ${color}55`,
  };
}

/**
 * Get CSS classes for event colors
 */
export function getEventColorClasses(color?: EventColor | string): string {
  const eventColor = color || 'sky';

  switch (eventColor) {
    case 'sky':
      return 'bg-sky-200/50 hover:bg-sky-200/40 text-sky-950/80 dark:bg-sky-400/25 dark:hover:bg-sky-400/20 dark:text-sky-200 shadow-sky-700/8';
    case 'amber':
      return 'bg-amber-200/50 hover:bg-amber-200/40 text-amber-950/80 dark:bg-amber-400/25 dark:hover:bg-amber-400/20 dark:text-amber-200 shadow-amber-700/8';
    case 'violet':
      return 'bg-violet-200/50 hover:bg-violet-200/40 text-violet-950/80 dark:bg-violet-400/25 dark:hover:bg-violet-400/20 dark:text-violet-200 shadow-violet-700/8';
    case 'rose':
      return 'bg-rose-200/50 hover:bg-rose-200/40 text-rose-950/80 dark:bg-rose-400/25 dark:hover:bg-rose-400/20 dark:text-rose-200 shadow-rose-700/8';
    case 'emerald':
      return 'bg-emerald-200/50 hover:bg-emerald-200/40 text-emerald-950/80 dark:bg-emerald-400/25 dark:hover:bg-emerald-400/20 dark:text-emerald-200 shadow-emerald-700/8';
    case 'orange':
      return 'bg-orange-200/50 hover:bg-orange-200/40 text-orange-950/80 dark:bg-orange-400/25 dark:hover:bg-orange-400/20 dark:text-orange-200 shadow-orange-700/8';
    default:
      return 'bg-sky-200/50 hover:bg-sky-200/40 text-sky-950/80 dark:bg-sky-400/25 dark:hover:bg-sky-400/20 dark:text-sky-200 shadow-sky-700/8';
  }
}

/**
 * Get CSS classes for border radius based on event position in multi-day events
 */
export function getBorderRadiusClasses(
  isFirstDay: boolean,
  isLastDay: boolean,
): string {
  if (isFirstDay && isLastDay) {
    return 'rounded'; // Both ends rounded
  } else if (isFirstDay) {
    return 'rounded-l rounded-r-none'; // Only left end rounded
  } else if (isLastDay) {
    return 'rounded-r rounded-l-none'; // Only right end rounded
  } else {
    return 'rounded-none'; // No rounded corners
  }
}

/**
 * Check if an event is a multi-day event
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);
  return event.allDay || eventStart.getDate() !== eventEnd.getDate();
}

/**
 * A multi-day span is an event whose rendered date range crosses at least one
 * calendar-day boundary. Single-day all-day events stay in their day cell.
 */
export function isMultiDaySpan(event: CalendarEvent): boolean {
  return !isSameDay(new Date(event.start), new Date(event.end));
}

export interface CalendarEventSegment {
  event: CalendarEvent;
  startIndex: number;
  endIndex: number;
  lane: number;
  isFirstSegment: boolean;
  isLastSegment: boolean;
}

/**
 * Split events into one continuous visual segment for the requested date
 * range. The segment owns a grid column span, so a multi-day event is not
 * rendered once per cell and cannot be cut by the cells' dividers.
 */
export function getEventSegmentsForRange(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEventSegment[] {
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  const segments = events
    .map((event) => {
      const eventStartDay = startOfDay(new Date(event.start));
      const eventEndDay = startOfDay(new Date(event.end));

      if (eventEndDay < rangeStartDay || eventStartDay > rangeEndDay) {
        return null;
      }

      const segmentStart =
        eventStartDay < rangeStartDay ? rangeStartDay : eventStartDay;
      const segmentEnd = eventEndDay > rangeEndDay ? rangeEndDay : eventEndDay;

      return {
        event,
        startIndex: differenceInCalendarDays(segmentStart, rangeStartDay),
        endIndex: differenceInCalendarDays(segmentEnd, rangeStartDay),
        isFirstSegment: isSameDay(segmentStart, eventStartDay),
        isLastSegment: isSameDay(segmentEnd, eventEndDay),
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> =>
      Boolean(segment),
    )
    .sort((a, b) => {
      if (a.startIndex !== b.startIndex) {
        return a.startIndex - b.startIndex;
      }

      return b.endIndex - a.endIndex;
    });

  const laneEndIndexes: number[] = [];

  return segments.map((segment) => {
    const availableLane = laneEndIndexes.findIndex(
      (laneEndIndex) => laneEndIndex < segment.startIndex,
    );
    const lane = availableLane === -1 ? laneEndIndexes.length : availableLane;

    laneEndIndexes[lane] = segment.endIndex;

    return { ...segment, lane };
  });
}

/**
 * Filter events for a specific day
 */
export function getEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start);
      return isSameDay(day, eventStart);
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Sort events with multi-day events first, then by start time
 */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const aIsMultiDay = isMultiDayEvent(a);
    const bIsMultiDay = isMultiDayEvent(b);

    if (aIsMultiDay && !bIsMultiDay) return -1;
    if (!aIsMultiDay && bIsMultiDay) return 1;

    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
}

/**
 * Get multi-day events that span across a specific day (but don't start on that day)
 */
export function getSpanningEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events.filter((event) => {
    if (!isMultiDayEvent(event)) return false;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    // Only include if it's not the start day but is either the end day or a middle day
    return (
      !isSameDay(day, eventStart) &&
      (isSameDay(day, eventEnd) || (day > eventStart && day < eventEnd))
    );
  });
}

/**
 * Get all events visible on a specific day (starting, ending, or spanning)
 */
export function getAllEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events.filter((event) => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    return (
      isSameDay(day, eventStart) ||
      isSameDay(day, eventEnd) ||
      (day > eventStart && day < eventEnd)
    );
  });
}

/**
 * Get all events for a day (for agenda view)
 */
export function getAgendaEventsForDay(
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] {
  return events
    .filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return (
        isSameDay(day, eventStart) ||
        isSameDay(day, eventEnd) ||
        (day > eventStart && day < eventEnd)
      );
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
