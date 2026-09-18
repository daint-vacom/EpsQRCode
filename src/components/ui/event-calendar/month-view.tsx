'use client';

import React, { useMemo } from 'react';
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DefaultStartHour, EventGap, EventHeight } from './constants';
import { DraggableEvent } from './draggable-event';
import { DroppableCell } from './droppable-cell';
import { EventItem } from './event-item';
import { useEventVisibility } from './hooks/use-event-visibility';
import { formatVietnameseTime, formatVietnameseWeekdayShort } from './labels';
import type { CalendarEvent } from './types';
import {
  getAllEventsForDay,
  getEventSegmentsForRange,
  getEventsForDay,
  isMultiDaySpan,
  sortEvents,
} from './utils';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventSelect: (event: CalendarEvent) => void;
  onEventCreate: (startTime: Date) => void;
}

export function MonthView({
  currentDate,
  events,
  onEventSelect,
  onEventCreate,
}: MonthViewProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const weekdays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), i);
      return formatVietnameseWeekdayShort(date);
    });
  }, []);

  const weeks = useMemo(() => {
    const result = [];
    let week = [];

    for (let i = 0; i < days.length; i++) {
      week.push(days[i]);
      if (week.length === 7 || i === days.length - 1) {
        result.push(week);
        week = [];
      }
    }

    return result;
  }, [days]);

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    onEventSelect(event);
  };

  const { contentRef, getVisibleEventCount } = useEventVisibility({
    eventHeight: EventHeight,
    eventGap: EventGap,
  });

  const spanningEvents = useMemo(() => events.filter(isMultiDaySpan), [events]);

  return (
    <div
      data-slot="month-view"
      className="flex min-h-0 flex-1 flex-col overflow-auto"
    >
      <div className="border-border/70 grid grid-cols-7 border-b">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-muted-foreground/70 py-2 text-center text-sm"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr">
        {weeks.map((week, weekIndex) => {
          const spanningSegments = getEventSegmentsForRange(
            spanningEvents,
            week[0],
            week[6],
          );
          const spanningLaneCount = spanningSegments.reduce(
            (maxLane, segment) => Math.max(maxLane, segment.lane + 1),
            0,
          );

          return (
            <div key={`week-${weekIndex}`} className="relative">
              <div className="grid grid-cols-7 [&:last-child>*]:border-b-0">
                {week.map((day, dayIndex) => {
                  if (!day) return null; // Skip if day is undefined

                  const dayEvents = getEventsForDay(events, day);
                  const singleDayEvents = dayEvents.filter(
                    (event) => !isMultiDaySpan(event),
                  );
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const cellId = `month-cell-${day.toISOString()}`;
                  const allEvents = getAllEventsForDay(events, day);

                  const isReferenceCell = weekIndex === 0 && dayIndex === 0;
                  const visibleCount = getVisibleEventCount(
                    singleDayEvents.length,
                  );
                  const hasMore =
                    visibleCount !== undefined &&
                    singleDayEvents.length > visibleCount;
                  const remainingCount = hasMore
                    ? singleDayEvents.length - visibleCount
                    : 0;

                  return (
                    <div
                      key={day.toString()}
                      className="group border-border/70 data-outside-cell:bg-muted/25 data-outside-cell:text-muted-foreground/70 border-r border-b last:border-r-0"
                      data-today={isToday(day) || undefined}
                      data-outside-cell={!isCurrentMonth || undefined}
                    >
                      <DroppableCell
                        id={cellId}
                        date={day}
                        onClick={() => {
                          const startTime = new Date(day);
                          startTime.setHours(DefaultStartHour, 0, 0);
                          onEventCreate(startTime);
                        }}
                      >
                        <div className="group-data-today:bg-zinc-950 group-data-today:text-primary-foreground mt-1 inline-flex size-6 items-center justify-center rounded-full text-sm">
                          {format(day, 'd')}
                        </div>
                        {spanningLaneCount > 0 && (
                          <div
                            aria-hidden="true"
                            style={{
                              height: `${spanningLaneCount * (EventHeight + EventGap)}px`,
                            }}
                          />
                        )}
                        <div
                          ref={isReferenceCell ? contentRef : null}
                          className="min-h-[calc((var(--event-height)+var(--event-gap))*2)] sm:min-h-[calc((var(--event-height)+var(--event-gap))*3)] lg:min-h-[calc((var(--event-height)+var(--event-gap))*4)]"
                        >
                          {sortEvents(singleDayEvents).map((event, index) => {
                            const isHidden =
                              visibleCount && index >= visibleCount;

                            if (!visibleCount) return null;

                            return (
                              <div
                                key={event.id}
                                className="aria-hidden:hidden"
                                aria-hidden={isHidden ? 'true' : undefined}
                              >
                                <DraggableEvent
                                  event={event}
                                  view="month"
                                  onClick={(e) => handleEventClick(event, e)}
                                />
                              </div>
                            );
                          })}

                          {hasMore && (
                            <Popover modal>
                              <PopoverTrigger asChild>
                                <button
                                  className="focus-visible:border-ring focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-[var(--event-gap)] flex h-[var(--event-height)] w-full items-center overflow-hidden px-1 text-left text-[10px] backdrop-blur-md transition outline-none select-none focus-visible:ring-[3px] sm:px-2 sm:text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>
                                    + {remainingCount}{' '}
                                    <span className="max-sm:sr-only">khác</span>
                                  </span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="center"
                                className="max-w-52 p-3"
                                style={
                                  {
                                    '--event-height': `${EventHeight}px`,
                                  } as React.CSSProperties
                                }
                              >
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">
                                    {formatVietnameseWeekdayShort(day)}{' '}
                                    {format(day, 'd')}
                                  </div>
                                  <div className="space-y-1">
                                    {sortEvents(allEvents).map((event) => {
                                      const eventStart = new Date(event.start);
                                      const eventEnd = new Date(event.end);
                                      const isFirstDay = isSameDay(
                                        day,
                                        eventStart,
                                      );
                                      const isLastDay = isSameDay(
                                        day,
                                        eventEnd,
                                      );

                                      return (
                                        <EventItem
                                          key={event.id}
                                          onClick={(e) =>
                                            handleEventClick(event, e)
                                          }
                                          event={event}
                                          view="month"
                                          isFirstDay={isFirstDay}
                                          isLastDay={isLastDay}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </DroppableCell>
                    </div>
                  );
                })}
              </div>

              {spanningSegments.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-8 z-20 grid grid-cols-7"
                  style={{
                    gridAutoRows: `${EventHeight}px`,
                    rowGap: `${EventGap}px`,
                  }}
                >
                  {spanningSegments.map((segment) => (
                    <div
                      key={`${segment.event.id}-${week[0].toISOString()}`}
                      className="pointer-events-auto min-w-0"
                      style={{
                        gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                        gridRow: segment.lane + 1,
                      }}
                    >
                      <DraggableEvent
                        event={segment.event}
                        view="month"
                        onClick={(e) => handleEventClick(segment.event, e)}
                        isFirstDay={segment.isFirstSegment}
                        isLastDay={segment.isLastSegment}
                      >
                        <div
                          className={cn(
                            'truncate',
                            !segment.isFirstSegment && 'invisible',
                          )}
                          aria-hidden={!segment.isFirstSegment}
                        >
                          {!segment.event.allDay && (
                            <span>
                              {formatVietnameseTime(
                                new Date(segment.event.start),
                              )}{' '}
                            </span>
                          )}
                          {segment.event.title}
                        </div>
                      </DraggableEvent>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
