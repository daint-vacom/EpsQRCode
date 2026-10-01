import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  endOfWeek,
  isSameMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import {
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SectionLoading } from '@/components/ui/loading';
import { AgendaView } from './agenda-view';
import { CalendarDndProvider } from './calendar-dnd-context';
import {
  AgendaDaysToShow,
  EventGap,
  EventHeight,
  WeekCellsHeight,
} from './constants';
import { DayView } from './day-view';
import { EventDialog } from './event-dialog';
import {
  formatVietnameseDate,
  formatVietnameseMonthYear,
  formatVietnameseShortDate,
} from './labels';
import { MonthView } from './month-view';
import type { CalendarEvent, CalendarView } from './types';
import { WeekView } from './week-view';

const VIEW_LABELS: Record<CalendarView, string> = {
  month: 'Tháng',
  week: 'Tuần',
  day: 'Ngày',
  agenda: 'Lịch trình',
};

export interface EventCalendarProps {
  events?: CalendarEvent[];
  onEventAdd?: (event: CalendarEvent) => void;
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onEventSelect?: (event: CalendarEvent) => void;
  onEventCreate?: (startTime: Date) => void;
  className?: string;
  initialView?: CalendarView;
  allowEventCreation?: boolean;
  isLoading?: boolean;
}

export function EventCalendar({
  events = [],
  onEventAdd,
  onEventUpdate,
  onEventDelete,
  onEventSelect,
  onEventCreate,
  className,
  initialView = 'month',
  allowEventCreation = true,
  isLoading = false,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(initialView);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isEventDialogOpen ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        return;
      }

      const nextView: Partial<Record<string, CalendarView>> = {
        m: 'month',
        w: 'week',
        d: 'day',
        a: 'agenda',
      };
      const selectedView = nextView[event.key.toLowerCase()];
      if (selectedView) setView(selectedView);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEventDialogOpen]);

  const handlePrevious = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (view === 'day') setCurrentDate(addDays(currentDate, -1));
    if (view === 'agenda') {
      setCurrentDate(addDays(currentDate, -AgendaDaysToShow));
    }
  };

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    if (view === 'agenda') {
      setCurrentDate(addDays(currentDate, AgendaDaysToShow));
    }
  };

  const handleEventSelect = (event: CalendarEvent) => {
    if (onEventSelect) {
      onEventSelect(event);
      return;
    }
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleEventCreate = (startTime: Date) => {
    if (!allowEventCreation) return;

    const minutes = startTime.getMinutes();
    const remainder = minutes % 15;
    if (remainder !== 0) {
      startTime.setMinutes(
        remainder < 7.5 ? minutes - remainder : minutes + (15 - remainder),
      );
      startTime.setSeconds(0);
      startTime.setMilliseconds(0);
    }

    if (onEventCreate) {
      onEventCreate(startTime);
      return;
    }

    setSelectedEvent({
      id: '',
      title: '',
      start: startTime,
      end: addHours(startTime, 1),
      allDay: false,
    });
    setIsEventDialogOpen(true);
  };

  const handleEventSave = (event: CalendarEvent) => {
    if (event.id) {
      onEventUpdate?.(event);
      toast.success('Đã cập nhật sự kiện.');
    } else {
      onEventAdd?.({ ...event, id: Math.random().toString(36).slice(2, 11) });
      toast.success('Đã thêm sự kiện.');
    }
    setIsEventDialogOpen(false);
    setSelectedEvent(null);
  };

  const handleEventDelete = (eventId: string) => {
    onEventDelete?.(eventId);
    setIsEventDialogOpen(false);
    setSelectedEvent(null);
    toast.success('Đã xóa sự kiện.');
  };

  const handleEventUpdate = (updatedEvent: CalendarEvent) => {
    onEventUpdate?.(updatedEvent);
    if (!onEventUpdate) toast.success('Đã cập nhật sự kiện.');
  };

  const viewTitle = useMemo(() => {
    if (view === 'month') {
      return formatVietnameseMonthYear(currentDate);
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return isSameMonth(start, end)
        ? `${start.getDate()} - ${end.getDate()} ${formatVietnameseMonthYear(start)}`
        : `${formatVietnameseShortDate(start)} - ${formatVietnameseShortDate(end)}`;
    }
    if (view === 'day') {
      return formatVietnameseDate(currentDate);
    }

    const end = addDays(currentDate, AgendaDaysToShow - 1);
    return isSameMonth(currentDate, end)
      ? `${currentDate.getDate()} tháng ${currentDate.getMonth() + 1} - ${end.getDate()} ${formatVietnameseMonthYear(end)}`
      : `${formatVietnameseShortDate(currentDate)} - ${formatVietnameseShortDate(end)}`;
  }, [currentDate, view]);

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card has-data-[slot=month-view]:flex-1"
      style={
        {
          '--event-height': `${EventHeight}px`,
          '--event-gap': `${EventGap}px`,
          '--week-cells-height': `${WeekCellsHeight}px`,
        } as CSSProperties
      }
    >
      <CalendarDndProvider onEventUpdate={handleEventUpdate}>
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 p-2 sm:flex-nowrap sm:p-4',
            className,
          )}
        >
          <div className="flex min-w-0 items-center gap-1 sm:gap-4">
            <Button
              variant="outline"
              className="max-[479px]:aspect-square max-[479px]:p-0!"
              onClick={() => setCurrentDate(new Date())}
            >
              <CalendarCheck2
                className="min-[480px]:hidden"
                size={16}
                aria-hidden="true"
              />
              <span className="max-[479px]:sr-only">Hôm nay</span>
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                aria-label="Khoảng thời gian trước"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                aria-label="Khoảng thời gian tiếp theo"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
            <h2 className="truncate text-sm font-semibold sm:text-lg">
              {viewTitle}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <span>{VIEW_LABELS[view]}</span>
                  <ChevronDown className="-me-1 opacity-60" size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-32">
                {(Object.keys(VIEW_LABELS) as CalendarView[]).map((item) => (
                  <DropdownMenuItem key={item} onClick={() => setView(item)}>
                    {VIEW_LABELS[item]}
                    <DropdownMenuShortcut>
                      {item === 'month'
                        ? 'M'
                        : item === 'week'
                          ? 'W'
                          : item === 'day'
                            ? 'D'
                            : 'A'}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {allowEventCreation && !onEventCreate ? (
              <Button
                variant="mono"
                onClick={() => {
                  const now = new Date();
                  now.setMinutes(0, 0, 0);
                  now.setHours(now.getHours() + 1);
                  handleEventCreate(now);
                }}
              >
                <Plus className="opacity-60" size={16} aria-hidden="true" />
                <span>Thêm sự kiện</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-auto"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <SectionLoading
              className="min-h-0 flex-1 rounded-none bg-transparent"
              label="Đang tải lịch..."
            />
          ) : (
            <>
              {view === 'month' ? (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onEventSelect={handleEventSelect}
                  onEventCreate={handleEventCreate}
                />
              ) : null}
              {view === 'week' ? (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onEventSelect={handleEventSelect}
                  onEventCreate={handleEventCreate}
                />
              ) : null}
              {view === 'day' ? (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onEventSelect={handleEventSelect}
                  onEventCreate={handleEventCreate}
                />
              ) : null}
              {view === 'agenda' ? (
                <AgendaView
                  currentDate={currentDate}
                  events={events}
                  onEventSelect={handleEventSelect}
                />
              ) : null}
            </>
          )}
        </div>

        {allowEventCreation && !onEventCreate ? (
          <EventDialog
            event={selectedEvent}
            isOpen={isEventDialogOpen}
            onClose={() => {
              setIsEventDialogOpen(false);
              setSelectedEvent(null);
            }}
            onSave={handleEventSave}
            onDelete={handleEventDelete}
          />
        ) : null}
      </CalendarDndProvider>
    </div>
  );
}
